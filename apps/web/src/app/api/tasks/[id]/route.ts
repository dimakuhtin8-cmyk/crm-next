import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { notifyTaskEvent } from '@/lib/telegram/notifications';
import { getTenantQuery } from '@/lib/tenant-query';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id] — Get task details with comments
 */
export async function GET(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    const task = await tq.task.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) return NextResponse.json({ error: 'Задачу не знайдено' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json({ error: 'Помилка отримання задачі' }, { status: 500 });
  }
}

/**
 * PUT /api/tasks/[id] — Update task
 */
const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(['task', 'call', 'email', 'meeting', 'follow_up']).optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional().nullable(),
  reminderAt: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(100).optional().nullable(),
});

function getNextDueDate(dueDate: Date, rule: string): Date | null {
  const next = new Date(dueDate);
  switch (rule) {
    case 'daily': next.setDate(next.getDate() + 1); break;
    case 'weekly': next.setDate(next.getDate() + 7); break;
    case 'biweekly': next.setDate(next.getDate() + 14); break;
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
    case 'quarterly': next.setMonth(next.getMonth() + 3); break;
    default: return null;
  }
  return next;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = { ...parsed.data } as Record<string, unknown>;
    if (parsed.data.dueDate !== undefined) data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    if (parsed.data.reminderAt !== undefined) data.reminderAt = parsed.data.reminderAt ? new Date(parsed.data.reminderAt) : null;

    const task = await tq.task.update({
      where: { id },
      data,
    });

    // Auto-create next recurring task when marked as done
    if (parsed.data.status === 'done' && task.isRecurring && task.recurrenceRule && task.dueDate) {
      const nextDue = getNextDueDate(new Date(task.dueDate), task.recurrenceRule);
      if (nextDue) {
        await tq.task.create({
          data: {
            tenantId: task.tenantId,
            title: task.title,
            description: task.description,
            type: task.type,
            status: 'todo',
            priority: task.priority,
            dueDate: nextDue,
            assigneeId: task.assigneeId,
            contactId: task.contactId,
            dealId: task.dealId,
            isRecurring: true,
            recurrenceRule: task.recurrenceRule,
          } as never,
        });
      }
    }

    // Telegram notifications
    try {
      const tenantId = (tq as unknown as { tenantId: string }).tenantId;
      if (parsed.data.status === 'done' || parsed.data.status === 'cancelled') {
        notifyTaskEvent(tenantId, id, 'status_changed').catch(() => {});
      } else if (parsed.data.assigneeId) {
        notifyTaskEvent(tenantId, id, 'assigned').catch(() => {});
      }
    } catch {}

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Помилка оновлення задачі' }, { status: 500 });
  }
}

/**
 * DELETE /api/tasks/[id] — Delete task
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    await tq.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Помилка видалення задачі' }, { status: 500 });
  }
}
