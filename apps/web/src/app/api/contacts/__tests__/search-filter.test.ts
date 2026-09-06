/**
 * search + dataFilter — интеграционный тест комбинации.
 * Регрессия: Object.assign(where, dataFilter) затирал where.OR от search,
 * и member с ?search=... получал все свои записи без учёта поиска.
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

import { GET } from '@/app/api/contacts/route';

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
    data: { name: 'Test Tenant', slug: 'test-search-filter-c', plan: 'professional' },
  });
  tenantId = tenant.id;

  const memberA = await prisma.user.create({
    data: { email: 'membera-search-c@test.com', name: 'Member A' },
  });
  memberAId = memberA.id;
  await prisma.tenantMember.create({
    data: { userId: memberAId, tenantId, role: 'member' },
  });

  const memberB = await prisma.user.create({
    data: { email: 'memberb-search-c@test.com', name: 'Member B' },
  });
  memberBId = memberB.id;
  await prisma.tenantMember.create({
    data: { userId: memberBId, tenantId, role: 'member' },
  });

  await prisma.contact.create({
    data: { tenantId, firstName: 'Zzzsearchable', ownerId: memberAId },
  });
  await prisma.contact.create({
    data: { tenantId, firstName: 'Plainname', ownerId: memberAId },
  });
  await prisma.contact.create({
    data: { tenantId, firstName: 'Zzzsearchable', ownerId: memberBId },
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
  it('memberA ?search=Zzzsearchable → только свой совпадающий контакт', async () => {
    const token = await createToken({ id: memberAId, tenantId });
    const req = makeRequest(
      `http://localhost:3000/api/contacts?tenantId=${tenantId}&search=Zzzsearchable`,
      token
    );

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    const names = data.contacts.map((c: any) => c.firstName);

    expect(data.contacts.length).toBe(1);
    expect(names).toEqual(['Zzzsearchable']);
    // Чужой Zzzsearchable (memberB) отфильтрован владельцем:
    expect(data.contacts.every((c: any) => c.ownerId === memberAId)).toBe(true);
  });

  it('memberA ?search=Nomatch → пусто, а не "все свои"', async () => {
    const token = await createToken({ id: memberAId, tenantId });
    const req = makeRequest(
      `http://localhost:3000/api/contacts?tenantId=${tenantId}&search=Nomatch`,
      token
    );

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contacts.length).toBe(0);
  });
});
