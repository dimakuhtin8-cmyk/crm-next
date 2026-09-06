/**
 * GET /api/ai/logs — Get AI request logs with pagination and filters
 *
 * Query params: page, limit, provider, status, from, to
 * Returns: { logs, total, page, limit }
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';
import { getAiLogs } from '@/lib/ai/usage';

async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const provider = searchParams.get('provider') || undefined;
    const status = searchParams.get('status') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    const result = await getAiLogs(tq.tenantId, {
      page,
      limit: Math.min(limit, 100),
      provider,
      status,
      from,
      to,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('AI logs error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання логів' },
      { status: 500 }
    );
  }
}

export const GET = withAuth()(GETHandler);
