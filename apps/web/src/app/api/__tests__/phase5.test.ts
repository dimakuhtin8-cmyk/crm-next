/**
 * ФАЗА 5 (регрессии): интеграционный тест
 *
 * Это интеграционный тест (реальный route handler + реальная БД + JWT).
 * Stripe-сеть не используется: подпись генерируется локально через
 * stripe.webhooks.generateTestHeaderString, события выбраны так, чтобы
 * обработка не делала сетевых вызовов (invoice.paid/failed, unhandled).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');
const STRIPE_TEST_SECRET = 'whsec_phase5_test';

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(SECRET);
}

import { POST as webhookPOST } from '@/app/api/billing/webhook/route';
import { POST as aiPOST } from '@/app/api/ai/route';
import { POST as aiQuickSetupPOST } from '@/app/api/ai/quick-setup/route';
import { getStripe } from '@/lib/billing/stripe';

const BASE = 'http://localhost:3000';

let tenantId = '';
let tokenViewer = '';
const OLD_SK = process.env.STRIPE_SECRET_KEY;
const OLD_WS = process.env.STRIPE_WEBHOOK_SECRET;

function signedWebhookRequest(payload: object): NextRequest {
  const raw = JSON.stringify(payload);
  const header = getStripe().webhooks.generateTestHeaderString({
    payload: raw,
    secret: STRIPE_TEST_SECRET,
  });
  return new NextRequest(new URL(`${BASE}/api/billing/webhook`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': header },
    body: raw,
  });
}

function invoiceEvent(eventId: string, type: string, invoiceId: string) {
  return {
    id: eventId,
    object: 'event',
    type,
    data: {
      object: {
        id: invoiceId,
        object: 'invoice',
        metadata: { tenantId },
        subscription: 'sub_phase5',
        amount_paid: 1000,
        amount_due: 1000,
        currency: 'usd',
        hosted_invoice_url: null,
      },
    },
  };
}

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_phase5_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_TEST_SECRET;

  await prisma.payment.deleteMany();
  await prisma.stripeWebhookEvent.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const t = await prisma.tenant.create({
    data: { name: 'P5 Tenant', slug: 'p5-tenant', plan: 'professional', subscriptionId: 'sub_phase5', subscriptionStatus: 'active' },
  });
  tenantId = t.id;
  const v = await prisma.user.create({ data: { email: 'p5-viewer@test.com', name: 'Viewer' } });
  await prisma.tenantMember.create({ data: { userId: v.id, tenantId, role: 'viewer' } });
  tokenViewer = await createToken({ id: v.id, tenantId });
});

afterAll(async () => {
  if (OLD_SK === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = OLD_SK;
  if (OLD_WS === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = OLD_WS;

  await prisma.payment.deleteMany();
  await prisma.stripeWebhookEvent.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('Ф5.1: Stripe webhook idempotency (без сети)', () => {
  it('invoice.paid дважды → 1 платёж, второй ответ idempotent:true', async () => {
    const evt = invoiceEvent('evt_p5_1', 'invoice.paid', 'in_p5_1');

    const r1 = await webhookPOST(signedWebhookRequest(evt));
    expect(r1.status).toBe(200);
    expect((await r1.json()).received).toBe(true);

    const r2 = await webhookPOST(signedWebhookRequest(evt));
    expect(r2.status).toBe(200);
    expect((await r2.json()).idempotent).toBe(true);

    const payments = await prisma.payment.findMany({ where: { tenantId, stripeInvoiceId: 'in_p5_1' } });
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('succeeded');
    expect(payments[0].amount).toBe(1000);
  });

  it('invoice.payment_failed дважды → 1 запись failed, повтор не дублирует', async () => {
    const evt = invoiceEvent('evt_p5_2', 'invoice.payment_failed', 'in_p5_2');

    expect((await webhookPOST(signedWebhookRequest(evt))).status).toBe(200);
    expect((await webhookPOST(signedWebhookRequest(evt))).status).toBe(200);

    const payments = await prisma.payment.findMany({ where: { tenantId, stripeInvoiceId: 'in_p5_2' } });
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('failed');

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { subscriptionStatus: true } });
    expect(tenant?.subscriptionStatus).toBe('past_due');
  });

  it('неизвестный тип события дважды → completed, затем skip как дубль', async () => {
    const evt = { id: 'evt_p5_3', object: 'event', type: 'account.updated', data: { object: { id: 'acct_1' } } };

    const r1 = await webhookPOST(signedWebhookRequest(evt));
    expect(r1.status).toBe(200);

    const rec = await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: 'evt_p5_3' } });
    expect(rec?.status).toBe('completed');

    const r2 = await webhookPOST(signedWebhookRequest(evt));
    expect((await r2.json()).idempotent).toBe(true);
  });

  it('подпись от чужого секрета → 400/403, событие не записано', async () => {
    const raw = JSON.stringify(invoiceEvent('evt_p5_4', 'invoice.paid', 'in_p5_4'));
    const badHeader = getStripe().webhooks.generateTestHeaderString({ payload: raw, secret: 'whsec-wrong' });
    const req = new NextRequest(new URL(`${BASE}/api/billing/webhook`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': badHeader },
      body: raw,
    });
    const r = await webhookPOST(req);
    expect([400, 403]).toContain(r.status);

    const rec = await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: 'evt_p5_4' } });
    expect(rec).toBeNull();
  });
});

describe('Ф5.2: AI-guards не сломаны (viewer → 403 живым запросом)', () => {
  function postWith(path: string, body: unknown): NextRequest {
    return new NextRequest(new URL(`${BASE}${path}?tenantId=${tenantId}`), {
      method: 'POST',
      headers: { cookie: `authjs.session-token=${tokenViewer}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('viewer POST /api/ai → 403 (нужен ai:use)', async () => {
    const r = await aiPOST(postWith('/api/ai', { action: 'kp', data: {} }));
    expect(r.status).toBe(403);
  });

  it('viewer POST /api/ai/quick-setup → 403 (нужен settings:update)', async () => {
    const r = await aiQuickSetupPOST(postWith('/api/ai/quick-setup', { apiKey: 'x', provider: 'openai' }));
    expect(r.status).toBe(403);
  });
});
