import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/activity — Activity timeline (all activities across contacts)
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const contactId = searchParams.get('contactId') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (contactId) where.contactId = contactId;

    const [activities, total] = await Promise.all([
      (tq as unknown as { activity: { findMany: (args: { where: Record<string, unknown>; orderBy: Record<string, string>; skip: number; take: number }) => Promise<unknown[]> } }).activity.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      (tq as unknown as { activity: { count: (args: { where: Record<string, unknown> }) => Promise<number> } }).activity.count({ where }),
    ]);

    return NextResponse.json({ activities, total, page, limit });
  } catch (error) {
    console.error('Activity timeline error:', error);
    return NextResponse.json({ error: 'Помилка отримання активностей' }, { status: 500 });
  }
}
