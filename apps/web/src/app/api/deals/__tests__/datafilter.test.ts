/**
 * dataFilter (ownerId) — интеграционный тест (реальный route handler + реальная БД + JWT)
 * Паттерн скопирован с tasks/__tests__/datafilter.test.ts.
 * NOTE: GET /api/deals отвечает через apiSuccess → тело лежит в data.data.
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

function makeRequest(url: string, token: string): NextRequest {
  return new NextRequest(new URL(url), {
    headers: {
      cookie: `authjs.session-token=${token}`,
    },
  });
}

import { GET } from '@/app/api/deals/route';

let tenantId: string;
let memberAId: string;
let memberBId: string;
let adminId: string;

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
    data: { name: 'Test Tenant', slug: 'test-df-deals', plan: 'professional' },
  });
  tenantId = tenant.id;

  const memberA = await prisma.user.create({
    data: { email: 'membera-deals@test.com', name: 'Member A' },
  });
  memberAId = memberA.id;
  await prisma.tenantMember.create({
    data: { userId: memberAId, tenantId, role: 'member' },
  });

  const memberB = await prisma.user.create({
    data: { email: 'memberb-deals@test.com', name: 'Member B' },
  });
  memberBId = memberB.id;
  await prisma.tenantMember.create({
    data: { userId: memberBId, tenantId, role: 'member' },
  });

  const admin = await prisma.user.create({
    data: { email: 'admin-deals@test.com', name: 'Admin' },
  });
  adminId = admin.id;
  await prisma.tenantMember.create({
    data: { userId: adminId, tenantId, role: 'admin' },
  });

  const pipeline = await prisma.pipeline.create({
    data: { tenantId, name: 'Test Pipeline' },
  });
  const stage = await prisma.pipelineStage.create({
    data: { pipelineId: pipeline.id, name: 'New', order: 0 },
  });

  await prisma.deal.create({
    data: { tenantId, pipelineId: pipeline.id, stageId: stage.id, title: 'DEAL_A_OWN', ownerId: memberAId },
  });

  await prisma.deal.create({
    data: { tenantId, pipelineId: pipeline.id, stageId: stage.id, title: 'DEAL_B_OWN', ownerId: memberBId },
  });

  await prisma.deal.create({
    data: { tenantId, pipelineId: pipeline.id, stageId: stage.id, title: 'DEAL_UNASSIGNED', ownerId: null },
  });
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

describe('dataFilter (ownerId) — member sees only own + unassigned deals', () => {
  it('memberA: sees DEAL_A_OWN + DEAL_UNASSIGNED, does NOT see DEAL_B_OWN', async () => {
    const token = await createToken({ id: memberAId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/deals?tenantId=${tenantId}`, token);

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    const titles = body.data.deals.map((d: any) => d.title);

    expect(titles).toContain('DEAL_A_OWN');
    expect(titles).toContain('DEAL_UNASSIGNED');
    expect(titles).not.toContain('DEAL_B_OWN');
    expect(body.data.deals.length).toBe(2);
  });

  it('memberB: sees DEAL_B_OWN + DEAL_UNASSIGNED, does NOT see DEAL_A_OWN', async () => {
    const token = await createToken({ id: memberBId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/deals?tenantId=${tenantId}`, token);

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    const titles = body.data.deals.map((d: any) => d.title);

    expect(titles).toContain('DEAL_B_OWN');
    expect(titles).toContain('DEAL_UNASSIGNED');
    expect(titles).not.toContain('DEAL_A_OWN');
    expect(body.data.deals.length).toBe(2);
  });

  it('admin: sees ALL deals (filter must not restrict higher roles)', async () => {
    const token = await createToken({ id: adminId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/deals?tenantId=${tenantId}`, token);

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    const titles = body.data.deals.map((d: any) => d.title);

    expect(titles).toContain('DEAL_A_OWN');
    expect(titles).toContain('DEAL_B_OWN');
    expect(titles).toContain('DEAL_UNASSIGNED');
    expect(body.data.deals.length).toBe(3);
  });

  it('unauthenticated: returns 401', async () => {
    const req = new NextRequest(new URL(`http://localhost:3000/api/deals?tenantId=${tenantId}`));

    const response = await GET(req);
    expect(response.status).toBe(401);
  });
});
