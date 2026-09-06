/**
 * Cache Stats API — статистика кэша
 * 
 * GET /api/v1/cache/stats
 * 
 * Ответ: { hits, misses, sets, deletes, size, hitRate }
 */

import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';
import { withErrorHandling, apiSuccess } from '@/lib/errors';
import { addVersionHeaders } from '@/lib/api-versioning';
import { withAuth } from '@/lib/auth-guard';

export const GET = withAuth()(withErrorHandling(async (request: Request) => {
  const stats = cache.getStats();
  
  const response = apiSuccess(stats);
  return addVersionHeaders(response, 'v1');
}));
