/**
 * ФАЗА 3 (сломанный код): интеграционный тест
 *
 * Смешанный файл, тип указан перед каждым describe:
 * - webhooks signature: юнит-тест (чистые crypto-функции) + доказательство компиляции (tsc)
 * - analytics GET: интеграционный тест (реальный handler + БД + JWT)
 * - stripe exports: юнит-тест (импорт/сигнатура без сети)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(SECRET);
}

function makeRequest(url: string, token: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `authjs.session-token=${token}`;
  return new NextRequest(new URL(url), { headers });
}

import { createWebhookSignature, verifyWebhookSignature } from '@/lib/webhooks';
import { GET as analyticsGET } from '@/app/api/analytics/route';
import { getStripe, getUpcomingInvoice, verifyWebhook } from '@/lib/billing/stripe';

const BASE = 'http://localhost:3000';

describe('ФАЗА 3.1: webhooks signature (юнит-тест чистых функций)', () => {
  it('round-trip: подпись со свежим timestamp валидна, подделанная — нет', async () => {
    const secret = 'whsec-phase3';
    const payload = JSON.stringify({ hello: 'world' });

    const { timestamp: ts, signature: sig } = createWebhookSignature(payload, secret);
    expect(verifyWebhookSignature(payload, `t=${ts},s=${sig}`, secret)).toEqual({ valid: true });
    expect(verifyWebhookSignature(payload, `t=${ts},s=${'0'.repeat(64)}`, secret).valid).toBe(false);
    expect(verifyWebhookSignature(payload, 'garbage', secret).valid).toBe(false);
    // просроченный timestamp → anti-replay
    expect(verifyWebhookSignature(payload, `t=${ts - 3600},s=${sig}`, secret).valid).toBe(false);
  });
});

describe('ФАЗА 3.2: stripe exports (юнит-тест без сети)', () => {
  it('getStripe экспортируется (нужен webhook-роуту)', () => {
    expect(typeof getStripe).toBe('function');
  });

  it('verifyWebhook без секрета бросает понятную ошибку, а не TypeError', () => {
    expect(() => verifyWebhook('{}', 'sig')).toThrow('STRIPE_WEBHOOK_SECRET');
  });

  it('getUpcomingInvoice без подписки у тенанта → null (без обращения к Stripe)', async () => {
    const t = await prisma.tenant.create({ data: { name: 'P3 Stripe', slug: 'p3-stripe', plan: 'free' } });
    try {
      await expect(getUpcomingInvoice(t.id)).resolves.toBeNull();
    } finally {
      await prisma.tenant.delete({ where: { id: t.id } });
    }
  });
});

describe('ФАЗА 3.3: analytics GET (интеграционный тест)', () => {
  let tenantId = '';
  let token = '';
  let managerId = '';

  beforeAll(async () => {
    await prisma.task.deleteMany();
    await prisma.deal.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.pipelineStage.deleteMany();
    await prisma.pipeline.deleteMany();
    await prisma.tenantMember.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

    const t = await prisma.tenant.create({ data: { name: 'P3 Analytics', slug: 'p3-analytics', plan: 'professional' } });
    tenantId = t.id;
    const owner = await prisma.user.create({ data: { email: 'p3-owner@test.com', name: 'Owner' } });
    const manager = await prisma.user.create({ data: { email: 'p3-manager@test.com', name: 'Менеджер' } });
    managerId = manager.id;
    await prisma.tenantMember.create({ data: { userId: owner.id, tenantId, role: 'owner' } });
    await prisma.tenantMember.create({ data: { userId: manager.id, tenantId, role: 'member' } });
    token = await createToken({ id: owner.id, tenantId });

    await prisma.contact.create({ data: { tenantId, firstName: 'Контакт' } });
    const pipe = await prisma.pipeline.create({ data: { tenantId, name: 'Пайп' } });
    const stage = await prisma.pipelineStage.create({ data: { pipelineId: pipe.id, name: 'Виграно', order: 0 } });
    const deal = await prisma.deal.create({
      data: { tenantId, pipelineId: pipe.id, stageId: stage.id, title: 'Угода', value: 1000, status: 'won' },
    });
    await prisma.task.create({
      data: { tenantId, title: 'Дзвінок', status: 'done', assigneeId: manager.id, dealId: deal.id },
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany();
    await prisma.deal.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.pipelineStage.deleteMany();
    await prisma.pipeline.deleteMany();
    await prisma.tenantMember.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
  });

  it('GET /api/analytics?period=30 → 200, topManagers содержит менеджера (было 500)', async () => {
    const r = await analyticsGET(makeRequest(`${BASE}/api/analytics?period=30&tenantId=${tenantId}`, token));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.stats.wonDeals).toBe(1);
    expect(body.stats.totalRevenue).toBe(1000);
    expect(Array.isArray(body.topManagers)).toBe(true);
    expect(body.topManagers.length).toBe(1);
    expect(body.topManagers[0].id).toBe(managerId);
    expect(body.topManagers[0].deals).toBe(1);
    expect(body.topManagers[0].revenue).toBe(1000);
  });
});
