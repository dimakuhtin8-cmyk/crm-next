import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * GET /api/tenants — List user's tenants
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    // Get user from session (simplified — in real app use auth())
    const token = request.cookies.get('authjs.session-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.id as string;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const memberships = await prisma.tenantMember.findMany({
      where: { userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            logo: true,
            settings: true,
            createdAt: true,
          },
        },
      },
    });

    const tenants = memberships.map((m) => ({
      ...m.tenant,
      role: m.role,
    }));

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('List tenants error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання списку компаній' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenants — Create new tenant
 */
const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug повинен містити лише літери, цифри та дефіси'),
  domain: z.string().url().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitResult = checkRateLimit(`tenant:create:${ip}`, RATE_LIMITS.register);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Забагато запитів. Спробуйте пізніше.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const body = await request.json();

    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, slug, domain } = parsed.data;

    // Get user from session
    const token = request.cookies.get('authjs.session-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.id as string;

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Check slug uniqueness
    const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json(
        { error: 'Цей slug вже зайнятий' },
        { status: 400 }
      );
    }

    // Check domain uniqueness
    if (domain) {
      const existingDomain = await prisma.tenant.findUnique({ where: { domain } });
      if (existingDomain) {
        return NextResponse.json(
          { error: 'Цей домен вже зайнятий' },
          { status: 400 }
        );
      }
    }

    // Create tenant with owner membership
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        domain: domain || null,
        members: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
      include: {
        members: {
          select: { id: true, role: true },
        },
      },
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    console.error('Create tenant error:', error);
    return NextResponse.json(
      { error: 'Помилка створення компанії' },
      { status: 500 }
    );
  }
}
