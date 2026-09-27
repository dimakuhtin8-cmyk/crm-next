/**
 * AI chat sessions — постоянные сессии Copilot с историей.
 * POST /api/ai/sessions — новая сессия текущего пользователя
 * GET /api/ai/sessions — список своих сессий (updatedAt desc)
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { extractUserId } from '@/lib/auth-utils';
import { getTenantQuery } from '@/lib/tenant-query';

async function POSTHandler(request: NextRequest) {
  const tq = await getTenantQuery(request);
  if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  const userId = await extractUserId(request);
  if (!userId) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

  const session = await prisma.aiChatSession.create({
    data: { tenantId: tq.tenantId, userId },
  });
  return NextResponse.json({ session }, { status: 201 });
}

async function GETHandler(request: NextRequest) {
  const tq = await getTenantQuery(request);
  if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  const userId = await extractUserId(request);
  if (!userId) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

  const sessions = await prisma.aiChatSession.findMany({
    where: { tenantId: tq.tenantId, userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    take: 50,
  });
  return NextResponse.json({ sessions });
}

export const POST = withAuth({ permission: 'ai:use' })(POSTHandler);
export const GET = withAuth({ permission: 'ai:use' })(GETHandler);
