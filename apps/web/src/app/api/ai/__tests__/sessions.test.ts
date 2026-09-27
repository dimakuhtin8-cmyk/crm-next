/**
 * Сессии чата Copilot — интеграционные тесты.
 * Мокается ТОЛЬКО исходящий HTTP к LLM (единственное законное место),
 * проверяется реальная история в промпте, IDOR-скоупинг, title и каскад.
 */

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(SECRET);
}

function authed(url: string, token: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url), {
    method: 'POST',
    headers: { cookie: `authjs.session-token=${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function authedGet(url: string, token: string): NextRequest {
  return new NextRequest(new URL(url), {
    headers: { cookie: `authjs.session-token=${token}` },
  });
}

import { POST as aiPOST } from '@/app/api/ai/route';
import { GET as sessionGET, DELETE as sessionDELETE } from '@/app/api/ai/sessions/[id]/route';
import { POST as sessionsPOST, GET as sessionsGET } from '@/app/api/ai/sessions/route';

const BASE = 'http://localhost:3000';

// Все тела запросов к замоканному LLM по порядку вызовов.
let llmBodies: string[] = [];

function mockLLM() {
  llmBodies = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      try {
        llmBodies.push(String((init as { body?: unknown })?.body || '{}'));
      } catch {
        // парсинг тела запроса не критичен для теста
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'mocked-answer' }] } }] }),
      } as unknown as Response;
    }),
  );
}

function contentsText(bodyJson: string): string {
  try {
    const body = JSON.parse(bodyJson);
    return (body?.contents || [])
      .map((c: { parts?: { text?: string }[] }) =>
        (c.parts || []).map((p) => p?.text || '').join('\n'),
      )
      .join('\n');
  } catch {
    return '';
  }
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

let tenantA = '';
let tenantB = '';
let tokenOwnerA = '';
let tokenMemberA = '';
let tokenOwnerB = '';

beforeAll(async () => {
  await prisma.aiChatMessage.deleteMany();
  await prisma.aiChatSession.deleteMany();
  await prisma.aiProviderKey.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const { encrypt: enc } = await import('@/lib/encryption');

  const tA = await prisma.tenant.create({
    data: {
      name: 'Sess A',
      slug: 'sess-a',
      plan: 'professional',
      aiProvider: 'gemini',
      aiApiKey: enc('test-key-a'),
    },
  });
  tenantA = tA.id;
  const tB = await prisma.tenant.create({
    data: {
      name: 'Sess B',
      slug: 'sess-b',
      plan: 'professional',
      aiProvider: 'gemini',
      aiApiKey: enc('test-key-b'),
    },
  });
  tenantB = tB.id;

  const mk = async (email: string, tenantId: string, role: string) => {
    const u = await prisma.user.create({ data: { email, name: email } });
    await prisma.tenantMember.create({ data: { userId: u.id, tenantId, role } });
    return u;
  };
  const ownerA = await mk('sess-owner-a@test.com', tenantA, 'owner');
  const memberA = await mk('sess-member-a@test.com', tenantA, 'member');
  const ownerB = await mk('sess-owner-b@test.com', tenantB, 'owner');

  tokenOwnerA = await createToken({ id: ownerA.id, tenantId: tenantA });
  tokenMemberA = await createToken({ id: memberA.id, tenantId: tenantA });
  tokenOwnerB = await createToken({ id: ownerB.id, tenantId: tenantB });
});

afterAll(async () => {
  await prisma.aiChatMessage.deleteMany();
  await prisma.aiChatSession.deleteMany();
  await prisma.aiProviderKey.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

async function createSession(token: string, tenantId: string): Promise<string> {
  const r = await sessionsPOST(authed(`${BASE}/api/ai/sessions?tenantId=${tenantId}`, token));
  expect(r.status).toBe(201);
  const body = await r.json();
  return body.session.id as string;
}

async function chat(token: string, tenantId: string, prompt: string, sessionId?: string) {
  return aiPOST(
    authed(`${BASE}/api/ai?tenantId=${tenantId}`, token, {
      action: 'custom',
      data: { prompt, sessionId },
    }),
  );
}

describe('П5.0: CRUD списка сессий', () => {
  it('POST создаёт, GET возвращает свои сессии (updatedAt desc)', async () => {
    const s1 = await createSession(tokenOwnerA, tenantA);
    const s2 = await createSession(tokenOwnerA, tenantA);

    const r = await sessionsGET(
      authedGet(`${BASE}/api/ai/sessions?tenantId=${tenantA}`, tokenOwnerA),
    );
    expect(r.status).toBe(200);
    const ids = ((await r.json()).sessions as { id: string }[]).map((s) => s.id);
    expect(ids).toContain(s1);
    expect(ids).toContain(s2);
    // чужих сессий нет
    const rB = await sessionsGET(
      authedGet(`${BASE}/api/ai/sessions?tenantId=${tenantB}`, tokenOwnerB),
    );
    expect(((await rB.json()).sessions as { id: string }[]).map((s) => s.id)).not.toContain(s1);
  });
});

describe('П5.1: история попадает в промпт второго вызова', () => {
  it('второй вызов содержит текст первого обмена', async () => {
    mockLLM();
    const sid = await createSession(tokenOwnerA, tenantA);

    const r1 = await chat(tokenOwnerA, tenantA, 'Розкажи про угоду Альфа', sid);
    expect(r1.status).toBe(200);
    const r2 = await chat(tokenOwnerA, tenantA, 'а що по цій угоді ще?', sid);
    expect(r2.status).toBe(200);

    expect(llmBodies.length).toBe(2);
    const second = contentsText(llmBodies[1]);
    // История первого обмена реально в промпте второго вызова:
    expect(second).toContain('Розкажи про угоду Альфа');
    expect(second).toContain('mocked-answer');
    expect(second).toContain('а що по цій угоді ще?');
  });
});

describe('П5.2: IDOR — чужие сессии недоступны', () => {
  it('member того же тенанта не читает сессию owner (404)', async () => {
    mockLLM();
    const sid = await createSession(tokenOwnerA, tenantA);
    await chat(tokenOwnerA, tenantA, 'секретний промпт власника', sid);

    const r = await sessionGET(
      authedGet(`${BASE}/api/ai/sessions/${sid}?tenantId=${tenantA}`, tokenMemberA),
      {
        params: Promise.resolve({ id: sid }),
      },
    );
    expect(r.status).toBe(404);
  });

  it('owner чужого тенанта не читает и не удаляет (404, сессия цела)', async () => {
    const sid = await createSession(tokenOwnerA, tenantA);

    const g = await sessionGET(
      authedGet(`${BASE}/api/ai/sessions/${sid}?tenantId=${tenantB}`, tokenOwnerB),
      {
        params: Promise.resolve({ id: sid }),
      },
    );
    expect(g.status).toBe(404);

    const d = await sessionDELETE(
      authed(`${BASE}/api/ai/sessions/${sid}?tenantId=${tenantB}`, tokenOwnerB),
      { params: Promise.resolve({ id: sid }) },
    );
    expect(d.status).toBe(404);
    expect(await prisma.aiChatSession.findUnique({ where: { id: sid } })).not.toBeNull();
  });

  it('свой GET возвращает сообщения с groundedOn', async () => {
    mockLLM();
    const sid = await createSession(tokenOwnerA, tenantA);
    await chat(tokenOwnerA, tenantA, 'питання власника', sid);

    const r = await sessionGET(
      authedGet(`${BASE}/api/ai/sessions/${sid}?tenantId=${tenantA}`, tokenOwnerA),
      {
        params: Promise.resolve({ id: sid }),
      },
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.messages.length).toBe(2);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[1].role).toBe('assistant');
    expect(body.messages[1].groundedOn).toBeTruthy();
  });
});

describe('П5.3/П5.4: title из первого сообщения + каскад при DELETE', () => {
  it('title генерируется из первых 50 символов', async () => {
    mockLLM();
    const sid = await createSession(tokenOwnerA, tenantA);
    await chat(
      tokenOwnerA,
      tenantA,
      'Який прогноз продажів на наступний квартал для нашого відділу?',
      sid,
    );

    const row = await prisma.aiChatSession.findUnique({ where: { id: sid } });
    expect(row?.title).toBe('Який прогноз продажів на наступний квартал для наш');
  });

  it('DELETE удаляет сессию и все сообщения (каскад)', async () => {
    mockLLM();
    const sid = await createSession(tokenOwnerA, tenantA);
    await chat(tokenOwnerA, tenantA, 'раз', sid);
    await chat(tokenOwnerA, tenantA, 'два', sid);
    expect(await prisma.aiChatMessage.count({ where: { sessionId: sid } })).toBe(4);

    const d = await sessionDELETE(
      authed(`${BASE}/api/ai/sessions/${sid}?tenantId=${tenantA}`, tokenOwnerA),
      { params: Promise.resolve({ id: sid }) },
    );
    expect((await d.json()).deleted).toBe(true);
    expect(await prisma.aiChatSession.findUnique({ where: { id: sid } })).toBeNull();
    expect(await prisma.aiChatMessage.count({ where: { sessionId: sid } })).toBe(0);
  });
});
