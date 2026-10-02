import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { getAuditLogs } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';
import { getTenantQuery } from '@/lib/tenant-query';

export async function GET(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const userId = (tq as Record<string, unknown>).userId as string;
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Only admin+ can read audit logs
    const allowed = await hasPermission(userId, tq.tenantId, 'audit:read');
    if (!allowed) {
      return NextResponse.json({ error: 'Недостатньо прав' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action') || undefined;
    const entity = searchParams.get('entity') || undefined;
    const userIdFilter = searchParams.get('userId') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const q = searchParams.get('q') || undefined;

    const result = await getAuditLogs(tq.tenantId, {
      page,
      limit,
      action,
      entity,
      userId: userIdFilter,
      from,
      to,
      q,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json({ error: 'Помилка завантаження журналу' }, { status: 500 });
  }
}
