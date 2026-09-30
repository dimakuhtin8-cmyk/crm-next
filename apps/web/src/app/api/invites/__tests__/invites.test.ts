// Інвайти в команду: створення, прийняття, захист (інтеграційний тест).

import { prisma } from '@crm-next/database';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

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

import { POST as acceptPOST } from '@/app/api/invites/[token]/route';
import { POST as invitesPOST } from '@/app/api/tenants/[id]/invites/route';

const BASE = 'http://localhost:3000';
const tctx = (id: string) => ({ params: Promise.resolve({ id }) });
const tokctx = (token: string) => ({ params: Promise.resolve({ token }) });

let tenantId = '';
let tokenOwner = '';
let tokenMember = '';
let tokenStranger = '';

beforeAll(async () => {
  await prisma.invite.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const t = await prisma.tenant.create({ data: { name: 'Invite Co', slug: 'invite-co' } });
  tenantId = t.id;
  const mk = async (email: string, role: string) => {
    const u = await prisma.user.create({ data: { email, name: email } });
    await prisma.tenantMember.create({ data: { userId: u.id, tenantId, role } });
    return u;
  };
  const owner = await mk('inv-owner@test.com', 'owner');
  const member = await mk('inv-member@test.com', 'member');
  const stranger = await prisma.user.create({ data: { email: 'stranger@test.com', name: 'S' } });
  tokenOwner = await createToken({ id: owner.id, tenantId });
  tokenMember = await createToken({ id: member.id, tenantId });
  tokenStranger = await createToken({ id: stranger.id });
  // Користувачі, яких запрошуватимуть
  await prisma.user.create({ data: { email: 'newbie@test.com', name: 'N' } });
  await prisma.user.create({ data: { email: 'other@test.com', name: 'O' } });
  await prisma.user.create({ data: { email: 'expired@test.com', name: 'E' } });
});

afterAll(async () => {
  await prisma.invite.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  vi.unstubAllGlobals();
});

describe('інвайти: створення', () => {
  it('member запрошувати не може → 403', async () => {
    const r = await invitesPOST(
      makeRequest(`${BASE}/api/tenants/${tenantId}/invites`, tokenMember, {
        method: 'POST',
        body: JSON.stringify({ email: 'newbie@test.com', role: 'member' }),
      }),
      tctx(tenantId),
    );
    expect(r.status).toBe(403);
  });

  it('owner створює інвайт → 201 (лист не пішов без Resend, але інвайт є)', async () => {
    const r = await invitesPOST(
      makeRequest(`${BASE}/api/tenants/${tenantId}/invites`, tokenOwner, {
        method: 'POST',
        body: JSON.stringify({ email: 'newbie@test.com', role: 'member' }),
      }),
      tctx(tenantId),
    );
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.invite.email).toBe('newbie@test.com');
    expect(typeof body.emailSent).toBe('boolean');
    expect(body.inviteUrl).toContain('/invites/');
  });

  it('успішна відправка через Resend → emailSent true', async () => {
    process.env.RESEND_API_KEY = 're_test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => ({ ok: true, json: async () => ({ id: 're_test' }) }) as unknown as Response,
      ),
    );
    try {
      const r = await invitesPOST(
        makeRequest(`${BASE}/api/tenants/${tenantId}/invites`, tokenOwner, {
          method: 'POST',
          body: JSON.stringify({ email: 'other@test.com', role: 'viewer' }),
        }),
        tctx(tenantId),
      );
      expect(r.status).toBe(201);
      expect((await r.json()).emailSent).toBe(true);
    } finally {
      delete process.env.RESEND_API_KEY;
      vi.unstubAllGlobals();
    }
  });

  it('повторний інвайт на той самий email → 400', async () => {
    const r = await invitesPOST(
      makeRequest(`${BASE}/api/tenants/${tenantId}/invites`, tokenOwner, {
        method: 'POST',
        body: JSON.stringify({ email: 'newbie@test.com', role: 'member' }),
      }),
      tctx(tenantId),
    );
    expect(r.status).toBe(400);
  });
});

describe('інвайти: прийняття', () => {
  it('свій email → success + membership з роллю', async () => {
    const inv = await prisma.invite.findFirst({ where: { email: 'newbie@test.com' } });
    const tokenNewbie = await createToken({
      id: (await prisma.user.findUnique({ where: { email: 'newbie@test.com' } }))!.id,
    });
    const r = await acceptPOST(
      makeRequest(`${BASE}/api/invites/${inv!.token}`, tokenNewbie, { method: 'POST' }),
      tokctx(inv!.token),
    );
    expect(r.status).toBe(200);
    const membership = await prisma.tenantMember.findFirst({
      where: { tenantId, user: { email: 'newbie@test.com' } },
    });
    expect(membership?.role).toBe('member');
  });

  it('повторне прийняття → 400', async () => {
    const inv = await prisma.invite.findFirst({ where: { email: 'newbie@test.com' } });
    const tokenNewbie = await createToken({
      id: (await prisma.user.findUnique({ where: { email: 'newbie@test.com' } }))!.id,
    });
    const r = await acceptPOST(
      makeRequest(`${BASE}/api/invites/${inv!.token}`, tokenNewbie, { method: 'POST' }),
      tokctx(inv!.token),
    );
    expect(r.status).toBe(400);
  });

  it('чужий email → 403, membership не створюється', async () => {
    const inv = await prisma.invite.findFirst({ where: { email: 'other@test.com' } });
    const r = await acceptPOST(
      makeRequest(`${BASE}/api/invites/${inv!.token}`, tokenStranger, { method: 'POST' }),
      tokctx(inv!.token),
    );
    expect(r.status).toBe(403);
    const membership = await prisma.tenantMember.findFirst({
      where: { tenantId, user: { email: 'stranger@test.com' } },
    });
    expect(membership).toBeNull();
  });

  it('прострочений інвайт → 400', async () => {
    const expired = await prisma.invite.create({
      data: {
        email: 'expired@test.com',
        tenantId,
        role: 'member',
        token: 'expired-token-123',
        expiresAt: new Date(Date.now() - 1000),
        invitedById: (await prisma.user.findFirst({ where: { email: 'inv-owner@test.com' } }))!.id,
      },
    });
    const tokenExpired = await createToken({
      id: (await prisma.user.findUnique({ where: { email: 'expired@test.com' } }))!.id,
    });
    const r = await acceptPOST(
      makeRequest(`${BASE}/api/invites/${expired.token}`, tokenExpired, { method: 'POST' }),
      tokctx(expired.token),
    );
    expect(r.status).toBe(400);
  });
});
