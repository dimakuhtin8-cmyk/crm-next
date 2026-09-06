/**
 * ФАЗА 4 (шифрование): интеграционный тест
 *
 * Это интеграционный тест (реальный route handler + реальная БД + JWT),
 * кроме блока fail-fast (юнит-тест, явно помечен).
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

import { PUT as tenantsPUT } from '@/app/api/tenants/[id]/route';
import { POST as testKeyPOST } from '@/app/api/ai/test-key/route';
import { decrypt, encrypt, isEncrypted } from '@/lib/encryption';

const BASE = 'http://localhost:3000';
const tctx = (id: string) => ({ params: Promise.resolve({ id }) });

let tenantId = '';
let tokenOwner = '';
const RAW_KEY = 'sk-test-phase4-raw-67890';

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

  const t = await prisma.tenant.create({ data: { name: 'P4 Tenant', slug: 'p4-tenant', plan: 'professional' } });
  tenantId = t.id;
  const u = await prisma.user.create({ data: { email: 'p4-owner@test.com', name: 'Owner' } });
  await prisma.tenantMember.create({ data: { userId: u.id, tenantId, role: 'owner' } });
  tokenOwner = await createToken({ id: u.id, tenantId });
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

describe('ФАЗА 4.1: tenants PUT шифрует ключи', () => {
  it('PUT aiApiKey → в БД iv:tag:ciphertext, decrypt возвращает исходник', async () => {
    const r = await tenantsPUT(
      makeRequest(`${BASE}/api/tenants/${tenantId}`, tokenOwner, {
        method: 'PUT',
        body: JSON.stringify({ aiApiKey: RAW_KEY, aiProvider: 'openai' }),
      }),
      tctx(tenantId)
    );
    expect(r.status).toBe(200);

    const stored = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { aiApiKey: true } });
    expect(stored?.aiApiKey).not.toBe(RAW_KEY);
    expect(isEncrypted(stored?.aiApiKey || '')).toBe(true);
    expect(decrypt(stored?.aiApiKey || '')).toBe(RAW_KEY);
  });

  it('PUT geminiApiKey → тоже зашифрован', async () => {
    const raw = 'AIza-test-phase4-gemini';
    const r = await tenantsPUT(
      makeRequest(`${BASE}/api/tenants/${tenantId}`, tokenOwner, {
        method: 'PUT',
        body: JSON.stringify({ geminiApiKey: raw }),
      }),
      tctx(tenantId)
    );
    expect(r.status).toBe(200);

    const stored = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { geminiApiKey: true } });
    expect(stored?.geminiApiKey).not.toBe(raw);
    expect(decrypt(stored?.geminiApiKey || '')).toBe(raw);
  });
});

describe('ФАЗА 4.2: test-key принимает сырой ключ (не требует decrypt)', () => {
  it('POST с plaintext-ключом НЕ отвечает "повреждён"', async () => {
    const r = await testKeyPOST(
      makeRequest(`${BASE}/api/ai/test-key`, tokenOwner, {
        method: 'POST',
        body: JSON.stringify({ apiKey: 'sk-raw-form-key-12345', provider: 'openai', model: 'gpt-4o-mini' }),
      }),
      {}
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    // Ключ ушёл в реальную проверку (сеть недоступна/ключ левый),
    // но НЕ был отвергнут как "повреждённый формат хранения".
    expect(body.message || '').not.toMatch(/поврежд[её]н/);
  }, 30000);
});

describe('ФАЗА 4.3: fail-fast без ENCRYPTION_KEY (юнит-тест)', () => {
  it('encrypt() без ключа бросает явную ошибку, а не шифрует хардкодом', async () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      const { encrypt: enc } = await import('@/lib/encryption');
      expect(() => enc('secret')).toThrow('ENCRYPTION_KEY не задан');
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
    // sanity: с ключом работает как раньше
    expect(decrypt(encrypt('roundtrip'))).toBe('roundtrip');
  });
});
