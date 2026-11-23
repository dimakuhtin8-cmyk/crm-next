/**
 * Outgoing webhooks — інтеграційний тест (реальні route handlers + реальна БД crm_test).
 * Паттерн скопійовано з contacts/__tests__/datafilter.test.ts.
 *
 * Зовнішні HTTP-доставки мокаються через vi.stubGlobal('fetch', ...) —
 * реальні мережеві запити під час тестів заборонені.
 */

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';

import { POST as createContact } from '@/app/api/contacts/route';
import {
  registerWebhook,
  unregisterWebhook,
  getWebhooks,
  dispatchWebhook,
  createWebhookSignature,
  verifyWebhookSignature,
} from '@/lib/webhooks';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(SECRET);
}

function makeRequest(
  url: string,
  token: string,
  init?: { method?: string; body?: string },
): NextRequest {
  return new NextRequest(new URL(url), {
    method: init?.method ?? 'GET',
    body: init?.body,
    headers: {
      'content-type': 'application/json',
      cookie: `authjs.session-token=${token}`,
    },
  });
}

let tenantId: string;
let adminId: string;

beforeAll(async () => {
  // Cleanup in reverse FK order
  await prisma.webhook.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.dealProduct.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { name: 'Webhook Test Tenant', slug: 'test-webhook-dispatch', plan: 'professional' },
  });
  tenantId = tenant.id;

  const admin = await prisma.user.create({
    data: { email: 'admin-webhooks@test.com', name: 'Webhook Admin' },
  });
  adminId = admin.id;
  await prisma.tenantMember.create({
    data: { userId: adminId, tenantId, role: 'admin' },
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.webhook.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.dealProduct.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

beforeEach(async () => {
  await prisma.webhook.deleteMany({ where: { tenantId } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Webhook registry — Prisma persistence', () => {
  it('registerWebhook persists the webhook (visible after re-read via prisma)', async () => {
    const registered = await registerWebhook({
      tenantId,
      url: 'https://hooks.test/persist',
      secret: 'whsec_persist',
      events: ['contact.created'],
      active: true,
    });

    expect(registered.id).toBeTruthy();
    expect(registered.createdAt).toBeInstanceOf(Date);

    // Re-read straight from the DB — nothing in-memory survives here
    const reread = await prisma.webhook.findUnique({ where: { id: registered.id } });
    expect(reread).not.toBeNull();
    expect(reread?.url).toBe('https://hooks.test/persist');
    expect(reread?.secret).toBe('whsec_persist');
    expect(reread?.events).toEqual(['contact.created']);
    expect(reread?.active).toBe(true);

    const listed = await getWebhooks(tenantId);
    expect(listed.some((w) => w.id === registered.id)).toBe(true);
  });

  it('unregisterWebhook deletes the webhook and enforces tenant ownership', async () => {
    const registered = await registerWebhook({
      tenantId,
      url: 'https://hooks.test/unregister',
      secret: 'whsec_unregister',
      events: ['deal.updated'],
      active: true,
    });

    // Foreign tenant cannot delete it
    await expect(unregisterWebhook('some-other-tenant', registered.id)).resolves.toBe(false);
    expect(await prisma.webhook.findUnique({ where: { id: registered.id } })).not.toBeNull();

    // Owner tenant can
    await expect(unregisterWebhook(tenantId, registered.id)).resolves.toBe(true);
    expect(await prisma.webhook.findUnique({ where: { id: registered.id } })).toBeNull();
  });
});

describe('dispatchWebhook — delivery on data changes', () => {
  it('contact create delivers to the subscribed URL with event header and valid signature', async () => {
    const secret = 'whsec_delivery';
    await registerWebhook({
      tenantId,
      url: 'https://hooks.test/deliver',
      secret,
      events: ['contact.created'],
      active: true,
    });

    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const token = await createToken({ id: adminId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/contacts?tenantId=${tenantId}`, token, {
      method: 'POST',
      body: JSON.stringify({ firstName: 'Webhook', lastName: 'Delivery', email: 'hook@test.com' }),
    });

    const response = await createContact(req);
    expect(response.status).toBe(201);
    const { contact } = await response.json();

    // Fire-and-forget: delivery runs after the API call returns
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://hooks.test/deliver');
    expect(init.method).toBe('POST');
    expect(headers['X-Webhook-Event']).toBe('contact.created');

    const body = init.body as string;
    const payload = JSON.parse(body);
    expect(payload.event).toBe('contact.created');
    expect(payload.data.id).toBe(contact.id);
    expect(payload.data.tenantId).toBe(tenantId);

    // Signature must verify against the delivered body…
    const signature = headers['X-Webhook-Signature'];
    expect(verifyWebhookSignature(body, signature, secret).valid).toBe(true);
    expect(verifyWebhookSignature(body, signature, 'whsec_wrong').valid).toBe(false);

    // …and match a locally recomputed signature
    const timestamp = parseInt(signature.split(',')[0].replace('t=', ''), 10);
    const expected = createWebhookSignature(body, secret, timestamp);
    expect(signature).toBe(`t=${expected.timestamp},s=${expected.signature}`);
  });

  it('events the webhook is not subscribed to are not delivered', async () => {
    await registerWebhook({
      tenantId,
      url: 'https://hooks.test/only-tasks',
      secret: 'whsec_only_tasks',
      events: ['task.created'],
      active: true,
    });

    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const deliveries = await dispatchWebhook(tenantId, 'contact.created', {
      id: 'unrelated',
      tenantId,
    });

    expect(deliveries).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('inactive webhooks are not delivered', async () => {
    await registerWebhook({
      tenantId,
      url: 'https://hooks.test/inactive',
      secret: 'whsec_inactive',
      events: ['contact.created'],
      active: false,
    });

    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const deliveries = await dispatchWebhook(tenantId, 'contact.created', {
      id: 'unrelated',
      tenantId,
    });

    expect(deliveries).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delivery failure never fails the API call', async () => {
    await registerWebhook({
      tenantId,
      url: 'https://hooks.test/broken',
      secret: 'whsec_broken',
      events: ['contact.created'],
      active: true,
    });

    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const token = await createToken({ id: adminId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/contacts?tenantId=${tenantId}`, token, {
      method: 'POST',
      body: JSON.stringify({ firstName: 'NoDelivery' }),
    });

    const response = await createContact(req);

    // The DB write + response are unaffected by the broken webhook
    expect(response.status).toBe(201);
    const { contact } = await response.json();
    await expect(prisma.contact.findUnique({ where: { id: contact.id } })).resolves.toMatchObject({
      firstName: 'NoDelivery',
    });

    // Delivery was attempted and failed quietly (console.warn, no throw)
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    warnSpy.mockRestore();
  });
});
