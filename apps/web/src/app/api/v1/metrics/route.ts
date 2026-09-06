/**
 * Metrics API — метрики в формате Prometheus
 * 
 * GET /api/v1/metrics — все метрики в формате Prometheus
 * GET /api/v1/metrics?format=json — метрики в JSON
 */

import { NextResponse } from 'next/server';
import { metrics, recordSystemMetrics } from '@/lib/observability/metrics';
import { withErrorHandling, apiSuccess } from '@/lib/errors';
import { addVersionHeaders } from '@/lib/api-versioning';
import { withAuth } from '@/lib/auth-guard';

export const GET = withAuth()(withErrorHandling(async (request: Request) => {
  // Обновляем системные метрики перед выдачей
  recordSystemMetrics();

  const url = new URL(request.url);
  const format = url.searchParams.get('format');

  if (format === 'json') {
    const data = metrics.toJSON();
    const response = apiSuccess(data);
    return addVersionHeaders(response, 'v1');
  }

  // По умолчанию — Prometheus формат
  const prometheus = metrics.toPrometheus();
  
  return new Response(prometheus, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    },
  });
}));
