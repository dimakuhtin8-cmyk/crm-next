/**
 * П2: messages/read больше не трогает lastMessageAt, счётчик unread считается
 * по флагу unread. Интеграционный тест: реальная БД (crm_test), реальные роуты.
 */

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(SECRET);
}

function authed(url: string, token: string, init?: RequestInit): NextRequest {
  const headers: Record<string, string> = { cookie: `authjs.session-token=${token}` };
  if (init?.body) headers['content-type'] = 'application/json';
  return new NextRequest(new URL(url), {
    method: init?.method || 'GET',
    headers,
    body: init?.body as BodyInit | null | undefined,
  });
}

import { POST as readPOST } from '@/app/api/messages/read/route';
import { GET as unreadGET } from '@/app/api/messages/unread/route';

const BASE = 'http://localhost:3000';
let tenantId = '';
let token = '';

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

beforeAll(async () => {
  await prisma.telegramChat.deleteMany();
  await prisma.whatsAppChat.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const t = await prisma.tenant.create({
    data: { name: 'MsgRead', slug: 'msg-read', plan: 'professional' },
  });
  tenantId = t.id;
  const u = await prisma.user.create({ data: { email: 'msg-admin@test.com', name: 'M' } });
  await prisma.tenantMember.create({ data: { userId: u.id, tenantId, role: 'admin' } });
  token = await createToken({ id: u.id, tenantId });

  await prisma.telegramChat.create({
    data: { tenantId, telegramId: 111, lastMessageAt: yesterday, unread: true },
  });
  await prisma.whatsAppChat.create({
    data: { tenantId, phoneNumber: '+380000000001', lastMessageAt: yesterday, unread: true },
  });
});

afterAll(async () => {
  await prisma.telegramChat.deleteMany();
  await prisma.whatsAppChat.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('П2: read/unread без инверсии', () => {
  it('unread считает чаты с unread=true (а не "активность за 24ч")', async () => {
    const r = await unreadGET(authed(`${BASE}/api/messages/unread`, token));
    const body = await r.json();
    expect(body.count).toBe(2);
  });

  it('POST read обнуляет счётчик и НЕ трогает lastMessageAt', async () => {
    const r = await readPOST(authed(`${BASE}/api/messages/read`, token, { method: 'POST' }));
    expect((await r.json()).success).toBe(true);

    const after = await unreadGET(authed(`${BASE}/api/messages/unread`, token));
    expect((await after.json()).count).toBe(0);

    const tg = await prisma.telegramChat.findFirst({ where: { tenantId } });
    const wa = await prisma.whatsAppChat.findFirst({ where: { tenantId } });
    // lastMessageAt остался "вчера", а не перезаписан на now()
    expect(tg!.lastMessageAt.getTime()).toBeLessThan(Date.now() - 20 * 60 * 60 * 1000);
    expect(wa!.lastMessageAt.getTime()).toBeLessThan(Date.now() - 20 * 60 * 60 * 1000);
    expect(tg!.unread).toBe(false);
    expect(wa!.unread).toBe(false);
  });
});
