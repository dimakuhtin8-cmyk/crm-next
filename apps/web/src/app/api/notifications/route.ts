/**
 * In-app уведомления.
 *
 * GET  /api/notifications — непрочитанные текущего пользователя (tenant-scoped)
 * PATCH /api/notifications — пометить прочитанными { ids?: string[] } или всё
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { extractUserId } from '@/lib/auth-utils';
import { getTenantQuery } from '@/lib/tenant-query';
import { prisma } from '@crm-next/database';
import { withAuth } from '@/lib/auth-guard';

async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const userId = await extractUserId(request);
    if (!userId) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const unreadOnly = searchParams.get('unread') !== 'false';

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { tenantId, userId, ...(unreadOnly ? { read: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { tenantId, userId, read: false } }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('List notifications error:', error);
    return NextResponse.json({ error: 'Помилка отримання сповіщень' }, { status: 500 });
  }
}

async function PATCHHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const userId = await extractUserId(request);
    if (!userId) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : null;

    const res = await prisma.notification.updateMany({
      where: {
        tenantId,
        userId,
        read: false,
        ...(ids ? { id: { in: ids } } : {}),
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true, marked: res.count });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return NextResponse.json({ error: 'Помилка оновлення сповіщень' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
export const PATCH = withAuth()(PATCHHandler);
