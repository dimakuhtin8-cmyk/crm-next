/**
 * SLO API — Service Level Objectives
 * 
 * GET /api/v1/slo — статус SLO
 * GET /api/v1/slo/dashboard — данные для дашборда
 */

import { NextResponse } from 'next/server';
import { sloMonitor, getSLODashboardData, checkAlerts } from '@/lib/observability/slo';
import { withErrorHandling, apiSuccess } from '@/lib/errors';
import { addVersionHeaders } from '@/lib/api-versioning';
import { withAuth } from '@/lib/auth-guard';

export const GET = withAuth()(withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  
  if (url.pathname.endsWith('/dashboard')) {
    const data = getSLODashboardData();
    const response = apiSuccess(data);
    return addVersionHeaders(response, 'v1');
  }

  const status = sloMonitor.getSLOStatus();
  const alerts = checkAlerts();
  
  const response = apiSuccess({
    ...status,
    alerts: alerts.map(a => ({
      name: a.name,
      severity: a.severity,
      message: a.message,
    })),
  });
  
  return addVersionHeaders(response, 'v1');
}));
