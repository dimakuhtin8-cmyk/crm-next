/**
 * /api/import + entity import endpoints — інтеграційний тест
 * (реальные route handlers + реальная БД crm_test + JWT).
 * Паттерн скопирован с app/api/contacts/__tests__/datafilter.test.ts.
 */

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { POST as contactsImportPOST } from '@/app/api/contacts/import/route';
import { POST as dealsImportPOST } from '@/app/api/deals/import/route';
import { POST as importPOST } from '@/app/api/import/route';
import { POST as tasksImportPOST } from '@/app/api/tasks/import/route';

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

const BASE = 'http://localhost:3000';

let tenantId: string;
let memberToken: string;
let viewerToken: string;
let memberId: string;
let pipelineId: string;
let firstStageId: string;

beforeAll(async () => {
  // Cleanup in reverse FK order
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { name: 'Import API Tenant', slug: 'test-import-api', plan: 'professional' },
  });
  tenantId = tenant.id;

  const member = await prisma.user.create({
    data: { email: 'member-import@test.com', name: 'Import Member' },
  });
  memberId = member.id;
  await prisma.tenantMember.create({ data: { userId: memberId, tenantId, role: 'member' } });

  const viewer = await prisma.user.create({
    data: { email: 'viewer-import@test.com', name: 'Import Viewer' },
  });
  await prisma.tenantMember.create({ data: { userId: viewer.id, tenantId, role: 'viewer' } });

  memberToken = await createToken({ id: memberId, tenantId });
  viewerToken = await createToken({ id: viewer.id, tenantId });

  const pipeline = await prisma.pipeline.create({
    data: {
      tenantId,
      name: 'Імпортна воронка',
      isDefault: true,
      stages: { create: [{ name: 'етап 1', order: 1 }] },
    },
    include: { stages: true },
  });
  pipelineId = pipeline.id;
  firstStageId = pipeline.stages[0].id;
});

afterAll(async () => {
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('POST /api/import — generic entity import', () => {
  it('create mode: creates a contact and returns the engine report', async () => {
    const req = makeRequest(`${BASE}/api/import?tenantId=${tenantId}`, memberToken, {
      method: 'POST',
      body: JSON.stringify({
        entity: 'contact',
        mode: 'create',
        mapping: { firstName: 'name', email: 'mail', externalId: 'code' },
        rows: [{ name: 'Імпорт', mail: 'imp@x.com', code: 'IMP-1' }],
      }),
    });

    const response = await importPOST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.report).toMatchObject({ created: 1, updated: 0, skipped: 0, errors: [] });

    const contact = await prisma.contact.findFirst({ where: { tenantId, externalId: 'IMP-1' } });
    expect(contact?.firstName).toBe('Імпорт');
    expect(contact?.ownerId).toBe(memberId);
  });

  it('upsert mode: actualizes by externalId instead of duplicating', async () => {
    const req = makeRequest(`${BASE}/api/import?tenantId=${tenantId}`, memberToken, {
      method: 'POST',
      body: JSON.stringify({
        entity: 'contact',
        mode: 'upsert',
        mapping: { firstName: 'name', externalId: 'code' },
        rows: [{ name: 'Імпорт 2', code: 'IMP-1' }],
      }),
    });

    const response = await importPOST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.report).toMatchObject({ created: 0, updated: 1, skipped: 0, errors: [] });

    const matches = await prisma.contact.findMany({ where: { tenantId, externalId: 'IMP-1' } });
    expect(matches).toHaveLength(1);
    expect(matches[0].firstName).toBe('Імпорт 2');
  });

  it('validation: unknown entity, too many rows and missing entity return 400', async () => {
    const badEntity = await importPOST(
      makeRequest(`${BASE}/api/import?tenantId=${tenantId}`, memberToken, {
        method: 'POST',
        body: JSON.stringify({ entity: 'invoice', rows: [] }),
      }),
    );
    expect(badEntity.status).toBe(400);

    const missingEntity = await importPOST(
      makeRequest(`${BASE}/api/import?tenantId=${tenantId}`, memberToken, {
        method: 'POST',
        body: JSON.stringify({ rows: [{ a: 'b' }] }),
      }),
    );
    expect(missingEntity.status).toBe(400);

    const tooMany = await importPOST(
      makeRequest(`${BASE}/api/import?tenantId=${tenantId}`, memberToken, {
        method: 'POST',
        body: JSON.stringify({
          entity: 'contact',
          rows: Array.from({ length: 5001 }, (_, i) => ({ name: `row ${i}` })),
        }),
      }),
    );
    expect(tooMany.status).toBe(400);
  });

  it('unauthenticated: returns 401', async () => {
    const response = await importPOST(
      makeRequest(`${BASE}/api/import?tenantId=${tenantId}`, null, {
        method: 'POST',
        body: JSON.stringify({ entity: 'contact', rows: [] }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('viewer without create permission: returns 403 with the required permission', async () => {
    const response = await importPOST(
      makeRequest(`${BASE}/api/import?tenantId=${tenantId}`, viewerToken, {
        method: 'POST',
        body: JSON.stringify({
          entity: 'contact',
          mapping: { firstName: 'name' },
          rows: [{ name: 'Заборонено' }],
        }),
      }),
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Недостатньо прав');
    expect(data.required).toBe('contact:create');
  });
});

describe('POST /api/deals/import and /api/tasks/import — thin wrappers', () => {
  it('deal import: creates on the default pipeline and returns the report', async () => {
    const response = await dealsImportPOST(
      makeRequest(`${BASE}/api/deals/import?tenantId=${tenantId}`, memberToken, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'create',
          mapping: { title: 't', value: 'v' },
          rows: [{ t: 'Імпортна угода', v: '100' }],
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.report).toMatchObject({ created: 1, updated: 0, skipped: 0, errors: [] });

    const deal = await prisma.deal.findFirst({ where: { tenantId, title: 'Імпортна угода' } });
    expect(deal?.pipelineId).toBe(pipelineId);
    expect(deal?.stageId).toBe(firstStageId);
    expect(deal?.value).toBe(100);
    expect(deal?.ownerId).toBe(memberId);
  });

  it('deal import: viewer gets 403 from withAuth permission check', async () => {
    const response = await dealsImportPOST(
      makeRequest(`${BASE}/api/deals/import?tenantId=${tenantId}`, viewerToken, {
        method: 'POST',
        body: JSON.stringify({ mapping: { title: 't' }, rows: [{ t: 'Заборонена угода' }] }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it('task import: creates a task with dd.mm.yyyy dueDate and returns the report', async () => {
    const response = await tasksImportPOST(
      makeRequest(`${BASE}/api/tasks/import?tenantId=${tenantId}`, memberToken, {
        method: 'POST',
        body: JSON.stringify({
          mapping: { title: 't', dueDate: 'd' },
          rows: [{ t: 'Імпортна задача', d: '01.02.2026' }],
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.report).toMatchObject({ created: 1, updated: 0, skipped: 0, errors: [] });

    const task = await prisma.task.findFirst({ where: { tenantId, title: 'Імпортна задача' } });
    expect(task?.dueDate?.getTime()).toBe(new Date(2026, 1, 1).getTime());
    expect(task?.assigneeId).toBe(memberId);
  });
});

describe('POST /api/contacts/import — legacy contract + engine report', () => {
  it('keeps the legacy response fields and adds report', async () => {
    const response = await contactsImportPOST(
      makeRequest(`${BASE}/api/contacts/import?tenantId=${tenantId}`, memberToken, {
        method: 'POST',
        body: JSON.stringify({
          rows: [{ name: 'Легасі', mail: 'leg@x.com' }, { name: '' }],
          mapping: { firstName: 'name', email: 'mail' },
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    // Legacy fields are kept as-is…
    expect(data.total).toBe(2);
    expect(data.imported).toBe(1);
    expect(data.skipped).toBe(0);
    expect(Array.isArray(data.errors)).toBe(true);
    expect(data.errors[0].row).toBe(2);
    expect(data.errors[0].error).toContain('firstName');
    // …and the engine report is added.
    expect(data.report).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    expect(data.report.errors[0].row).toBe(2);

    const contact = await prisma.contact.findFirst({ where: { tenantId, email: 'leg@x.com' } });
    expect(contact?.firstName).toBe('Легасі');
  });

  it('mode: "upsert" with externalId mapping actualizes instead of duplicating', async () => {
    const response = await contactsImportPOST(
      makeRequest(`${BASE}/api/contacts/import?tenantId=${tenantId}`, memberToken, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'upsert',
          rows: [{ name: 'Легасі 2', mail: 'leg@x.com', code: 'LEG-1' }],
          mapping: { firstName: 'name', email: 'mail', externalId: 'code' },
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.report).toMatchObject({ created: 0, updated: 1, skipped: 0, errors: [] });

    const matches = await prisma.contact.findMany({ where: { tenantId, email: 'leg@x.com' } });
    expect(matches).toHaveLength(1);
    expect(matches[0].firstName).toBe('Легасі 2');
    expect(matches[0].externalId).toBe('LEG-1');
  });
});
