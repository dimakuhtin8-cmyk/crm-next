/**
 * Grounding чата — интеграционные тесты.
 * Мокается ТОЛЬКО исходящий HTTP к LLM (единственное законное место),
 * проверяется, что в отправленный промпт реально попали данные CRM.
 */

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(SECRET);
}

function authed(url: string, token: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url), {
    method: 'POST',
    headers: { cookie: `authjs.session-token=${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

import { POST as aiPOST } from '@/app/api/ai/route';

const BASE = 'http://localhost:3000';

// Захваченный system-промпт из замоканного LLM-вызова
let capturedSystem = '';
let fetchCalls = 0;

function mockLLM() {
  fetchCalls = 0;
  capturedSystem = '';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      fetchCalls++;
      try {
        const body = JSON.parse(String((init as any)?.body || '{}'));
        const parts = body?.contents?.[0]?.parts || [];
        capturedSystem = parts.map((p: any) => p?.text || '').join('\n');
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

beforeEach(() => {
  vi.unstubAllGlobals();
});

let tenantA = '';
let tenantB = '';
let tokenOwnerA = '';
let tokenMemberA = '';

beforeAll(async () => {
  await prisma.aiProviderKey.deleteMany();
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

  const { encrypt: enc } = await import('@/lib/encryption');

  const tA = await prisma.tenant.create({
    data: {
      name: 'Ground A',
      slug: 'ground-a',
      plan: 'professional',
      aiProvider: 'gemini',
      aiApiKey: enc('test-key-a'),
    },
  });
  tenantA = tA.id;
  const tB = await prisma.tenant.create({
    data: {
      name: 'Ground B',
      slug: 'ground-b',
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
  const ownerA = await mk('ground-owner-a@test.com', tenantA, 'owner');
  const memberA = await mk('ground-member-a@test.com', tenantA, 'member');
  const memberB = await mk('ground-member-b@test.com', tenantA, 'member');
  const ownerB = await mk('ground-owner-b@test.com', tenantB, 'owner');

  tokenOwnerA = await createToken({ id: ownerA.id, tenantId: tenantA });
  tokenMemberA = await createToken({ id: memberA.id, tenantId: tenantA });

  // Контакт с уникальным именем в тенанте A (владелец — memberA)
  const c = await prisma.contact.create({
    data: {
      tenantId: tenantA,
      firstName: 'Zzztestperson',
      lastName: 'Унікальний',
      email: 'zzztestperson@example.com',
      company: 'ТОВ Zzztest',
      ownerId: memberA.id,
    },
  });
  const pipe = await prisma.pipeline.create({ data: { tenantId: tenantA, name: 'P' } });
  const stage = await prisma.pipelineStage.create({
    data: { pipelineId: pipe.id, name: 'S', order: 0 },
  });
  const d = await prisma.deal.create({
    data: {
      tenantId: tenantA,
      pipelineId: pipe.id,
      stageId: stage.id,
      title: 'Угода Zzztest',
      value: 45000,
      ownerId: memberA.id,
      contactId: c.id,
    },
  });
  await prisma.task.create({
    data: {
      tenantId: tenantA,
      title: 'Зателефонувати',
      status: 'todo',
      contactId: c.id,
      dealId: d.id,
    },
  });
  await prisma.activity.create({
    data: {
      tenantId: tenantA,
      contactId: c.id,
      type: 'call',
      title: 'Дзвінок 12.09',
      body: 'обговорили КП',
    },
  });

  // Контакт memberB того же тенанта (memberA его видеть НЕ должен)
  await prisma.contact.create({
    data: {
      tenantId: tenantA,
      firstName: 'Чужий',
      lastName: 'Контакт',
      email: 'чужой@example.com',
      ownerId: memberB.id,
    },
  });

  // Одноимённый контакт в тенанте B (другой email — маркер утечки)
  await prisma.contact.create({
    data: {
      tenantId: tenantB,
      firstName: 'Zzztestperson',
      lastName: 'Двійник',
      email: 'dviynyk-b@example.com',
      ownerId: ownerB.id,
    },
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.aiProviderKey.deleteMany();
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

describe('П4.1: grounding подмешивает данные контакта в промпт', () => {
  it('сообщение "розкажи про Zzztestperson" → system содержит email и компанию', async () => {
    mockLLM();
    const r = await aiPOST(
      authed(`${BASE}/api/ai?tenantId=${tenantA}`, tokenOwnerA, {
        action: 'custom',
        data: { prompt: 'розкажи про Zzztestperson' },
      }),
    );
    expect(r.status).toBe(200);
    expect(fetchCalls).toBe(1);
    expect(capturedSystem).toContain('zzztestperson@example.com');
    expect(capturedSystem).toContain('ТОВ Zzztest');
    expect(capturedSystem).toContain('45000');

    const body = await r.json();
    expect(body.sources.length).toBeGreaterThan(0);
    expect(body.sources.map((s: any) => s.type)).toContain('contact');
  });
});

describe('П4.2: IDOR — чужой тенант и чужой владелец не попадают в контекст', () => {
  it('двійник из тенанта B не утекает в ответ тенанта A', async () => {
    mockLLM();
    const r = await aiPOST(
      authed(`${BASE}/api/ai?tenantId=${tenantA}`, tokenOwnerA, {
        action: 'custom',
        data: { prompt: 'розкажи про Zzztestperson' },
      }),
    );
    expect(r.status).toBe(200);
    expect(capturedSystem).not.toContain('dviynyk-b@example.com');
    expect(capturedSystem).not.toContain('Двійник');
  });

  it('memberA не видит контакт memberB того же тенанта', async () => {
    mockLLM();
    const r = await aiPOST(
      authed(`${BASE}/api/ai?tenantId=${tenantA}`, tokenMemberA, {
        action: 'custom',
        data: { prompt: 'розкажи про Чужий' },
      }),
    );
    expect(r.status).toBe(200);
    expect(capturedSystem).not.toContain('чужой@example.com');
    // Чужого контакта в контексті немає (ні імені, ні пошти), але знімок CRM
    // присутній — відмова через NO_DATA більше не генерується.
    expect(capturedSystem).not.toContain('Чужий');
    expect(capturedSystem).toContain('Знімок CRM');
  });
});

describe('П4.3: пустий контекст — знімок + інструкція, без відмови', () => {
  it('сообщение без сущностей → system содержит знімок и НЕ содержит инструкцию отказа', async () => {
    mockLLM();
    const r = await aiPOST(
      authed(`${BASE}/api/ai?tenantId=${tenantA}`, tokenOwnerA, {
        action: 'custom',
        data: { prompt: 'бла бла несуществующее абракадабра' },
      }),
    );
    expect(r.status).toBe(200);
    // Регресія П2: старий NO_DATA_INSTRUCTION ("Даних по цьому запиту в CRM немає.
    // Повідом користувачу, що не маєш цих даних") має бути видалено.
    expect(capturedSystem).not.toContain('Даних по цьому запиту в CRM немає');
    expect(capturedSystem).not.toContain('не маєш цих даних');
    expect(capturedSystem).not.toContain('ТІЛЬКИ на основі даних нижче');
    // П1: знімок CRM завжди в system.
    expect(capturedSystem).toContain('Знімок CRM');
    expect(capturedSystem).toContain('Контакти: всього');
    const body = await r.json();
    expect(body.sources).toEqual([]);
  });
});

describe('Агрегаты: счётчики и обзоры', () => {
  it('"Сколько у меня сейчас угод?" → system со счётом и списком', async () => {
    mockLLM();
    const r = await aiPOST(
      authed(`${BASE}/api/ai?tenantId=${tenantA}`, tokenOwnerA, {
        action: 'custom',
        data: { prompt: 'Сколько у меня сейчас угод?' },
      }),
    );
    expect(r.status).toBe(200);
    expect(capturedSystem).toContain('Угоди: відкритих — 1');
    expect(capturedSystem).toContain('Угода Zzztest');
    const body = await r.json();
    expect(body.sources.length).toBeGreaterThan(0);
  });

  it('"А какая есть информация?" → обзор по всем сущностям', async () => {
    mockLLM();
    const r = await aiPOST(
      authed(`${BASE}/api/ai?tenantId=${tenantA}`, tokenOwnerA, {
        action: 'custom',
        data: { prompt: 'А какая есть информация?' },
      }),
    );
    expect(r.status).toBe(200);
    expect(capturedSystem).toContain('Угоди:');
    expect(capturedSystem).toContain('Контакти:');
    expect(capturedSystem).toContain('Задачі:');
  });
});
