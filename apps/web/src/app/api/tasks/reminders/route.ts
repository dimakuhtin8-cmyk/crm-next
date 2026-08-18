import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/tasks/reminders — Get tasks with upcoming reminders
 * Query params:
 *   - hours: how far ahead to look (default 24)
 *   - includeOverdue: include past reminders that weren't dismissed (default true)
 */
export async function GET(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const includeOverdue = searchParams.get('includeOverdue') !== 'false';

    const now = new Date();
    const futureLimit = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const where: Record<string, unknown>[] = [
      { reminderAt: { gte: now, lte: futureLimit } },
    ];

    if (includeOverdue) {
      where.push({ reminderAt: { lt: now } });
    }

    const tasks = await tq.task.findMany({
      where: {
        OR: where,
        reminderAt: { not: null },
        status: { notIn: ['done', 'cancelled'] },
      } as never,
      orderBy: { reminderAt: 'asc' },
    } as never);

    // Categorize
    const overdue = tasks.filter((t: { reminderAt: Date | string | null }) => t.reminderAt && new Date(t.reminderAt) < now);
    const upcoming = tasks.filter((t: { reminderAt: Date | string | null }) => t.reminderAt && new Date(t.reminderAt) >= now);

    return NextResponse.json({ overdue, upcoming, total: tasks.length });
  } catch (error) {
    console.error('Get reminders error:', error);
    return NextResponse.json({ error: 'Помилка отримання нагадувань' }, { status: 500 });
  }
}
