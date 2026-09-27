/**
 * П4.4: кэш списков моделей — повторный запрос в пределах TTL не бьёт по сети.
 * Мокается ТОЛЬКО fetch (исходящий HTTP к провайдеру).
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { prisma } from '@crm-next/database';

import { getProviderModels } from '@/lib/ai/models';
import { setProviderKey } from '@/lib/ai/keys';

let fetchCalls = 0;

function mockModelsFetch() {
  fetchCalls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      fetchCalls++;
      return {
        ok: true,
        json: async () => ({ data: [{ id: 'gpt-mock-a' }, { id: 'gpt-mock-b' }] }),
      } as unknown as Response;
    })
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

let tenantId = '';

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

  const t = await prisma.tenant.create({ data: { name: 'Models', slug: 'models-cache', plan: 'professional' } });
  tenantId = t.id;
  // Уникальный провайдер на тест, чтобы не пересечься с кэшем других файлов.
  await setProviderKey(tenantId, 'openai', 'sk-test-cache-key');
});

afterAll(async () => {
  vi.unstubAllGlobals();
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

describe('П4.4: кэш моделей', () => {
  it('первый запрос идёт в сеть (live), второй — из кэша (fetch не вызывается)', async () => {
    mockModelsFetch();
    const first = await getProviderModels(tenantId, 'openai', []);
    expect(first.source).toBe('live');
    expect(first.models.map((m) => m.id)).toEqual(['gpt-mock-a', 'gpt-mock-b']);
    expect(fetchCalls).toBe(1);

    const second = await getProviderModels(tenantId, 'openai', []);
    expect(second.source).toBe('cache');
    expect(second.models.map((m) => m.id)).toEqual(['gpt-mock-a', 'gpt-mock-b']);
    expect(fetchCalls).toBe(1);
  });

  it('упавший провайдер → static fallback, а не исключение', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, text: async () => 'err' }) as unknown as Response)
    );
    const r = await getProviderModels(tenantId, 'groq', [{ id: 'static-x', name: 'Static X' }]);
    // groq без ключа: ключа нет → сразу static (fetch вообще не вызывается)
    expect(r.source).toBe('static');
    expect(r.models).toEqual([{ id: 'static-x', name: 'Static X' }]);
  });
});
