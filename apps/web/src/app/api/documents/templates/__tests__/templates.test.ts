/**
 * П3: шаблоны документов живут в Postgres (per-tenant), а не в памяти процесса.
 * Интеграционный тест: реальная БД (crm_test), реальные роуты.
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

import {
  GET as tplGET,
  POST as tplPOST,
  DELETE as tplDELETE,
} from '@/app/api/documents/templates/route';

const BASE = 'http://localhost:3000';
let tenantA = '';
let tokenA = '';
let tokenB = '';

beforeAll(async () => {
  await prisma.documentTemplate.deleteMany();
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
  ({ tenantId: tenantA, token: tokenA } = await mk('tpl-a', 'tpl-a@test.com'));
  ({ token: tokenB } = await mk('tpl-b', 'tpl-b@test.com'));
});

afterAll(async () => {
  await prisma.documentTemplate.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('П3: DocumentTemplate в Postgres', () => {
  it('POST создаёт шаблон, GET его возвращает (реальное сохранение)', async () => {
    const r = await tplPOST(
      authed(`${BASE}/api/documents/templates`, tokenA, {
        method: 'POST',
        body: JSON.stringify({ name: 'КП-2026', type: 'kp', content: { title: 'Hi' } }),
      }),
    );
    expect(r.status).toBe(201);
    const created = (await r.json()).template;
    expect(created.id).toBeTruthy();

    const g = await tplGET(authed(`${BASE}/api/documents/templates`, tokenA));
    const list = (await g.json()).templates;
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('КП-2026');
    expect(list[0].type).toBe('kp');

    // Прямая проверка в БД, минуя роут.
    const row = await prisma.documentTemplate.findUnique({ where: { id: created.id } });
    expect(row?.tenantId).toBe(tenantA);
  });

  it('неизвестный тип отклоняется 400', async () => {
    const r = await tplPOST(
      authed(`${BASE}/api/documents/templates`, tokenA, {
        method: 'POST',
        body: JSON.stringify({ name: 'X', type: 'presentation' }),
      }),
    );
    expect(r.status).toBe(400);
  });

  it('изоляция: тенант B не видит и не может удалить шаблон тенанта A', async () => {
    const gB = await tplGET(authed(`${BASE}/api/documents/templates`, tokenB));
    expect((await gB.json()).templates).toEqual([]);

    const tplA = await prisma.documentTemplate.findFirst({ where: { tenantId: tenantA } });
    const del = await tplDELETE(
      authed(`${BASE}/api/documents/templates?id=${tplA!.id}`, tokenB, { method: 'DELETE' }),
    );
    expect(del.status).toBe(404);
    // Шаблон на месте.
    expect(await prisma.documentTemplate.findUnique({ where: { id: tplA!.id } })).not.toBeNull();
  });

  it('DELETE удаляет свой шаблон', async () => {
    const tplA = await prisma.documentTemplate.findFirst({ where: { tenantId: tenantA } });
    const del = await tplDELETE(
      authed(`${BASE}/api/documents/templates?id=${tplA!.id}`, tokenA, { method: 'DELETE' }),
    );
    expect((await del.json()).deleted).toBe(true);

    const g = await tplGET(authed(`${BASE}/api/documents/templates`, tokenA));
    expect((await g.json()).templates).toEqual([]);
  });
});
