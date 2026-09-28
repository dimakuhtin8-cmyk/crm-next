/**
 * Cache Stats API — статистика кэша
 *
 * GET /api/v1/cache/stats
 *
 * Ответ: { hits, misses, sets, deletes, size, hitRate }
 */

import { addVersionHeaders } from '@/lib/api-versioning';
import { withAuth } from '@/lib/auth-guard';
import { cache } from '@/lib/cache';
import { withErrorHandling, apiSuccess } from '@/lib/errors';

export const GET = withAuth({ minRole: 'admin' })(
  withErrorHandling(async (_request: Request) => {
    const stats = cache.getStats();

    const response = apiSuccess(stats);
    return addVersionHeaders(response, 'v1');
  }),
);
