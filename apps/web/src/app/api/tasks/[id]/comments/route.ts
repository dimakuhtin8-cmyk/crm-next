import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { extractUserId } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]/comments — List comments
 */
export async function GET(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    // Ownership check: comments of a foreign task must not leak
    const owned = await tq.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Задачу не знайдено' }, { status: 404 });
    }
    const comments = await tq.taskComment.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('List comments error:', error);
    return NextResponse.json({ error: 'Помилка отримання коментарів' }, { status: 500 });
  }
}

/**
 * POST /api/tasks/[id]/comments — Add comment
 */
const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

async function POSTHandler(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    const userId = await extractUserId(request);

    // Ownership check: cannot comment on a foreign task
    const owned = await tq.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Задачу не знайдено' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const comment = await tq.taskComment.create({
      data: {
        taskId: id,
        authorId: userId,
        body: parsed.data.body,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json({ error: 'Помилка створення коментаря' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'task:update' })(POSTHandler);
