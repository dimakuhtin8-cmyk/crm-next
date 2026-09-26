/**
 * Automation Logs API — история выполнения автоматизаций
 * 
 * GET /api/automation/logs — список логов с фильтрацией
 * DELETE /api/automation/logs — очистка старых логов
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';

export async function GET(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Use raw prisma via tenant query's tenantId
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    // Import prisma directly for automation logs
    const { prisma } = await import('@crm-next/database');

    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        where: { tenantId },
        orderBy: { executedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.automationLog.count({ where: { tenantId } }),
    ]);

    // Enrich with rule names
    const ruleIds = [...new Set(logs.map(l => l.ruleId).filter(Boolean))] as string[];
    const rules = ruleIds.length > 0
      ? await prisma.automationRule.findMany({
          where: { id: { in: ruleIds } },
          select: { id: true, name: true },
        })
      : [];

    const ruleMap = new Map(rules.map(r => [r.id, r.name]));

    const enrichedLogs = logs.map(log => ({
      ...log,
      ruleName: log.ruleId ? ruleMap.get(log.ruleId) || 'Unknown Rule' : 'System',
    }));

    return NextResponse.json({
      logs: enrichedLogs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get automation logs error:', error);
    return NextResponse.json({ error: 'Помилка отримання логів' }, { status: 500 });
  }
}

async function DELETEHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const { prisma } = await import('@crm-next/database');

    const { searchParams } = new URL(request.url);
    const olderThan = searchParams.get('olderThan');

    const where: Record<string, unknown> = { tenantId };

    if (olderThan) {
      const date = new Date();
      date.setDate(date.getDate() - parseInt(olderThan));
      (where as Record<string, unknown>).executedAt = { lt: date };
    }

    const result = await prisma.automationLog.deleteMany({ where });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error('Delete automation logs error:', error);
    return NextResponse.json({ error: 'Помилка видалення логів' }, { status: 500 });
  }
}

export const DELETE = withAuth({ permission: 'audit:read' })(DELETEHandler);
