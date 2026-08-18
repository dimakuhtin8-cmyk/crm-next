import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/contacts — List contacts (tenant-scoped, with search/filters)
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const company = searchParams.get('company') || undefined;
    const status = searchParams.get('status') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { company: { contains: search } },
      ];
    }

    if (company) {
      where.company = { contains: company };
    }

    if (status) {
      where.status = status;
    }

    if (tag) {
      where.tags = { some: { tag: { name: tag } } };
    }

    const [contacts, total] = await Promise.all([
      tq.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      tq.contact.count({ where }),
    ]);

    return NextResponse.json({ contacts, total, page, limit });
  } catch (error) {
    console.error('List contacts error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання списку контактів' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts — Create contact (tenant-scoped)
 */
const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  status: z.enum(['active', 'inactive', 'lead', 'client']).default('active'),
  tagIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tagIds, ...contactData } = parsed.data;

    const contact = await (tq.contact as unknown as {
      create: (args: { data: Record<string, unknown>; include?: Record<string, unknown> }) => Promise<unknown>;
    }).create({
      data: {
        ...contactData,
        tags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error('Create contact error:', error);
    return NextResponse.json(
      { error: 'Помилка створення контакту' },
      { status: 500 }
    );
  }
}
