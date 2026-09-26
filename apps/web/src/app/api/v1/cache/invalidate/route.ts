/**
 * Cache Invalidation API — инвалидация кэша
 * 
 * POST /api/v1/cache/invalidate
 * Body: { tag?: string, key?: string }
 * 
 * Инвалидирует кэш по тегу или ключу
 */

import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';
import { withErrorHandling, apiSuccess, ValidationError } from '@/lib/errors';
import { addVersionHeaders } from '@/lib/api-versioning';
import { withAuth } from '@/lib/auth-guard';

export const POST = withAuth({ minRole: 'admin' })(withErrorHandling(async (request: Request) => {
  const body = await request.json();
  
  if (!body.tag && !body.key) {
    throw new ValidationError('Необхідно вказати tag або key');
  }
  
  let deleted = 0;
  
  if (body.tag) {
    deleted = cache.invalidateByTag(body.tag);
  } else if (body.key) {
    const existed = cache.delete(body.key);
    deleted = existed ? 1 : 0;
  }
  
  const response = apiSuccess({ deleted, tag: body.tag, key: body.key });
  return addVersionHeaders(response, 'v1');
}));
