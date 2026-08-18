import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/tags — List tags (tenant-scoped)
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const tags = await tq.tag.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('List tags error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання списку тегів' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tags — Create tag
 */
const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(7).optional(),
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
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await tq.tag.findFirst({
      where: { name: parsed.data.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Тег з такою назвою вже існує' },
        { status: 400 }
      );
    }

    const tag = await tq.tag.create({
      data: parsed.data,
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    console.error('Create tag error:', error);
    return NextResponse.json(
      { error: 'Помилка створення тегу' },
      { status: 500 }
    );
  }
}
