// П2: триал 14 дней подкреплён реализацией.
// Новый тенант получает trialEndsAt ≈ now+14d; пока триал активен —
// лимиты professional; после — free, чтение данных не блокируется.

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { GET as subscriptionGET } from '@/app/api/billing/subscription/route';
import { GET as contactsGET } from '@/app/api/contacts/route';
import { POST as tenantsPOST } from '@/app/api/tenants/route';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(SECRET);
}

function authed(url: string, token: string | null, body?: unknown): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `authjs.session-token=${token}`;
  if (body) headers['content-type'] = 'application/json';
  return new NextRequest(new URL(url), {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? (JSON.stringify(body) as BodyInit) : undefined,
  });
}

const BASE = 'http://localhost:3000';
let userId = '';
let userToken = '';
let tenantId = '';

beforeAll(async () => {
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const u = await prisma.user.create({ data: { email: 'trial-owner@test.com', name: 'T' } });
  userId = u.id;
  // Токен без tenantId: тенанта ещё нет (свежая регистрация).
  userToken = await createToken({ id: u.id });
});

afterAll(async () => {
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('П2: триал нового тенанта', () => {
  it('POST /api/tenants ставит trialEndsAt ≈ now+14d и status trialing', async () => {
    const r = await tenantsPOST(
      authed(`${BASE}/api/tenants`, userToken, { name: 'Trial Co', slug: 'trial-co' }),
    );
    expect(r.status).toBe(201);
    const body = await r.json();
    tenantId = body.tenant.id;

    const row = await prisma.tenant.findUnique({ where: { id: tenantId } });
    expect(row?.subscriptionStatus).toBe('trialing');
    const diffDays = (row!.trialEndsAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(13);
    expect(diffDays).toBeLessThanOrEqual(14);
  });

  it('subscription: isTrial + professional-лимиты во время триала', async () => {
    const token = await createToken({ id: userId, tenantId });
    const r = await subscriptionGET(
      authed(`${BASE}/api/billing/subscription?tenantId=${tenantId}`, token),
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.subscription.isTrial).toBe(true);
    expect(body.subscription.trialDaysLeft).toBeGreaterThan(0);
    // Professional: maxContacts 10000 (free: 100) — проверяем, что это не free.
    expect(body.limits.maxContacts).toBe(10000);
  });

  it('истёкший триал: free-лимиты, но чтение данных доступно', async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const token = await createToken({ id: userId, tenantId });
    const r = await subscriptionGET(
      authed(`${BASE}/api/billing/subscription?tenantId=${tenantId}`, token),
    );
    const body = await r.json();
    expect(body.subscription.isTrial).toBe(false);
    expect(body.limits.maxContacts).toBe(100); // free-план

    // Чтение не заблокировано.
    const c = await contactsGET(authed(`${BASE}/api/contacts?tenantId=${tenantId}`, token));
    expect(c.status).toBe(200);
  });
});
