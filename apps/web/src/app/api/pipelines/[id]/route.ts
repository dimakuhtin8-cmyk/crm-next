import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/pipelines/[id] — Get pipeline with stages
 */
export async function GET(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    const pipeline = await tq.pipeline.findUnique({
      where: { id },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    if (!pipeline) return NextResponse.json({ error: 'Воронку не знайдено' }, { status: 404 });
    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error('Get pipeline error:', error);
    return NextResponse.json({ error: 'Помилка отримання воронки' }, { status: 500 });
  }
}

/**
 * PUT /api/pipelines/[id] — Update pipeline stages
 */
const updatePipelineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  stages: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    color: z.string().max(7).optional(),
  })).optional(),
});

export async function PUT(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePipelineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.name) {
      await tq.pipeline.update({ where: { id }, data: { name: parsed.data.name } });
    }

    // Update stages if provided
    if (parsed.data.stages) {
      // Delete existing stages
      await tq.pipelineStage.deleteMany({ where: { pipelineId: id } });
      // Create new stages
      for (let i = 0; i < parsed.data.stages.length; i++) {
        const stage = parsed.data.stages[i];
        await tq.pipelineStage.create({
          data: { pipelineId: id, name: stage.name, order: i, color: stage.color },
        });
      }
    }

    const pipeline = await tq.pipeline.findUnique({
      where: { id },
      include: { stages: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error('Update pipeline error:', error);
    return NextResponse.json({ error: 'Помилка оновлення воронки' }, { status: 500 });
  }
}

/**
 * DELETE /api/pipelines/[id] — Delete pipeline
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;

    // Check if pipeline has deals
    const dealCount = await tq.deal.count({ where: { pipelineId: id } });
    if (dealCount > 0) {
      return NextResponse.json(
        { error: 'Неможливо видалити воронку з наявними угодами' },
        { status: 400 }
      );
    }

    await tq.pipeline.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete pipeline error:', error);
    return NextResponse.json({ error: 'Помилка видалення воронки' }, { status: 500 });
  }
}
