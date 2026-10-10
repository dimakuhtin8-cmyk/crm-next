/**
 * Резолв ефективної AI-моделі: збережена, але зникла у провайдера,
 * мовчки підміняється першою живою — відповідь є замість 404.
 * Мокається ТІЛЬКИ fetch (исходящий models.list провайдера).
 */

import { prisma } from '@crm-next/database';
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';

import { setProviderKey } from '@/lib/ai/keys';
import { resolveEffectiveModel } from '@/lib/ai/models';

const STATIC = [
  { id: 'gpt-live-a', name: 'Live A' },
  { id: 'gpt-static', name: 'Static' },
];

function mockLiveList() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-live-a' }, { id: 'gpt-live-b' }] }),
    })) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

let tenantId = '';

beforeAll(async () => {
  const t = await prisma.tenant.create({
    data: { name: 'Model Resolve', slug: `model-resolve-${Date.now()}` },
  });
  tenantId = t.id;
  await setProviderKey(tenantId, 'openai', 'sk-test-resolve');
});

afterAll(async () => {
  await prisma.aiProviderKey.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
});

describe('resolveEffectiveModel', () => {
  it('залишає збережену модель, якщо провайдер її ще віддає', async () => {
    mockLiveList();
    const r = await resolveEffectiveModel(tenantId, 'openai', 'gpt-live-a', STATIC);
    expect(r.model).toBe('gpt-live-a');
    expect(r.substituted).toBe(false);
  });

  it('підміняє зниклу модель першою живою з allowlist', async () => {
    mockLiveList();
    const r = await resolveEffectiveModel(tenantId, 'openai', 'gpt-retired-old', STATIC);
    expect(r.model).toBe('gpt-live-a');
    expect(r.substituted).toBe(true);
    expect(r.requested).toBe('gpt-retired-old');
  });

  it('без збереженої моделі бере першу живу', async () => {
    mockLiveList();
    const r = await resolveEffectiveModel(tenantId, 'openai', null, STATIC);
    expect(r.model).toBe('gpt-live-a');
    expect(r.substituted).toBe(true);
  });
});
