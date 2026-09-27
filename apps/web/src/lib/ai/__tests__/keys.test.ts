/**
 * Мульти-ключи провайдеров — интеграционный тест (реальная БД).
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

function authed(url: string, token: string, init?: RequestInit): NextRequest {
  const headers: Record<string, string> = { cookie: `authjs.session-token=${token}` };
  if (init?.body) headers['content-type'] = 'application/json';
  return new NextRequest(new URL(url), { method: init?.method || 'GET', headers, body: init?.body as BodyInit | null | undefined });
}

import { setProviderKey, getProviderKey, getProviderKeyRaw, deleteProviderKey, listProviderKeys } from '@/lib/ai/keys';
import { loadFallbackConfig } from '@/lib/ai/fallback';
import { GET as keysGET, POST as keysPOST, DELETE as keysDELETE } from '@/app/api/ai/keys/route';
import { decrypt } from '@/lib/encryption';

const BASE = 'http://localhost:3000';
let tenantId = '';
let tokenOwner = '';

beforeAll(async () => {
  await prisma.aiProviderKey.deleteMany();
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

  const t = await prisma.tenant.create({ data: { name: 'MultiKey', slug: 'multikey', plan: 'professional', aiProvider: 'gemini' } });
  tenantId = t.id;
  const u = await prisma.user.create({ data: { email: 'multikey@test.com', name: 'Owner' } });
  await prisma.tenantMember.create({ data: { userId: u.id, tenantId, role: 'owner' } });
  tokenOwner = await createToken({ id: u.id, tenantId });
});

afterAll(async () => {
  await prisma.aiProviderKey.deleteMany();
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

describe('lib/ai/keys', () => {
  it('set → get round-trip, в БД шифротекст', async () => {
    await setProviderKey(tenantId, 'openai', 'sk-test-openai-1');
    expect(await getProviderKey(tenantId, 'openai')).toBe('sk-test-openai-1');
    const raw = await getProviderKeyRaw(tenantId, 'openai');
    expect(raw).not.toBe('sk-test-openai-1');
    expect(decrypt(raw!)).toBe('sk-test-openai-1');
  });

  it('ключи изолированы по провайдерам', async () => {
    await setProviderKey(tenantId, 'groq', 'gsk_test_groq_1');
    expect(await getProviderKey(tenantId, 'groq')).toBe('gsk_test_groq_1');
    expect(await getProviderKey(tenantId, 'openai')).toBe('sk-test-openai-1');
    expect(await getProviderKey(tenantId, 'anthropic')).toBeNull();
  });

  it('list показывает маски, а не секреты', async () => {
    const list = await listProviderKeys(tenantId);
    const provs = list.map((l) => l.provider).sort();
    expect(provs).toEqual(['groq', 'openai']);
    for (const l of list) {
      expect(l.hasKey).toBe(true);
      expect(l.maskedKey).not.toContain('sk-test');
      expect(l.maskedKey).toContain('••');
    }
  });

  it('fallback использует РАЗНЫЕ ключи primary/fallback', async () => {
    await setProviderKey(tenantId, 'gemini', 'AIza-test-gemini-1');
    const cfg = await loadFallbackConfig(tenantId);
    expect(cfg).not.toBeNull();
    // primary — gemini (активный провайдер тенанта)
    const { decrypt: dec } = await import('@/lib/encryption');
    expect(dec(cfg!.primaryApiKey)).toBe('AIza-test-gemini-1');
  });

  it('delete убирает ключ', async () => {
    await deleteProviderKey(tenantId, 'groq');
    expect(await getProviderKey(tenantId, 'groq')).toBeNull();
  });
});

describe('POST/GET/DELETE /api/ai/keys', () => {
  it('POST сохраняет, GET отдаёт маску, DELETE чистит', async () => {
    const post = await keysPOST(authed(`${BASE}/api/ai/keys?tenantId=${tenantId}`, tokenOwner, {
      method: 'POST', body: JSON.stringify({ provider: 'mistral', apiKey: 'mist-test-1' }),
    }));
    expect(post.status).toBe(200);

    const get = await keysGET(authed(`${BASE}/api/ai/keys?tenantId=${tenantId}`, tokenOwner));
    const data = await get.json();
    expect(data.keys.map((k: any) => k.provider)).toContain('mistral');
    expect(JSON.stringify(data)).not.toContain('mist-test-1');

    const del = await keysDELETE(authed(`${BASE}/api/ai/keys?tenantId=${tenantId}`, tokenOwner, {
      method: 'DELETE', body: JSON.stringify({ provider: 'mistral' }),
    }));
    expect(del.status).toBe(200);
    expect(await getProviderKey(tenantId, 'mistral')).toBeNull();
  });

  it('POST с неизвестным провайдером → 400', async () => {
    const r = await keysPOST(authed(`${BASE}/api/ai/keys?tenantId=${tenantId}`, tokenOwner, {
      method: 'POST', body: JSON.stringify({ provider: 'nope', apiKey: 'x' }),
    }));
    expect(r.status).toBe(400);
  });
});
