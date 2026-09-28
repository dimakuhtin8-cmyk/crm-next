// П6: чеклист «Перші кроки» вычисляется из данных.
// Пустой тенант → все false; после создания контакта → hasContacts true.

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { GET as checklistGET } from '@/app/api/onboarding/checklist/route';

const SECRET = new TextEncoder().encode('4p200FzdKSNdfxdHaoTOa9m6WoEzmwEbl0CqrcuPOgc=');

async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(SECRET);
}

function authed(url: string, token: string): NextRequest {
  return new NextRequest(new URL(url), {
    headers: { cookie: `authjs.session-token=${token}` },
  });
}

const BASE = 'http://localhost:3000';
let tenantId = '';
let token = '';

beforeAll(async () => {
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const t = await prisma.tenant.create({ data: { name: 'Steps', slug: 'first-steps' } });
  tenantId = t.id;
  const u = await prisma.user.create({ data: { email: 'steps@test.com', name: 'S' } });
  await prisma.tenantMember.create({ data: { userId: u.id, tenantId, role: 'owner' } });
  token = await createToken({ id: u.id, tenantId });
});

afterAll(async () => {
  await prisma.contact.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('П6: onboarding checklist', () => {
  it('пустой тенант → все шаги false', async () => {
    const r = await checklistGET(
      authed(`${BASE}/api/onboarding/checklist?tenantId=${tenantId}`, token),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      hasContacts: false,
      hasDeals: false,
      telegramConnected: false,
      aiConnected: false,
      hasTeammates: false,
    });
  });

  it('после создания контакта hasContacts → true, остальные false', async () => {
    await prisma.contact.create({ data: { tenantId, firstName: 'Step' } });
    const r = await checklistGET(
      authed(`${BASE}/api/onboarding/checklist?tenantId=${tenantId}`, token),
    );
    const body = await r.json();
    expect(body.hasContacts).toBe(true);
    expect(body.hasDeals).toBe(false);
    expect(body.hasTeammates).toBe(false);
  });
});
