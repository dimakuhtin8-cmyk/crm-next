import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { extractUserId } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';
import { hasMinRole, getUserRole } from '@/lib/rbac';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tenants/[id] — Get tenant by ID
 */
export async function GET(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Check membership
    const role = await getUserRole(userId, id);
    if (!role) {
      return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Компанію не знайдено' }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Get tenant error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання компанії' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tenants/[id] — Update tenant (owner/admin)
 */
const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug повинен містити лише літери, цифри та дефіси')
    .optional(),
  domain: z.string().url().optional().nullable(),
  logo: z.string().url().optional().nullable(),
  settings: z.string().optional().nullable(),
});

export async function PUT(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Only owner can update tenant settings
    if (!(await hasMinRole(userId, id, 'owner'))) {
      return NextResponse.json(
        { error: 'Недостатньо прав для редагування' },
        { status: 403 }
      );
    }

    const { name, slug, domain, logo, settings } = parsed.data;

    // Check slug uniqueness if changing
    if (slug) {
      const existing = await prisma.tenant.findFirst({
        where: { slug, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Цей slug вже зайнятий' },
          { status: 400 }
        );
      }
    }

    // Check domain uniqueness if changing
    if (domain) {
      const existing = await prisma.tenant.findFirst({
        where: { domain, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Цей домен вже зайнятий' },
          { status: 400 }
        );
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(domain !== undefined && { domain: domain || null }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(settings !== undefined && { settings: settings || null }),
      },
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Update tenant error:', error);
    return NextResponse.json(
      { error: 'Помилка оновлення компанії' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenants/[id] — Delete tenant (owner only)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const { id } = await params;

    const userId = await extractUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Only owner can delete tenant
    if (!(await hasMinRole(userId, id, 'owner'))) {
      return NextResponse.json(
        { error: 'Недостатньо прав для видалення' },
        { status: 403 }
      );
    }

    // Delete tenant and all members (cascade)
    await prisma.tenantMember.deleteMany({ where: { tenantId: id } });
    await prisma.tenant.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete tenant error:', error);
    return NextResponse.json(
      { error: 'Помилка видалення компанії' },
      { status: 500 }
    );
  }
}
