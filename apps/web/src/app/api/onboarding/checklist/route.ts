/**
 * GET /api/onboarding/checklist — «Перші кроки» для нового тенанта.
 * Готовность шагов вычисляется из данных (без новой таблицы):
 * контакты, сделки, Telegram, AI-ключ, >1 участника.
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { getTenantQuery } from '@/lib/tenant-query';

async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const [contactCount, dealCount, memberCount, aiKeyCount, tenant] = await Promise.all([
      prisma.contact.count({ where: { tenantId: tq.tenantId } }),
      prisma.deal.count({ where: { tenantId: tq.tenantId } }),
      prisma.tenantMember.count({ where: { tenantId: tq.tenantId } }),
      prisma.aiProviderKey.count({ where: { tenantId: tq.tenantId } }),
      prisma.tenant.findUnique({
        where: { id: tq.tenantId },
        select: { telegramBotToken: true, aiApiKey: true, geminiApiKey: true },
      }),
    ]);

    return NextResponse.json({
      hasContacts: contactCount > 0,
      hasDeals: dealCount > 0,
      telegramConnected: !!tenant?.telegramBotToken,
      aiConnected: aiKeyCount > 0 || !!tenant?.aiApiKey || !!tenant?.geminiApiKey,
      hasTeammates: memberCount > 1,
    });
  } catch (error) {
    console.error('Checklist error:', error);
    return NextResponse.json({ error: 'Помилка' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
