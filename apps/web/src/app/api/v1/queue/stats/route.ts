/**
 * Queue Stats API — статистика очереди задач
 * 
 * GET /api/v1/queue/stats — статистика
 * POST /api/v1/queue/cleanup — очистка завершённых задач
 */

import { NextResponse } from 'next/server';
import { queue } from '@/lib/queues';
import { withErrorHandling, apiSuccess } from '@/lib/errors';
import { addVersionHeaders } from '@/lib/api-versioning';
import { withAuth } from '@/lib/auth-guard';

export const GET = withAuth()(withErrorHandling(async (request: Request) => {
  const stats = queue.getStats();
  
  const response = apiSuccess(stats);
  return addVersionHeaders(response, 'v1');
}));

export const DELETE = withAuth({ minRole: 'admin' })(withErrorHandling(async (request: Request) => {
  const cleaned = queue.cleanup();
  
  const response = apiSuccess({ cleaned });
  return addVersionHeaders(response, 'v1');
}));
