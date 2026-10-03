/**
 * STEP 3: Chat REST API — інтеграційні тести (реальна БД crm_test, реальні роути).
 *
 * - GET /api/chats: порядок за lastMessageAt, preview, розшифровка phone, фільтри channel/search
 * - GET /api/chats/[chatId]/messages: пагінація, 404 для чужого чату
 * - POST /api/chats/[chatId]/messages: sendMessageToChannel → ChatMessage(USER), 502 при помилці
 * - PATCH /api/chats/[chatId]/read: unreadCount → 0
 */

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

import { GET as msgsGET, POST as msgsPOST } from '@/app/api/chats/[chatId]/messages/route';
import { PATCH as readPATCH } from '@/app/api/chats/[chatId]/read/route';
import { GET as chatsGET } from '@/app/api/chats/route';
import { sendMessageToChannel } from '@/lib/channels';
import { encrypt } from '@/lib/encryption';

vi.mock('@/lib/channels', () => ({
  sendMessageToChannel: vi.fn(async () => ({ ok: true, externalMessageId: 'ext-123' })),
}));

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

const BASE = 'http://localhost:3000';
let tenantId = '';
let otherTenantId = '';
let token = '';
let tgChatId = '';
let waChatId = '';
let foreignChatId = '';
const sendMock = vi.mocked(sendMessageToChannel);

const HOUR = 60 * 60 * 1000;

beforeAll(async () => {
  await prisma.chatMessage.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const t = await prisma.tenant.create({
    data: { name: 'ChatsApi', slug: 'chats-api', plan: 'professional' },
  });
  tenantId = t.id;
  const t2 = await prisma.tenant.create({
    data: { name: 'ChatsOther', slug: 'chats-other', plan: 'professional' },
  });
  otherTenantId = t2.id;

  const u = await prisma.user.create({ data: { email: 'chats-admin@test.com', name: 'Admin' } });
  await prisma.tenantMember.create({ data: { userId: u.id, tenantId, role: 'admin' } });
  token = await createToken({ id: u.id, tenantId });

  const c1 = await prisma.contact.create({
    data: { tenantId, firstName: 'Іван', lastName: 'Петренко', phone: encrypt('+380671112233') },
  });
  const c2 = await prisma.contact.create({
    data: { tenantId, firstName: 'Olena', lastName: 'Koval' },
  });
  const c3 = await prisma.contact.create({
    data: { tenantId: otherTenantId, firstName: 'Foreign', lastName: 'Contact' },
  });

  const chat1 = await prisma.chat.create({
    data: {
      tenantId,
      contactId: c1.id,
      channel: 'TELEGRAM',
      externalChatId: '111111',
      unreadCount: 2,
      lastMessageAt: new Date(Date.now() - HOUR),
    },
  });
  tgChatId = chat1.id;

  const chat2 = await prisma.chat.create({
    data: {
      tenantId,
      contactId: c2.id,
      channel: 'WHATSAPP',
      externalChatId: '380672223344',
      unreadCount: 0,
      lastMessageAt: new Date(Date.now() - 2 * HOUR),
    },
  });
  waChatId = chat2.id;

  const chat3 = await prisma.chat.create({
    data: {
      tenantId: otherTenantId,
      contactId: c3.id,
      channel: 'TELEGRAM',
      externalChatId: '999999',
      lastMessageAt: new Date(),
    },
  });
  foreignChatId = chat3.id;

  // 5 повідомлень у tg-чаті (createdAt: 1..5 хв тому → page 1 = 5,4)
  for (let i = 1; i <= 5; i++) {
    await prisma.chatMessage.create({
      data: {
        chatId: tgChatId,
        senderType: i % 2 === 1 ? 'CUSTOMER' : 'USER',
        content: `msg-${i}`,
        createdAt: new Date(Date.now() - i * 60 * 1000),
      },
    });
  }
  await prisma.chatMessage.create({
    data: { chatId: waChatId, senderType: 'CUSTOMER', content: 'wa-msg' },
  });
});

afterAll(async () => {
  await prisma.chatMessage.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  vi.clearAllMocks();
});

describe('GET /api/chats', () => {
  it('повертає чати тенанта за lastMessageAt desc з preview і контактом', async () => {
    const r = await chatsGET(authed(`${BASE}/api/chats`, token));
    expect(r.status).toBe(200);
    const body = await r.json();

    expect(body.total).toBe(2);
    expect(body.chats.map((c: { id: string }) => c.id)).toEqual([tgChatId, waChatId]);

    const tg = body.chats[0];
    expect(tg.channel).toBe('TELEGRAM');
    expect(tg.unreadCount).toBe(2);
    expect(tg.contact.firstName).toBe('Іван');
    // phone з БД зашифрований → у відповіді розшифрований
    expect(tg.contact.phone).toBe('+380671112233');
    // preview = останнє повідомлення
    expect(tg.lastMessage.content).toBe('msg-1');
  });

  it('фільтр ?channel=WHATSAPP', async () => {
    const r = await chatsGET(authed(`${BASE}/api/chats?channel=WHATSAPP`, token));
    const body = await r.json();
    expect(body.total).toBe(1);
    expect(body.chats[0].id).toBe(waChatId);
  });

  it("фільтр ?search= за ім'ям контакту", async () => {
    const r = await chatsGET(authed(`${BASE}/api/chats?search=Петренко`, token));
    const body = await r.json();
    expect(body.total).toBe(1);
    expect(body.chats[0].id).toBe(tgChatId);
  });

  it('401 без сесії', async () => {
    const r = await chatsGET(new NextRequest(new URL(`${BASE}/api/chats`)));
    expect(r.status).toBe(401);
  });
});

describe('GET /api/chats/[chatId]/messages', () => {
  it('пагінація: page 1 = 2 найновіші (desc), total = 5', async () => {
    const r = await msgsGET(authed(`${BASE}/api/chats/${tgChatId}/messages?limit=2`, token), {
      params: Promise.resolve({ chatId: tgChatId }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();

    expect(body.total).toBe(5);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content).toBe('msg-1');
    expect(body.messages[1].content).toBe('msg-2');
  });

  it('page 2 = наступні 2 (старіші)', async () => {
    const r = await msgsGET(
      authed(`${BASE}/api/chats/${tgChatId}/messages?limit=2&page=2`, token),
      { params: Promise.resolve({ chatId: tgChatId }) },
    );
    const body = await r.json();
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual(['msg-3', 'msg-4']);
  });

  it('404 для неіснуючого/чужого чату', async () => {
    const missing = await msgsGET(authed(`${BASE}/api/chats/nope/messages`, token), {
      params: Promise.resolve({ chatId: 'nope' }),
    });
    expect(missing.status).toBe(404);

    // чат іншого тенанта не видно (tenant isolation)
    const foreign = await msgsGET(authed(`${BASE}/api/chats/${foreignChatId}/messages`, token), {
      params: Promise.resolve({ chatId: foreignChatId }),
    });
    expect(foreign.status).toBe(404);
  });
});

describe('POST /api/chats/[chatId]/messages', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ ok: true, externalMessageId: 'ext-123' });
  });

  it('успіх: 201, ChatMessage(senderType USER, DELIVERED), lastMessageAt оновлено', async () => {
    const before = Date.now();
    const r = await msgsPOST(
      authed(`${BASE}/api/chats/${waChatId}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ content: '  Вітаю!  ' }),
      }),
      { params: Promise.resolve({ chatId: waChatId }) },
    );

    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.message.senderType).toBe('USER');
    expect(body.message.status).toBe('DELIVERED');
    expect(body.message.externalMessageId).toBe('ext-123');
    expect(body.message.content).toBe('Вітаю!'); // trim

    expect(sendMock).toHaveBeenCalledWith(waChatId, 'Вітаю!');

    const chat = await prisma.chat.findUnique({ where: { id: waChatId } });
    expect(chat!.lastMessageAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('помилка відправки: 502, повідомлення зберігається зі статусом FAILED', async () => {
    sendMock.mockResolvedValue({ ok: false, error: 'Telegram API error' });

    const r = await msgsPOST(
      authed(`${BASE}/api/chats/${tgChatId}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ content: "Немає зв'язку" }),
      }),
      { params: Promise.resolve({ chatId: tgChatId }) },
    );

    expect(r.status).toBe(502);
    const body = await r.json();
    expect(body.error).toBe('Telegram API error');
    expect(body.message.status).toBe('FAILED');
    expect(body.message.senderType).toBe('USER');
  });

  it('валідація: порожній content → 400', async () => {
    const r = await msgsPOST(
      authed(`${BASE}/api/chats/${tgChatId}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ content: '   ' }),
      }),
      { params: Promise.resolve({ chatId: tgChatId }) },
    );
    expect(r.status).toBe(400);
  });

  it('404 для чужого чату', async () => {
    const r = await msgsPOST(
      authed(`${BASE}/api/chats/${foreignChatId}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ content: 'hi' }),
      }),
      { params: Promise.resolve({ chatId: foreignChatId }) },
    );
    expect(r.status).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/chats/[chatId]/read', () => {
  it('обнуляє unreadCount', async () => {
    const r = await readPATCH(
      authed(`${BASE}/api/chats/${tgChatId}/read`, token, { method: 'PATCH' }),
      {
        params: Promise.resolve({ chatId: tgChatId }),
      },
    );
    expect(r.status).toBe(200);
    expect((await r.json()).chat.unreadCount).toBe(0);

    const chat = await prisma.chat.findUnique({ where: { id: tgChatId } });
    expect(chat!.unreadCount).toBe(0);
  });

  it('404 для чужого чату', async () => {
    const r = await readPATCH(
      authed(`${BASE}/api/chats/${foreignChatId}/read`, token, { method: 'PATCH' }),
      { params: Promise.resolve({ chatId: foreignChatId }) },
    );
    expect(r.status).toBe(404);
  });
});
