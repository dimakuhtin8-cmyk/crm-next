/**
 * POST /api/queue/process — обработать пачку фоновых задач.
 *
 * Вызывается внешним планировщиком (см. DEPLOYMENT.md), защищён CRON_SECRET.
 * Query/body (опционально): { limit?: number, tenantId?: string, timeoutMs?: number }
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { verifyWorkerSecret } from '@/lib/worker-auth';
import { registerQueueHandlers } from '@/lib/queues/handlers';
import { processQueueJobs } from '@/lib/queues';

registerQueueHandlers();

export async function POST(request: NextRequest) {
  const denied = verifyWorkerSecret(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);

    const limit = Math.min(
      Math.max(Number(body.limit ?? searchParams.get('limit') ?? 10) || 10, 1),
      50
    );
    const tenantId =
      (typeof body.tenantId === 'string' && body.tenantId) ||
      searchParams.get('tenantId') ||
      undefined;
    const timeoutMs = Math.min(
      Math.max(Number(body.timeoutMs ?? 30000) || 30000, 1000),
      120000
    );

    const result = await processQueueJobs({ limit, tenantId, timeoutMs });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Queue process error:', error);
    return NextResponse.json({ error: 'Помилка обробки черги' }, { status: 500 });
  }
}
