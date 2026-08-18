import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { notifyTaskEvent } from '@/lib/telegram/notifications';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/tasks — List tasks (tenant-scoped, with filters)
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const assigneeId = searchParams.get('assigneeId') || undefined;
    const contactId = searchParams.get('contactId') || undefined;
    const dealId = searchParams.get('dealId') || undefined;
    const dueBefore = searchParams.get('dueBefore') || undefined;
    const dueAfter = searchParams.get('dueAfter') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (contactId) where.contactId = contactId;
    if (dealId) where.dealId = dealId;
    if (dueBefore) where.dueDate = { ...(where.dueDate as Record<string, unknown> || {}), lte: new Date(dueBefore) };
    if (dueAfter) where.dueDate = { ...(where.dueDate as Record<string, unknown> || {}), gte: new Date(dueAfter) };

    const [tasks, total] = await Promise.all([
      tq.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      tq.task.count({ where }),
    ]);

    return NextResponse.json({ tasks, total, page, limit });
  } catch (error) {
    console.error('List tasks error:', error);
    return NextResponse.json({ error: 'Помилка отримання списку задач' }, { status: 500 });
  }
}

/**
 * POST /api/tasks — Create task
 */
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(['task', 'call', 'email', 'meeting', 'follow_up']).default('task'),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().optional().nullable(),
  reminderAt: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().max(100).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const task = await tq.task.create({
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        reminderAt: parsed.data.reminderAt ? new Date(parsed.data.reminderAt) : null,
      },
    });

    // Log activity
    try {
      await (tq as unknown as { activity: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> } }).activity.create({
        data: {
          type: 'task',
          title: `Створено задачу: ${parsed.data.title}`,
          contactId: parsed.data.contactId || null,
        },
      });
    } catch {}

    // Telegram notification
    try {
      const tenantId = (tq as unknown as { tenantId: string }).tenantId;
      notifyTaskEvent(tenantId, (task as { id: string }).id, 'created').catch(() => {});
    } catch {}

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Помилка створення задачі' }, { status: 500 });
  }
}
