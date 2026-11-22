import { NextResponse } from 'next/server';

import { getAuditLogs } from '@/lib/audit';
import { extractUserId } from '@/lib/auth-utils';
import { hasPermission } from '@/lib/rbac';
import { getTenantQuery } from '@/lib/tenant-query';

import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    // Внимание: getTenantQuery() не содержит userId — берём из сессии
    const userId = await extractUserId(request);
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
