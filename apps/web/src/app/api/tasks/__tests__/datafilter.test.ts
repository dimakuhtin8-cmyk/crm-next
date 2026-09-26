/**
 * P1: dataFilter — интеграционный тест (реальный route handler + реальная БД + JWT)
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

import { GET } from '@/app/api/tasks/route';

let tenantId: string;
let memberAId: string;
let memberBId: string;
let taskAssignedToA: string;
let taskAssignedToB: string;
let taskUnassigned: string;

beforeAll(async () => {
  // Cleanup in reverse FK order
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { name: 'Test Tenant', slug: 'test-df-filter', plan: 'professional' },
  });
  tenantId = tenant.id;

  const memberA = await prisma.user.create({
    data: { email: 'membera-filter@test.com', name: 'Member A' },
  });
  memberAId = memberA.id;
  await prisma.tenantMember.create({
    data: { userId: memberAId, tenantId, role: 'member' },
  });

  const memberB = await prisma.user.create({
    data: { email: 'memberb-filter@test.com', name: 'Member B' },
  });
  memberBId = memberB.id;
  await prisma.tenantMember.create({
    data: { userId: memberBId, tenantId, role: 'member' },
  });

  const taskA = await prisma.task.create({
    data: { tenantId, title: 'TASK_A_OWN', assigneeId: memberAId },
  });
  taskAssignedToA = taskA.id;

  const taskB = await prisma.task.create({
    data: { tenantId, title: 'TASK_B_OWN', assigneeId: memberBId },
  });
  taskAssignedToB = taskB.id;

  const taskNone = await prisma.task.create({
    data: { tenantId, title: 'TASK_UNASSIGNED', assigneeId: null },
  });
  taskUnassigned = taskNone.id;
});

afterAll(async () => {
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('P1: dataFilter — member sees only own + unassigned tasks', () => {
  it('memberA: sees TASK_A_OWN + TASK_UNASSIGNED, does NOT see TASK_B_OWN', async () => {
    const token = await createToken({ id: memberAId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/tasks?tenantId=${tenantId}`, token);

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    const titles = data.tasks.map((t: any) => t.title);

    expect(titles).toContain('TASK_A_OWN');
    expect(titles).toContain('TASK_UNASSIGNED');
    expect(titles).not.toContain('TASK_B_OWN');
    expect(data.tasks.length).toBe(2);
  });

  it('memberB: sees TASK_B_OWN + TASK_UNASSIGNED, does NOT see TASK_A_OWN', async () => {
    const token = await createToken({ id: memberBId, tenantId });
    const req = makeRequest(`http://localhost:3000/api/tasks?tenantId=${tenantId}`, token);

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    const titles = data.tasks.map((t: any) => t.title);

    expect(titles).toContain('TASK_B_OWN');
    expect(titles).toContain('TASK_UNASSIGNED');
    expect(titles).not.toContain('TASK_A_OWN');
    expect(data.tasks.length).toBe(2);
  });

  it('unauthenticated: returns 401', async () => {
    const req = new NextRequest(new URL(`http://localhost:3000/api/tasks?tenantId=${tenantId}`));

    const response = await GET(req);
    expect(response.status).toBe(401);
  });
});
