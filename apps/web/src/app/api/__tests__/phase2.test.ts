/**
 * ФАЗА 2 (открытые двери): интеграционный тест
 *
 * Это интеграционный тест (реальный route handler + реальная БД + JWT).
 */

import { createHmac } from 'crypto';

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(SECRET);
}

function makeRequest(url: string, token: string | null, init?: RequestInit): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `authjs.session-token=${token}`;
  if (init?.body) headers['content-type'] = 'application/json';
  return new NextRequest(new URL(url), {
    method: init?.method || 'GET',
    headers,
    body: init?.body as BodyInit | null | undefined,
  });
}

import { GET as aiLogsGET } from '@/app/api/ai/logs/route';
import { POST as twoFaPOST } from '@/app/api/auth/2fa/route';
import { GET as automationLogsGET } from '@/app/api/automation/logs/route';
import { GET as queueJobsGET } from '@/app/api/queue/jobs/route';
import { PUT as dbPUT, POST as dbPOST } from '@/app/api/tenant/database/route';
import {
  PUT as membersPUT,
  DELETE as membersDELETE,
} from '@/app/api/tenants/[id]/members/[memberId]/route';
import { POST as cacheInvalidatePOST } from '@/app/api/v1/cache/invalidate/route';
import { GET as cacheStatsGET } from '@/app/api/v1/cache/stats/route';
import { GET as metricsGET } from '@/app/api/v1/metrics/route';
import { GET as queueStatsGET, DELETE as queueStatsDELETE } from '@/app/api/v1/queue/stats/route';
import { GET as sloGET } from '@/app/api/v1/slo/route';
import { GET as webhooksGET } from '@/app/api/v1/webhooks/route';
import { POST as waWebhookPOST } from '@/app/api/whatsapp/webhook/route';
import { decrypt, isEncrypted } from '@/lib/encryption';
import { generateTOTP } from '@/lib/totp';

const BASE = 'http://localhost:3000';
const mctx = (id: string, memberId: string) => ({ params: Promise.resolve({ id, memberId }) });

let tenant2 = '';
let tenant3 = '';
let tokenOwner = '';
let tokenAdmin = '';
let tokenMember = '';
let tokenViewer = '';
let tokenOwner3 = '';
let tokenAdmin3 = '';
let memberMemberId = '';
let owner3MemberId = '';
let owner3bMemberId = '';

const WA_SECRET = 'whsec-phase2-test-789';

beforeAll(async () => {
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

  const t2 = await prisma.tenant.create({
    data: {
      name: 'Phase2 Tenant',
      slug: 'phase2-tenant',
      plan: 'professional',
      whatsappWebhookSecret: WA_SECRET,
    },
  });
  tenant2 = t2.id;

  const mk = async (email: string, role: string) => {
    const u = await prisma.user.create({ data: { email, name: email } });
    const m = await prisma.tenantMember.create({ data: { userId: u.id, tenantId: tenant2, role } });
    return { u, m };
  };

  const o = await mk('p2-owner@test.com', 'owner');
  await mk('p2-owner2@test.com', 'owner');
  const a = await mk('p2-admin@test.com', 'admin');
  const mb = await mk('p2-member@test.com', 'member');
  const v = await mk('p2-viewer@test.com', 'viewer');
  memberMemberId = mb.m.id;

  tokenOwner = await createToken({ id: o.u.id, tenantId: tenant2 });
  tokenAdmin = await createToken({ id: a.u.id, tenantId: tenant2 });
  tokenMember = await createToken({ id: mb.u.id, tenantId: tenant2 });
  tokenViewer = await createToken({ id: v.u.id, tenantId: tenant2 });

  // Tenant 3: exactly one owner + one admin (last-owner scenarios)
  const t3 = await prisma.tenant.create({
    data: { name: 'Phase2 Solo', slug: 'phase2-solo', plan: 'professional' },
  });
  tenant3 = t3.id;
  const o3 = await prisma.user.create({ data: { email: 'p2-o3@test.com', name: 'O3' } });
  const o3m = await prisma.tenantMember.create({
    data: { userId: o3.id, tenantId: tenant3, role: 'owner' },
  });
  const a3 = await prisma.user.create({ data: { email: 'p2-a3@test.com', name: 'A3' } });
  await prisma.tenantMember.create({ data: { userId: a3.id, tenantId: tenant3, role: 'admin' } });
  owner3MemberId = o3m.id;
  tokenOwner3 = await createToken({ id: o3.id, tenantId: tenant3 });
  tokenAdmin3 = await createToken({ id: a3.id, tenantId: tenant3 });
});

afterAll(async () => {
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

describe('ФАЗА 2.1: v1-API требует авторизацию', () => {
  it('анонимный GET metrics/cache/queue/slo → 401', async () => {
    const anon = (url: string) => makeRequest(url, null);
    expect((await metricsGET(anon(`${BASE}/api/v1/metrics`))).status).toBe(401);
    expect((await cacheStatsGET(anon(`${BASE}/api/v1/cache/stats`))).status).toBe(401);
    expect((await queueStatsGET(anon(`${BASE}/api/v1/queue/stats`))).status).toBe(401);
    expect((await sloGET(anon(`${BASE}/api/v1/slo`))).status).toBe(401);
  });

  it('анонимный POST cache/invalidate и DELETE queue/stats → 401', async () => {
    const r1 = await cacheInvalidatePOST(
      makeRequest(`${BASE}/api/v1/cache/invalidate`, null, {
        method: 'POST',
        body: JSON.stringify({ key: 'x' }),
      }),
    );
    expect(r1.status).toBe(401);
    const r2 = await queueStatsDELETE(
      makeRequest(`${BASE}/api/v1/queue/stats`, null, { method: 'DELETE' }),
    );
    expect(r2.status).toBe(401);
  });

  it('member POST cache/invalidate → 403, admin → 200', async () => {
    const asMember = await cacheInvalidatePOST(
      makeRequest(`${BASE}/api/v1/cache/invalidate`, tokenMember, {
        method: 'POST',
        body: JSON.stringify({ key: 'x' }),
      }),
    );
    expect(asMember.status).toBe(403);

    const asAdmin = await cacheInvalidatePOST(
      makeRequest(`${BASE}/api/v1/cache/invalidate`, tokenAdmin, {
        method: 'POST',
        body: JSON.stringify({ key: 'x' }),
      }),
    );
    expect(asAdmin.status).toBe(200);
  });

  it('авторизованный GET metrics → 200 только для admin+ (viewer → 403)', async () => {
    const asViewer = await metricsGET(makeRequest(`${BASE}/api/v1/metrics`, tokenViewer));
    expect(asViewer.status).toBe(403);
    const asAdmin = await metricsGET(makeRequest(`${BASE}/api/v1/metrics`, tokenAdmin));
    expect(asAdmin.status).toBe(200);
  });

  it('П4.1: member GET admin-раздела → 403 (cache/queue/jobs/logs)', async () => {
    const urls: Array<[string, (r: NextRequest) => Promise<Response>]> = [
      [`${BASE}/api/v1/cache/stats`, cacheStatsGET],
      [`${BASE}/api/v1/queue/stats`, queueStatsGET],
      [`${BASE}/api/queue/jobs`, queueJobsGET],
      [`${BASE}/api/automation/logs`, automationLogsGET],
      [`${BASE}/api/ai/logs`, aiLogsGET],
      [`${BASE}/api/v1/webhooks`, webhooksGET],
    ];
    for (const [url, handler] of urls) {
      const asMember = await handler(makeRequest(url, tokenMember));
      expect(asMember.status).toBe(403);
      const asAdmin = await handler(makeRequest(url, tokenAdmin));
      expect(asAdmin.status).not.toBe(403);
    }
  });
});

describe('ФАЗА 2.2: tenant/database — роль, шифрование, SSRF', () => {
  it('анонимный PUT → 401, viewer/member PUT → 403', async () => {
    const body = { method: 'PUT', body: JSON.stringify({ databaseType: 'shared' }) } as RequestInit;
    expect((await dbPUT(makeRequest(`${BASE}/api/tenant/database`, null, body))).status).toBe(401);
    expect(
      (await dbPUT(makeRequest(`${BASE}/api/tenant/database`, tokenViewer, body))).status,
    ).toBe(403);
    expect(
      (await dbPUT(makeRequest(`${BASE}/api/tenant/database`, tokenMember, body))).status,
    ).toBe(403);
  });

  it('admin PUT shared → 200', async () => {
    const r = await dbPUT(
      makeRequest(`${BASE}/api/tenant/database`, tokenAdmin, {
        method: 'PUT',
        body: JSON.stringify({ databaseType: 'shared' }),
      }),
    );
    expect(r.status).toBe(200);
  });

  it('POST с file:// URL → 400 (SSRF guard), без полей → 400', async () => {
    const evil = await dbPOST(
      makeRequest(`${BASE}/api/tenant/database`, tokenAdmin, {
        method: 'POST',
        body: JSON.stringify({ databaseUrl: 'file:///etc/passwd', databaseType: 'postgresql' }),
      }),
    );
    expect(evil.status).toBe(400);

    const empty = await dbPOST(
      makeRequest(`${BASE}/api/tenant/database`, tokenAdmin, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    expect(empty.status).toBe(400);
  });

  it('PUT сохраняет databaseUrl зашифрованным (iv:tag:ciphertext)', async () => {
    const url = 'postgresql://u:p@127.0.0.1:1/dbname';
    const r = await dbPUT(
      makeRequest(`${BASE}/api/tenant/database`, tokenAdmin, {
        method: 'PUT',
        body: JSON.stringify({ databaseUrl: url, databaseType: 'postgresql' }),
      }),
    );
    expect(r.status).toBe(200);

    const stored = await prisma.tenant.findUnique({
      where: { id: tenant2 },
      select: { databaseUrl: true },
    });
    expect(stored?.databaseUrl).not.toBe(url);
    expect(isEncrypted(stored?.databaseUrl || '')).toBe(true);
    expect(decrypt(stored?.databaseUrl || '')).toBe(url);

    // cleanup: back to shared
    await dbPUT(
      makeRequest(`${BASE}/api/tenant/database`, tokenAdmin, {
        method: 'PUT',
        body: JSON.stringify({ databaseType: 'shared', databaseUrl: null }),
      }),
    );
  });
});

describe('ФАЗА 2.3: members — нет эскалации, последний owner защищён', () => {
  it('admin назначает member→admin → 403 (только owner может)', async () => {
    const r = await membersPUT(
      makeRequest(`${BASE}/api/tenants/${tenant2}/members/${memberMemberId}`, tokenAdmin, {
        method: 'PUT',
        body: JSON.stringify({ role: 'admin' }),
      }),
      mctx(tenant2, memberMemberId),
    );
    expect(r.status).toBe(403);
    const after = await prisma.tenantMember.findUnique({ where: { id: memberMemberId } });
    expect(after?.role).toBe('member');
  });

  it('owner назначает member→admin → 200', async () => {
    const r = await membersPUT(
      makeRequest(`${BASE}/api/tenants/${tenant2}/members/${memberMemberId}`, tokenOwner, {
        method: 'PUT',
        body: JSON.stringify({ role: 'admin' }),
      }),
      mctx(tenant2, memberMemberId),
    );
    expect(r.status).toBe(200);
    const after = await prisma.tenantMember.findUnique({ where: { id: memberMemberId } });
    expect(after?.role).toBe('admin');
  });

  it('admin удаляет единственного owner → запрещено', async () => {
    const r = await membersDELETE(
      makeRequest(`${BASE}/api/tenants/${tenant3}/members/${owner3MemberId}`, tokenAdmin3, {
        method: 'DELETE',
      }),
      mctx(tenant3, owner3MemberId),
    );
    expect([400, 403]).toContain(r.status);
    const after = await prisma.tenantMember.findUnique({ where: { id: owner3MemberId } });
    expect(after).not.toBeNull();
  });

  it('понизить последнего owner → 400 (сначала второй owner — можно)', async () => {
    // добавляем второго owner в tenant3
    const o3b = await prisma.user.create({ data: { email: 'p2-o3b@test.com', name: 'O3b' } });
    const o3bm = await prisma.tenantMember.create({
      data: { userId: o3b.id, tenantId: tenant3, role: 'owner' },
    });
    owner3bMemberId = o3bm.id;

    // owner понижает второго owner → 200 (остаётся один)
    const demote = await membersPUT(
      makeRequest(`${BASE}/api/tenants/${tenant3}/members/${owner3bMemberId}`, tokenOwner3, {
        method: 'PUT',
        body: JSON.stringify({ role: 'member' }),
      }),
      mctx(tenant3, owner3bMemberId),
    );
    expect(demote.status).toBe(200);

    // теперь понизить последнего owner → 400
    const last = await membersPUT(
      makeRequest(`${BASE}/api/tenants/${tenant3}/members/${owner3MemberId}`, tokenOwner3, {
        method: 'PUT',
        body: JSON.stringify({ role: 'member' }),
      }),
      mctx(tenant3, owner3MemberId),
    );
    expect(last.status).toBe(400);
    const after = await prisma.tenantMember.findUnique({ where: { id: owner3MemberId } });
    expect(after?.role).toBe('owner');
  });
});

describe('ФАЗА 2.4: WhatsApp webhook — подпись обязательна', () => {
  const waBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

  it('без подписи → 403, с неверной подписью → 403', async () => {
    const noSig = await waWebhookPOST(
      makeRequest(`${BASE}/api/whatsapp/webhook`, null, { method: 'POST', body: waBody }),
    );
    expect(noSig.status).toBe(403);

    const badSig = new NextRequest(new URL(`${BASE}/api/whatsapp/webhook`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=deadbeef' },
      body: waBody,
    });
    expect((await waWebhookPOST(badSig)).status).toBe(403);
  });

  it('с верной подписью → 200', async () => {
    const sig = 'sha256=' + createHmac('sha256', WA_SECRET).update(waBody).digest('hex');
    const req = new NextRequest(new URL(`${BASE}/api/whatsapp/webhook`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
      body: waBody,
    });
    const r = await waWebhookPOST(req);
    expect(r.status).toBe(200);
  });
});

describe('ФАЗА 2.5: 2FA — setup/confirm/disable через БД', () => {
  const twoFa = (action: string, token: string | null, body?: unknown) =>
    twoFaPOST(
      makeRequest(
        `${BASE}/api/auth/2fa?action=${action}`,
        token,
        body ? { method: 'POST', body: JSON.stringify(body) } : { method: 'POST', body: '{}' },
      ),
    );

  it('setup возвращает base32-секрет и otpauthUrl, БЕЗ рабочего кода; status=false', async () => {
    const r = await twoFa('setup', tokenViewer);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.secret).toMatch(/^[A-Z2-7]+$/);
    expect(data.otpauthUrl).toContain('otpauth://totp/');
    expect(data.currentCode).toBeUndefined();

    const st = await twoFa('status', tokenViewer);
    expect((await st.json()).enabled).toBe(false);
  });

  it('confirm с неверным кодом → 400, не активируется', async () => {
    const setup = await (await twoFa('setup', tokenViewer)).json();
    const correct = generateTOTP(setup.secret);
    // детерминированно неверный код: отличается от верного
    const wrong = correct === '000000' ? '000001' : '000000';
    const r = await twoFa('verify', tokenViewer, { token: wrong });
    expect(r.status).toBe(400);
    const st = await twoFa('status', tokenViewer);
    expect((await st.json()).enabled).toBe(false);
  });

  it('confirm с верным кодом → 200, активируется; disable без токена → 400', async () => {
    const setup = await (await twoFa('setup', tokenViewer)).json();
    const code = generateTOTP(setup.secret);

    const ok = await twoFa('verify', tokenViewer, { token: code });
    expect(ok.status).toBe(200);
    expect((await (await twoFa('status', tokenViewer)).json()).enabled).toBe(true);

    const noToken = await twoFa('disable', tokenViewer, {});
    expect(noToken.status).toBe(400);

    const wrongCode = code === '123456' ? '123457' : '123456';
    const wrong = await twoFa('disable', tokenViewer, { token: wrongCode });
    expect(wrong.status).toBe(400);
  });

  it('disable с верным кодом → 200, секрет стёрт из БД', async () => {
    const setup = await (await twoFa('setup', tokenViewer)).json();
    const code = generateTOTP(setup.secret);
    expect((await twoFa('verify', tokenViewer, { token: code })).status).toBe(200);

    const code2 = generateTOTP(setup.secret);
    const off = await twoFa('disable', tokenViewer, { token: code2 });
    expect(off.status).toBe(200);
    expect((await (await twoFa('status', tokenViewer)).json()).enabled).toBe(false);

    const user = await prisma.user.findUnique({
      where: { email: 'p2-viewer@test.com' },
      select: { twoFactorSecret: true },
    });
    expect(user?.twoFactorSecret).toBeNull();
  });
});
