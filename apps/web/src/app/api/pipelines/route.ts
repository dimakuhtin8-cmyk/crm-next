import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/pipelines — List pipelines with stages
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const pipelines = await tq.pipeline.findMany({
      include: { stages: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ pipelines });
  } catch (error) {
    console.error('List pipelines error:', error);
    return NextResponse.json({ error: 'Помилка отримання воронок' }, { status: 500 });
  }
}

/**
 * POST /api/pipelines — Create pipeline with stages
 */
const createPipelineSchema = z.object({
  name: z.string().min(1).max(100),
  stages: z.array(z.object({
    name: z.string().min(1).max(100),
    color: z.string().max(7).optional(),
  })).min(1).max(20),
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
    const parsed = createPipelineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check if name exists
    const existing = await tq.pipeline.findFirst({ where: { name: parsed.data.name } });
    if (existing) {
      return NextResponse.json({ error: 'Воронка з такою назвою вже існує' }, { status: 400 });
    }

    // Create pipeline with stages
    const pipeline = await tq.pipeline.create({
      data: {
        name: parsed.data.name,
        stages: {
          create: parsed.data.stages.map((s, i) => ({
            name: s.name,
            order: i,
            color: s.color,
          })),
        },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (error) {
    console.error('Create pipeline error:', error);
    return NextResponse.json({ error: 'Помилка створення воронки' }, { status: 500 });
  }
}
