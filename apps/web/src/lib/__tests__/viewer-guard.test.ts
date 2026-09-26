/**
 * P3: viewer vs mutating routes — 4 интеграционных теста
 *
 * Тип: интеграционный тест (реальный route handler + реальная БД + JWT)
 *
 * Для каждого эндпоинта: создаём viewer, делаем POST, ожидаем 403.
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

function makePostRequest(url: string, token: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(url), {
    method: 'POST',
    headers: {
      cookie: `authjs.session-token=${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// Import route handlers
import { POST as bulkPOST } from '@/app/api/contacts/bulk/route';
import { POST as checkoutPOST } from '@/app/api/billing/checkout/route';
import { POST as rulesPOST } from '@/app/api/automation/rules/route';
import { POST as templatesPOST } from '@/app/api/documents/templates/route';

let viewerId: string;
let tenantId: string;
let viewerToken: string;

beforeAll(async () => {
  // Cleanup
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { name: 'P3 Test Tenant', slug: 'p3-viewer-test', plan: 'professional' },
  });
  tenantId = tenant.id;

  const viewer = await prisma.user.create({
    data: { email: 'p3-viewer@test.com', name: 'P3 Viewer', role: 'user' },
  });
  viewerId = viewer.id;

  await prisma.tenantMember.create({
    data: { userId: viewerId, tenantId, role: 'viewer' },
  });

  viewerToken = await createToken({ id: viewerId, tenantId });
});

afterAll(async () => {
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('P3: viewer cannot access mutating routes (integration)', () => {
  it('POST /api/contacts/bulk → 403 (requires contact:update)', async () => {
    const req = makePostRequest(
      `http://localhost:3000/api/contacts/bulk?tenantId=${tenantId}`,
      viewerToken,
      { action: 'delete', contactIds: [] }
    );

    const response = await bulkPOST(req);
    expect(response.status).toBe(403);
  });

  it('POST /api/billing/checkout → 403 (requires tenant:billing)', async () => {
    const req = makePostRequest(
      `http://localhost:3000/api/billing/checkout?tenantId=${tenantId}`,
      viewerToken,
      { planId: 'professional' }
    );

    const response = await checkoutPOST(req);
    expect(response.status).toBe(403);
  });

  it('POST /api/automation/rules → 403 (requires settings:update)', async () => {
    const req = makePostRequest(
      `http://localhost:3000/api/automation/rules?tenantId=${tenantId}`,
      viewerToken,
      {
        name: 'Test Rule',
        triggerType: 'deal_created',
        actionType: 'send_notification',
        actionConfig: {},
      }
    );

    const response = await rulesPOST(req);
    expect(response.status).toBe(403);
  });

  it('POST /api/documents/templates → 403 (requires settings:update)', async () => {
    const req = makePostRequest(
      `http://localhost:3000/api/documents/templates?tenantId=${tenantId}`,
      viewerToken,
      { name: 'Test Template', content: 'test', type: 'email' }
    );

    const response = await templatesPOST(req);
    expect(response.status).toBe(403);
  });
});
