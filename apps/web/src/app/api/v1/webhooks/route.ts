/**
 * Webhooks API — управление вебхуками
 * 
 * GET /api/v1/webhooks — список вебхуков
 * POST /api/v1/webhooks — создать вебхук
 */

import { NextResponse } from 'next/server';
import { withErrorHandling, apiSuccess, ValidationError } from '@/lib/errors';
import { addVersionHeaders } from '@/lib/api-versioning';
import { registerWebhook, getWebhooks, WEBHOOK_EVENTS } from '@/lib/webhooks';
import { extractUserId } from '@/lib/auth-utils';
import { prisma } from '@crm-next/database';

export const GET = withErrorHandling(async (request: Request) => {
  const userId = await extractUserId(request as any);
  if (!userId) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const member = await prisma.tenantMember.findFirst({
    where: { userId },
    select: { tenantId: true },
  });

  if (!member) {
    return NextResponse.json({ error: 'Тенант не знайдено' }, { status: 404 });
  }

  const webhooks = getWebhooks(member.tenantId);
  
  const response = apiSuccess({
    webhooks: webhooks.map(w => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.createdAt,
      // Не возвращаем secret!
    })),
    availableEvents: Object.entries(WEBHOOK_EVENTS).map(([event, description]) => ({
      event,
      description,
    })),
  });
  
  return addVersionHeaders(response, 'v1');
});

export const POST = withErrorHandling(async (request: Request) => {
  const userId = await extractUserId(request as any);
  if (!userId) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const member = await prisma.tenantMember.findFirst({
    where: { userId },
    select: { tenantId: true },
  });

  if (!member) {
    return NextResponse.json({ error: 'Тенант не знайдено' }, { status: 404 });
  }

  const body = await request.json();
  
  if (!body.url || !body.events?.length) {
    throw new ValidationError('Необхідно вказати url та events');
  }

  // Генерируем секрет для подписи
  const secret = `whsec_${require('crypto').randomBytes(32).toString('hex')}`;

  const webhook = registerWebhook({
    tenantId: member.tenantId,
    url: body.url,
    secret,
    events: body.events,
    active: body.active !== false,
  });

  const response = apiSuccess({
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    secret, // Показываем только при создании!
    active: webhook.active,
    createdAt: webhook.createdAt,
  }, 201);
  
  return addVersionHeaders(response, 'v1');
});
