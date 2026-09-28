/**
 * GET /api/queue/jobs — список задач тенанта (для UI и мониторинга).
 * GET /api/queue/jobs/[id]/download — скачать результат export-задачи.
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { getTenantQuery } from '@/lib/tenant-query';

async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

    const jobs = await prisma.queueJob.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        nextRetryAt: true,
      },
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('List queue jobs error:', error);
    return NextResponse.json({ error: 'Помилка отримання задач' }, { status: 500 });
  }
}

export const GET = withAuth({ minRole: 'admin' })(GETHandler);
