/**
 * Upcoming Tasks API — ближайшие задачи для дашборда
 * 
 * GET /api/tasks/upcoming — ближайшие задачи (deadline + reminder)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';

async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const hours = parseInt(searchParams.get('hours') || '48');

    const now = new Date();
    const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const tasks = await tq.task.findMany({
      where: {
        status: { not: 'done' },
        OR: [
          {
            dueDate: {
              gte: now,
              lte: futureDate,
            },
          },
          {
            reminderAt: {
              gte: now,
              lte: futureDate,
            },
          },
        ],
      } as never,
      orderBy: [
        { reminderAt: 'asc' },
        { dueDate: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        dueDate: true,
        reminderAt: true,
        createdAt: true,
      },
    } as never);

    const enrichedTasks = (tasks as Array<Record<string, unknown>>).map(task => ({
      ...task,
      isOverdue: task.dueDate && new Date(task.dueDate as string) < now,
      isReminderDue: task.reminderAt && new Date(task.reminderAt as string) <= futureDate,
    }));

    return NextResponse.json({
      tasks: enrichedTasks,
      total: enrichedTasks.length,
    });
  } catch (error) {
    console.error('Get upcoming tasks error:', error);
    return NextResponse.json({ error: 'Помилка отримання задач' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
