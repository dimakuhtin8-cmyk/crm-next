/**
 * Уведомления: преференсы тостов + прочтение — интеграционный тест.
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

function authed(url: string, token: string | null, init?: RequestInit): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `authjs.session-token=${token}`;
  if (init?.body) headers['content-type'] = 'application/json';
  return new NextRequest(new URL(url), {
    method: init?.method || 'GET',
    headers,
    body: init?.body as BodyInit | null | undefined,
  });
}

import { GET as prefsGET, PATCH as prefsPATCH } from '@/app/api/notifications/preferences/route';
import { GET as notifGET, PATCH as notifPATCH } from '@/app/api/notifications/route';

const BASE = 'http://localhost:3000';
let tenantId = '';
let tokenAdmin = '';
let tokenViewer = '';
let viewerId = '';

beforeAll(async () => {
  await prisma.notification.deleteMany();
  await prisma.queueJob.deleteMany();
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

  const t = await prisma.tenant.create({ data: { name: 'Notif', slug: 'notif-prefs', plan: 'professional' } });
  tenantId = t.id;
  const a = await prisma.user.create({ data: { email: 'notif-admin@test.com', name: 'A' } });
  const v = await prisma.user.create({ data: { email: 'notif-viewer@test.com', name: 'V' } });
  viewerId = v.id;
  await prisma.tenantMember.create({ data: { userId: a.id, tenantId, role: 'admin' } });
  await prisma.tenantMember.create({ data: { userId: v.id, tenantId, role: 'viewer' } });
  tokenAdmin = await createToken({ id: a.id, tenantId });
  tokenViewer = await createToken({ id: v.id, tenantId });
});

afterAll(async () => {
  await prisma.notification.deleteMany();
  await prisma.queueJob.deleteMany();
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

describe('Преференсы тостов', () => {
  it('GET по умолчанию: enabled + bottom-left', async () => {
    const r = await prefsGET(authed(`${BASE}/api/notifications/preferences?tenantId=${tenantId}`, tokenViewer));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ toast: { enabled: true, position: 'bottom-left' } });
  });

  it('PATCH viewer → 403, admin → 200 и GET отражает', async () => {
    const denied = await prefsPATCH(
      authed(`${BASE}/api/notifications/preferences?tenantId=${tenantId}`, tokenViewer, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false }),
      })
    );
    expect(denied.status).toBe(403);

    const ok = await prefsPATCH(
      authed(`${BASE}/api/notifications/preferences?tenantId=${tenantId}`, tokenAdmin, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false, position: 'top-right' }),
      })
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ toast: { enabled: false, position: 'top-right' } });

    const get = await prefsGET(authed(`${BASE}/api/notifications/preferences?tenantId=${tenantId}`, tokenAdmin));
    expect(await get.json()).toEqual({ toast: { enabled: false, position: 'top-right' } });
  });

  it('PATCH мусор → 400', async () => {
    const r = await prefsPATCH(
      authed(`${BASE}/api/notifications/preferences?tenantId=${tenantId}`, tokenAdmin, {
        method: 'PATCH',
        body: JSON.stringify({ position: 'center' }),
      })
    );
    expect(r.status).toBe(400);
  });
});

describe('Прочтение уведомлений', () => {
  it('GET unreadCount, PATCH всё, счётчик в ноль', async () => {
    await prisma.notification.createMany({
      data: [
        { tenantId, userId: viewerId, title: 'T1', message: 'M1', type: 'info' },
        { tenantId, userId: viewerId, title: 'T2', message: 'M2', type: 'warning' },
      ],
    });

    const get1 = await notifGET(authed(`${BASE}/api/notifications?tenantId=${tenantId}`, tokenViewer));
    const b1 = await get1.json();
    expect(b1.unreadCount).toBe(2);
    expect(b1.notifications.length).toBe(2);

    const patch = await notifPATCH(
      authed(`${BASE}/api/notifications?tenantId=${tenantId}`, tokenViewer, { method: 'PATCH', body: JSON.stringify({}) })
    );
    expect((await patch.json()).marked).toBe(2);

    const get2 = await notifGET(authed(`${BASE}/api/notifications?tenantId=${tenantId}`, tokenViewer));
    expect((await get2.json()).unreadCount).toBe(0);
  });
});
