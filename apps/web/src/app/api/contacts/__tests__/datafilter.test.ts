/**
 * dataFilter (ownerId) — интеграционный тест (реальный route handler + реальная БД + JWT)
 * Паттерн скопирован с tasks/__tests__/datafilter.test.ts.
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
    data: { name: 'Test Tenant', slug: 'test-df-contacts', plan: 'professional' },
  });
  tenantId = tenant.id;

  const memberA = await prisma.user.create({
    data: { email: 'membera-contacts@test.com', name: 'Member A' },
  });
  memberAId = memberA.id;
  await prisma.tenantMember.create({
    data: { userId: memberAId, tenantId, role: 'member' },
  });

  const memberB = await prisma.user.create({
    data: { email: 'memberb-contacts@test.com', name: 'Member B' },
  });
  memberBId = memberB.id;
  await prisma.tenantMember.create({
    data: { userId: memberBId, tenantId, role: 'member' },
  });

  const admin = await prisma.user.create({
    data: { email: 'admin-contacts@test.com', name: 'Admin' },
  });
  adminId = admin.id;
  await prisma.tenantMember.create({
    data: { userId: adminId, tenantId, role: 'admin' },
  });

  await prisma.contact.create({
    data: { tenantId, firstName: 'CONTACT_A_OWN', ownerId: memberAId },
  });

  await prisma.contact.create({
    data: { tenantId, firstName: 'CONTACT_B_OWN', ownerId: memberBId },
  });

  await prisma.contact.create({
    data: { tenantId, firstName: 'CONTACT_UNASSIGNED', ownerId: null },
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

describe('dataFilter (ownerId) — member sees only own + unassigned contacts', () => {
  it('memberA: sees CONTACT_A_OWN + CONTACT_UNASSIGNED, does NOT see CONTACT_B_OWN', async () => {
    const token = await createToken({ id: memberAId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/contacts?tenantId=${tenantId}`, token);

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    const names = data.contacts.map((c: any) => c.firstName);

    expect(names).toContain('CONTACT_A_OWN');
    expect(names).toContain('CONTACT_UNASSIGNED');
    expect(names).not.toContain('CONTACT_B_OWN');
    expect(data.contacts.length).toBe(2);
  });

  it('memberB: sees CONTACT_B_OWN + CONTACT_UNASSIGNED, does NOT see CONTACT_A_OWN', async () => {
    const token = await createToken({ id: memberBId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/contacts?tenantId=${tenantId}`, token);

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    const names = data.contacts.map((c: any) => c.firstName);

    expect(names).toContain('CONTACT_B_OWN');
    expect(names).toContain('CONTACT_UNASSIGNED');
    expect(names).not.toContain('CONTACT_A_OWN');
    expect(data.contacts.length).toBe(2);
  });

  it('admin: sees ALL contacts (filter must not restrict higher roles)', async () => {
    const token = await createToken({ id: adminId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/contacts?tenantId=${tenantId}`, token);

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    const names = data.contacts.map((c: any) => c.firstName);

    expect(names).toContain('CONTACT_A_OWN');
    expect(names).toContain('CONTACT_B_OWN');
    expect(names).toContain('CONTACT_UNASSIGNED');
    expect(data.contacts.length).toBe(3);
  });

  it('unauthenticated: returns 401', async () => {
    const req = new NextRequest(new URL(`http://localhost:3000/api/contacts?tenantId=${tenantId}`));

    const response = await GET(req);
    expect(response.status).toBe(401);
  });
});
