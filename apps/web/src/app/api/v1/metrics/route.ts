/**
 * Metrics API — метрики в формате Prometheus
 *
 * GET /api/v1/metrics — все метрики в формате Prometheus
 * GET /api/v1/metrics?format=json — метрики в JSON
 */

import { addVersionHeaders } from '@/lib/api-versioning';
import { withAuth } from '@/lib/auth-guard';
import { withErrorHandling, apiSuccess } from '@/lib/errors';
import { metrics, recordSystemMetrics } from '@/lib/observability/metrics';

export const GET = withAuth({ minRole: 'admin' })(
  withErrorHandling(async (request: Request) => {
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
  }),
);
