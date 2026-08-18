import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const { prisma } = await import('@crm-next/database');

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const since = new Date();
    since.setDate(since.getDate() - parseInt(period, 10));

    const [totalContacts, newContacts, activeDeals, wonDeals, lostDeals] = await Promise.all([
      prisma.contact.count({ where: { tenantId } }),
      prisma.contact.count({ where: { tenantId, createdAt: { gte: since } } as never }),
      prisma.deal.count({ where: { tenantId, status: 'open' } as never }),
      prisma.deal.count({ where: { tenantId, status: 'won' } as never }),
      prisma.deal.count({ where: { tenantId, status: 'lost' } as never }),
    ]);

    const wonDealsList = await prisma.deal.findMany({ where: { tenantId, status: 'won' } as never });
    const totalRevenue = wonDealsList.reduce((sum: number, d: { value: number | null }) => sum + (d.value || 0), 0);

    const tasks = await prisma.task.findMany({ where: { tenantId }, select: { status: true } });
    const tasksMap: Record<string, number> = {};
    tasks.forEach((t) => { tasksMap[t.status] = (tasksMap[t.status] || 0) + 1; });
    const tasksByStatus = Object.entries(tasksMap).map(([name, count]) => ({ name, count }));

    const openDeals = await prisma.deal.findMany({ where: { tenantId, status: 'open' } as never, select: { stageId: true } });
    const stageMap: Record<string, number> = {};
    openDeals.forEach((d) => { const k = d.stageId || 'none'; stageMap[k] = (stageMap[k] || 0) + 1; });
    const stageIds = Object.keys(stageMap).filter((id) => id !== 'none');
    const stages = stageIds.length > 0 ? await prisma.pipelineStage.findMany({ where: { id: { in: stageIds } }, select: { id: true, name: true } }) : [];
    const snMap = new Map(stages.map((s) => [s.id, s.name]));
    const dealsByStage = Object.entries(stageMap).map(([id, count]) => ({ name: snMap.get(id) || 'Без етапу', count }));

    const activities = await prisma.activity.findMany({ where: { tenantId, date: { gte: since } } as never, select: { type: true } });
    const actMap: Record<string, number> = {};
    activities.forEach((a) => { actMap[a.type] = (actMap[a.type] || 0) + 1; });
    const activitiesByType = Object.entries(actMap).map(([name, count]) => ({ name, count }));

    const contactsByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(); start.setMonth(start.getMonth() - i, 1); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setMonth(end.getMonth() + 1, 0); end.setHours(23, 59, 59);
      const count = await prisma.contact.count({ where: { tenantId, createdAt: { gte: start, lte: end } } as never });
      contactsByMonth.push({ name: start.toLocaleDateString('uk', { month: 'short' as const }), count });
    }

    const revenueByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(); start.setMonth(start.getMonth() - i, 1); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setMonth(end.getMonth() + 1, 0); end.setHours(23, 59, 59);
      const deals = await prisma.deal.findMany({ where: { tenantId, status: 'won', updatedAt: { gte: start, lte: end } } as never });
      const revenue = deals.reduce((sum: number, d: { value: number | null }) => sum + (d.value || 0), 0);
      revenueByMonth.push({ name: start.toLocaleDateString('uk', { month: 'short' }), revenue });
    }

    const totalDeals = wonDeals + lostDeals;
    const conversionRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;
    const avgDealValue = wonDeals > 0 ? totalRevenue / wonDeals : 0;
    const forecast = Math.round(avgDealValue * activeDeals);

    return NextResponse.json({
      stats: { totalContacts, newContacts, activeDeals, wonDeals, lostDeals, conversionRate, totalRevenue, forecast },
      tasksByStatus, dealsByStage, contactsByMonth, revenueByMonth, topManagers: [], activitiesByType,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Помилка отримання аналітики' }, { status: 500 });
  }
}
