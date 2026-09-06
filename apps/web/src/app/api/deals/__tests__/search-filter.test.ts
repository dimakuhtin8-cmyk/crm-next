/**
 * search + dataFilter — интеграционный тест комбинации (deals).
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

beforeAll(async () => {
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
    data: { name: 'Test Tenant', slug: 'test-search-filter-d', plan: 'professional' },
  });
  tenantId = tenant.id;

  const memberA = await prisma.user.create({
    data: { email: 'membera-search-d@test.com', name: 'Member A' },
  });
  memberAId = memberA.id;
  await prisma.tenantMember.create({
    data: { userId: memberAId, tenantId, role: 'member' },
  });

  const memberB = await prisma.user.create({
    data: { email: 'memberb-search-d@test.com', name: 'Member B' },
  });
  memberBId = memberB.id;
  await prisma.tenantMember.create({
    data: { userId: memberBId, tenantId, role: 'member' },
  });

  const pipeline = await prisma.pipeline.create({
    data: { tenantId, name: 'Test Pipeline' },
  });
  const stage = await prisma.pipelineStage.create({
    data: { pipelineId: pipeline.id, name: 'New', order: 0 },
  });

  await prisma.deal.create({
    data: { tenantId, pipelineId: pipeline.id, stageId: stage.id, title: 'Zzzsearchable', ownerId: memberAId },
  });
  await prisma.deal.create({
    data: { tenantId, pipelineId: pipeline.id, stageId: stage.id, title: 'Plaindeal', ownerId: memberAId },
  });
  await prisma.deal.create({
    data: { tenantId, pipelineId: pipeline.id, stageId: stage.id, title: 'Zzzsearchable', ownerId: memberBId },
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

describe('member: search + dataFilter combine with AND, not overwrite', () => {
  it('memberA ?search=Zzzsearchable → только своя совпадающая сделка', async () => {
    const token = await createToken({ id: memberAId, tenantId });
    const req = makeRequest(
      `http://localhost:3000/api/deals?tenantId=${tenantId}&search=Zzzsearchable`,
      token
    );

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    const titles = body.data.deals.map((d: any) => d.title);

    expect(body.data.deals.length).toBe(1);
    expect(titles).toEqual(['Zzzsearchable']);
    expect(body.data.deals.every((d: any) => d.ownerId === memberAId)).toBe(true);
  });

  it('memberA ?search=Nomatch → пусто, а не "все свои"', async () => {
    const token = await createToken({ id: memberAId, tenantId });
    const req = makeRequest(
      `http://localhost:3000/api/deals?tenantId=${tenantId}&search=Nomatch`,
      token
    );

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.deals.length).toBe(0);
  });
});
