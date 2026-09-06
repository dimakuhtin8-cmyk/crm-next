/**
 * ФАЗА 1 (IDOR): cross-tenant isolation — интеграционный тест
 *
 * Это интеграционный тест (реальный route handler + реальная БД + JWT).
 * Два тенанта A и B. Пользователь A (owner тенанта A) пытается читать/менять
 * объекты тенанта B по прямому ID. Ожидается 404 и отсутствие изменений в БД.
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

import { GET as contactsGET, PUT as contactsPUT, DELETE as contactsDELETE } from '@/app/api/contacts/[id]/route';
import { GET as dealsGET, PUT as dealsPUT, DELETE as dealsDELETE } from '@/app/api/deals/[id]/route';
import { GET as tasksGET, PUT as tasksPUT, DELETE as tasksDELETE } from '@/app/api/tasks/[id]/route';
import { GET as pipelinesGET, PUT as pipelinesPUT, DELETE as pipelinesDELETE } from '@/app/api/pipelines/[id]/route';
import { GET as commentsGET } from '@/app/api/tasks/[id]/comments/route';
import { POST as movePOST } from '@/app/api/deals/move/route';
import { POST as bulkPOST } from '@/app/api/contacts/bulk/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let tenantA = '';
let tenantB = '';
let tokenA = '';
let tokenB = '';

let contactA = '';
let contactB = '';
let dealA = '';
let dealB = '';
let taskA = '';
let taskB = '';
let pipeA = '';
let pipeB = '';
let stageA = '';
let stageB = '';

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

  const tA = await prisma.tenant.create({ data: { name: 'Tenant A', slug: 'idor-tenant-a', plan: 'professional' } });
  const tB = await prisma.tenant.create({ data: { name: 'Tenant B', slug: 'idor-tenant-b', plan: 'professional' } });
  tenantA = tA.id;
  tenantB = tB.id;

  const uA = await prisma.user.create({ data: { email: 'idor-a@test.com', name: 'User A' } });
  const uB = await prisma.user.create({ data: { email: 'idor-b@test.com', name: 'User B' } });
  await prisma.tenantMember.create({ data: { userId: uA.id, tenantId: tenantA, role: 'owner' } });
  await prisma.tenantMember.create({ data: { userId: uB.id, tenantId: tenantB, role: 'owner' } });

  tokenA = await createToken({ id: uA.id, tenantId: tenantA });
  tokenB = await createToken({ id: uB.id, tenantId: tenantB });

  const cA = await prisma.contact.create({ data: { tenantId: tenantA, firstName: 'Alice' } });
  const cB = await prisma.contact.create({ data: { tenantId: tenantB, firstName: 'Bob' } });
  contactA = cA.id;
  contactB = cB.id;

  const pA = await prisma.pipeline.create({ data: { tenantId: tenantA, name: 'Pipe A' } });
  const pB = await prisma.pipeline.create({ data: { tenantId: tenantB, name: 'Pipe B' } });
  pipeA = pA.id;
  pipeB = pB.id;
  const sA = await prisma.pipelineStage.create({ data: { pipelineId: pipeA, name: 'S1', order: 0 } });
  const sB = await prisma.pipelineStage.create({ data: { pipelineId: pipeB, name: 'S1', order: 0 } });
  stageA = sA.id;
  stageB = sB.id;

  const dA = await prisma.deal.create({ data: { tenantId: tenantA, pipelineId: pipeA, stageId: stageA, title: 'Deal A' } });
  const dB = await prisma.deal.create({ data: { tenantId: tenantB, pipelineId: pipeB, stageId: stageB, title: 'Deal B' } });
  dealA = dA.id;
  dealB = dB.id;

  const t1 = await prisma.task.create({ data: { tenantId: tenantA, title: 'Task A' } });
  const t2 = await prisma.task.create({ data: { tenantId: tenantB, title: 'Task B' } });
  taskA = t1.id;
  taskB = t2.id;
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

const BASE = 'http://localhost:3000';

describe('ФАЗА 1: cross-tenant read — чужое не видно', () => {
  it('GET /api/contacts/<id-B> как A → 404, своих видно', async () => {
    const foreign = await contactsGET(makeRequest(`${BASE}/api/contacts/${contactB}?tenantId=${tenantA}`, tokenA), ctx(contactB));
    expect(foreign.status).toBe(404);
    const body = await foreign.json();
    expect(JSON.stringify(body)).not.toContain('Bob');

    const own = await contactsGET(makeRequest(`${BASE}/api/contacts/${contactA}?tenantId=${tenantA}`, tokenA), ctx(contactA));
    expect(own.status).toBe(200);
  });

  it('GET deals/tasks/pipelines/<id-B> как A → 404', async () => {
    const d = await dealsGET(makeRequest(`${BASE}/api/deals/${dealB}?tenantId=${tenantA}`, tokenA), ctx(dealB));
    expect(d.status).toBe(404);
    expect(JSON.stringify(await d.json())).not.toContain('Deal B');

    const t = await tasksGET(makeRequest(`${BASE}/api/tasks/${taskB}?tenantId=${tenantA}`, tokenA), ctx(taskB));
    expect(t.status).toBe(404);

    const p = await pipelinesGET(makeRequest(`${BASE}/api/pipelines/${pipeB}?tenantId=${tenantA}`, tokenA), ctx(pipeB));
    expect(p.status).toBe(404);
  });

  it('GET комментариев чужой задачи → 404', async () => {
    const r = await commentsGET(makeRequest(`${BASE}/api/tasks/${taskB}/comments?tenantId=${tenantA}`, tokenA), ctx(taskB));
    expect(r.status).toBe(404);
  });
});

describe('ФАЗА 1: cross-tenant write — чужое не меняется', () => {
  it('PUT /api/contacts/<id-B> → 404, данные в БД нетронуты', async () => {
    const r = await contactsPUT(
      makeRequest(`${BASE}/api/contacts/${contactB}?tenantId=${tenantA}`, tokenA, {
        method: 'PUT',
        body: JSON.stringify({ firstName: 'Hacked' }),
      }),
      ctx(contactB)
    );
    expect(r.status).toBe(404);
    const after = await prisma.contact.findUnique({ where: { id: contactB } });
    expect(after?.firstName).toBe('Bob');
  });

  it('DELETE /api/contacts/<id-B> → 404, запись жива', async () => {
    const r = await contactsDELETE(makeRequest(`${BASE}/api/contacts/${contactB}?tenantId=${tenantA}`, tokenA, { method: 'DELETE' }), ctx(contactB));
    expect(r.status).toBe(404);
    const after = await prisma.contact.findUnique({ where: { id: contactB } });
    expect(after).not.toBeNull();
  });

  it('PUT/DELETE deals/<id-B> → 404, сделка нетронута', async () => {
    const put = await dealsPUT(
      makeRequest(`${BASE}/api/deals/${dealB}?tenantId=${tenantA}`, tokenA, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Hacked' }),
      }),
      ctx(dealB)
    );
    expect(put.status).toBe(404);
    const del = await dealsDELETE(makeRequest(`${BASE}/api/deals/${dealB}?tenantId=${tenantA}`, tokenA, { method: 'DELETE' }), ctx(dealB));
    expect(del.status).toBe(404);
    const after = await prisma.deal.findUnique({ where: { id: dealB } });
    expect(after?.title).toBe('Deal B');
  });

  it('PUT/DELETE tasks/<id-B> → 404, задача нетронута', async () => {
    const put = await tasksPUT(
      makeRequest(`${BASE}/api/tasks/${taskB}?tenantId=${tenantA}`, tokenA, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Hacked' }),
      }),
      ctx(taskB)
    );
    expect(put.status).toBe(404);
    const del = await tasksDELETE(makeRequest(`${BASE}/api/tasks/${taskB}?tenantId=${tenantA}`, tokenA, { method: 'DELETE' }), ctx(taskB));
    expect(del.status).toBe(404);
    const after = await prisma.task.findUnique({ where: { id: taskB } });
    expect(after?.title).toBe('Task B');
  });

  it('PUT/DELETE pipelines/<id-B> → 404', async () => {
    const put = await pipelinesPUT(
      makeRequest(`${BASE}/api/pipelines/${pipeB}?tenantId=${tenantA}`, tokenA, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Hacked' }),
      }),
      ctx(pipeB)
    );
    expect(put.status).toBe(404);
    const del = await pipelinesDELETE(makeRequest(`${BASE}/api/pipelines/${pipeB}?tenantId=${tenantA}`, tokenA, { method: 'DELETE' }), ctx(pipeB));
    expect(del.status).toBe(404);
    const after = await prisma.pipeline.findUnique({ where: { id: pipeB } });
    expect(after?.name).toBe('Pipe B');
  });

  it('POST /api/deals/move чужой сделки → 404, stageId нетронут', async () => {
    const r = await movePOST(
      makeRequest(`${BASE}/api/deals/move?tenantId=${tenantA}`, tokenA, {
        method: 'POST',
        body: JSON.stringify({ dealId: dealB, stageId: stageA }),
      }),
      {}
    );
    expect(r.status).toBe(404);
    const after = await prisma.deal.findUnique({ where: { id: dealB } });
    expect(after?.stageId).toBe(stageB);
  });

  it('POST /api/contacts/bulk delete с чужим id → 403, чужой контакт жив', async () => {
    const r = await bulkPOST(
      makeRequest(`${BASE}/api/contacts/bulk?tenantId=${tenantA}`, tokenA, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', ids: [contactB] }),
      }),
      {}
    );
    expect(r.status).toBe(403);
    const after = await prisma.contact.findUnique({ where: { id: contactB } });
    expect(after).not.toBeNull();
  });
});

describe('ФАЗА 1: sanity — свои объекты доступны пользователю B', () => {
  it('GET /api/contacts/<id-B> как B → 200', async () => {
    const r = await contactsGET(makeRequest(`${BASE}/api/contacts/${contactB}?tenantId=${tenantB}`, tokenB), ctx(contactB));
    expect(r.status).toBe(200);
  });
});
