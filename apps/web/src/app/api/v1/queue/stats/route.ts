/**
 * Queue Stats API — статистика очереди задач (DB-backed).
 *
 * GET /api/v1/queue/stats — статистика тенанта
 * DELETE /api/v1/queue/stats — очистка завершённых задач старше часа (admin)
 */

import { addVersionHeaders } from '@/lib/api-versioning';
import { withAuth } from '@/lib/auth-guard';
import { withErrorHandling, apiSuccess } from '@/lib/errors';
import { getQueueStats, cleanupQueue } from '@/lib/queues';
import { getTenantQuery } from '@/lib/tenant-query';

export const GET = withAuth({ minRole: 'admin' })(
  withErrorHandling(async (request: Request) => {
    const tq = await getTenantQuery(request as never);
    const tenantId = tq ? (tq as unknown as { tenantId: string }).tenantId : undefined;
    const stats = await getQueueStats(tenantId);

    const response = apiSuccess(stats);
    return addVersionHeaders(response, 'v1');
  }),
);

export const DELETE = withAuth({ minRole: 'admin' })(
  withErrorHandling(async (request: Request) => {
    const tq = await getTenantQuery(request as never);
    const tenantId = tq ? (tq as unknown as { tenantId: string }).tenantId : undefined;
    const cleaned = await cleanupQueue(tenantId);

    const response = apiSuccess({ cleaned });
    return addVersionHeaders(response, 'v1');
  }),
);
