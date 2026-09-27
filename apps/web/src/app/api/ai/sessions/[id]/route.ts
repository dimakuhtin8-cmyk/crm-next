/**
 * GET /api/ai/sessions/[id] — сообщения сессии (только своя, IDOR-safe).
 * DELETE /api/ai/sessions/[id] — удаление сессии + каскад сообщений.
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { extractUserId } from '@/lib/auth-utils';
import { getTenantQuery } from '@/lib/tenant-query';

async function scopedSession(tenantId: string, userId: string, id: string) {
  // findFirst со скоупом, НЕ findUnique({ id }) — иначе IDOR.
  return prisma.aiChatSession.findFirst({ where: { id, tenantId, userId } });
}

async function GETHandler(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  const tq = await getTenantQuery(request);
  if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  const userId = await extractUserId(request);
  if (!userId) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

  const { id } = await params;
  const session = await scopedSession(tq.tenantId, userId, id);
  if (!session) return NextResponse.json({ error: 'Сесію не знайдено' }, { status: 404 });

  const messages = await prisma.aiChatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, groundedOn: true, createdAt: true },
  });
  return NextResponse.json({ session, messages });
}

async function DELETEHandler(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  const tq = await getTenantQuery(request);
  if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  const userId = await extractUserId(request);
  if (!userId) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

  const { id } = await params;
  // Tenant/user-scoped delete: чужое удалить нельзя (count 0 → 404).
  const res = await prisma.aiChatSession.deleteMany({
    where: { id, tenantId: tq.tenantId, userId },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: 'Сесію не знайдено' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}

export const GET = withAuth({ permission: 'ai:use' })(GETHandler);
export const DELETE = withAuth({ permission: 'ai:use' })(DELETEHandler);
