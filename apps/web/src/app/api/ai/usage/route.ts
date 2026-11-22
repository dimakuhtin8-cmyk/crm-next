/**
 * GET /api/ai/usage — Get AI usage statistics
 *
 * Returns: { today, month, byProvider, recentLogs }
 */

import { NextResponse } from 'next/server';

import { getUsageStats, checkUsageLimit } from '@/lib/ai/usage';
import { withAuth } from '@/lib/auth-guard';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

import type { NextRequest } from 'next/server';

async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const [stats, limitStatus] = await Promise.all([
      getUsageStats(tq.tenantId),
      checkUsageLimit(tq.tenantId, 'gemini'), // Check primary provider
    ]);

    return NextResponse.json({
      ...stats,
      limitStatus,
    });
  } catch (error) {
    console.error('Usage stats error:', error);
    return NextResponse.json({ error: 'Помилка отримання статистики' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
