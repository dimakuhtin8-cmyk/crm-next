/**
 * П4: GET /api/search — реальный поиск по контактам/сделкам/задачам тенанта.
 * Интеграционный тест: реальная БД (crm_test), реальный роут.
 */

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(SECRET);
}

function authed(url: string, token: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `authjs.session-token=${token}`;
  return new NextRequest(new URL(url), { headers });
}

import { GET as searchGET } from '@/app/api/search/route';

const BASE = 'http://localhost:3000';
const MARK = 'Zzzsearch';
let tokenA = '';

beforeAll(async () => {
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const mk = async (slug: string, email: string) => {
    const t = await prisma.tenant.create({
      data: { name: slug, slug, plan: 'professional' },
    });
    const u = await prisma.user.create({ data: { email, name: email } });
    await prisma.tenantMember.create({ data: { userId: u.id, tenantId: t.id, role: 'admin' } });
    return { tenantId: t.id, token: await createToken({ id: u.id, tenantId: t.id }) };
  };
  const a = await mk('search-a', 'search-a@test.com');
  const b = await mk('search-b', 'search-b@test.com');
  tokenA = a.token;

  await prisma.contact.create({
    data: { tenantId: a.tenantId, firstName: `${MARK}person`, company: `${MARK}corp` },
  });
  const pipe = await prisma.pipeline.create({
    data: { tenantId: a.tenantId, name: `${MARK}pipe` },
  });
  const stage = await prisma.pipelineStage.create({
    data: { pipelineId: pipe.id, name: `${MARK}stage`, order: 0 },
  });
  await prisma.deal.create({
    data: { tenantId: a.tenantId, title: `${MARK}deal`, pipelineId: pipe.id, stageId: stage.id },
  });
  await prisma.task.create({
    data: { tenantId: a.tenantId, title: `${MARK}task` },
  });
  // Шум в чужом тенанте — находиться не должен.
  await prisma.contact.create({
    data: { tenantId: b.tenantId, firstName: `${MARK}stranger` },
  });
});

afterAll(async () => {
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('П4: /api/search', () => {
  it('находит сущности своего тенанта по всем трём группам', async () => {
    const r = await searchGET(authed(`${BASE}/api/search?q=${MARK}`, tokenA));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.contacts.length).toBe(1);
    expect(body.contacts[0].name).toContain(MARK);
    expect(body.deals.length).toBe(1);
    expect(body.tasks.length).toBe(1);
  });

  it('не находит сущности чужого тенанта', async () => {
    const r = await searchGET(authed(`${BASE}/api/search?q=${MARK}stranger`, tokenA));
    const body = await r.json();
    expect(body.contacts).toEqual([]);
  });

  it('короткий запрос (<2 символов) → пустые группы без ошибки', async () => {
    const r = await searchGET(authed(`${BASE}/api/search?q=x`, tokenA));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ contacts: [], deals: [], tasks: [] });
  });

  it('без сессии → 401', async () => {
    const r = await searchGET(authed(`${BASE}/api/search?q=${MARK}`, null));
    expect(r.status).toBe(401);
  });
});
