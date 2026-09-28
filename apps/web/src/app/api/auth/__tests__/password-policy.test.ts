// П1.2: единая политика пароля — 8 символов при создании/смене,
// вход старых 6-символьных паролей не блокируется.

import { prisma } from '@crm-next/database';
import { hash } from 'bcryptjs';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { POST as credentialsPOST } from '@/app/api/auth/callback/credentials/route';
import { POST as registerPOST } from '@/app/api/auth/register/route';

function post(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE = 'http://localhost:3000';

beforeAll(async () => {
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

afterAll(async () => {
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('П1.2: политика пароля', () => {
  it('регистрация с 7 символами → 400', async () => {
    const r = await registerPOST(
      post(`${BASE}/api/auth/register`, {
        name: 'Short',
        email: 'short-pass@test.com',
        password: '1234567',
      }),
    );
    expect(r.status).toBe(400);
  });

  it('регистрация с 8 символами → успех', async () => {
    const r = await registerPOST(
      post(`${BASE}/api/auth/register`, {
        name: 'Ok',
        email: 'ok-pass@test.com',
        password: '12345678',
      }),
    );
    expect(r.status).toBe(200);
  });

  it('вход со старым 6-символьным паролем не блокируется', async () => {
    await prisma.user.create({
      data: { email: 'legacy-pass@test.com', name: 'Legacy', password: await hash('123456', 12) },
    });
    const r = await credentialsPOST(
      post(`${BASE}/api/auth/callback/credentials`, {
        email: 'legacy-pass@test.com',
        password: '123456',
      }),
    );
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
});
