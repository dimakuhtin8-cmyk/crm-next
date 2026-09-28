// П3: client-api — развёртка apiSuccess и типизированные ошибки.
// Мокается только fetch (сетевой слой), логика хелпера реальная.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ApiError, apiGet, apiSend } from '@/lib/client-api';

beforeEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(res: { ok: boolean; status: number; json: unknown } | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (res instanceof Error) throw res;
      return {
        ok: res.ok,
        status: res.status,
        json: async () => res.json,
      } as unknown as Response;
    }),
  );
}

describe('П3: client-api', () => {
  it('apiGet разворачивает apiSuccess { success, data }', async () => {
    mockFetch({ ok: true, status: 200, json: { success: true, data: { deals: [1] } } });
    const out = await apiGet<{ deals: number[] }>('/api/deals');
    expect(out).toEqual({ deals: [1] });
  });

  it('apiGet отдаёт обычный JSON как есть', async () => {
    mockFetch({ ok: true, status: 200, json: { contacts: [], total: 0 } });
    const out = await apiGet<{ contacts: unknown[] }>('/api/contacts');
    expect(out).toEqual({ contacts: [], total: 0 });
  });

  it('500 с error в теле → ApiError с текстом сервера и статусом', async () => {
    mockFetch({ ok: false, status: 500, json: { error: 'Помилка отримання шаблонів' } });
    try {
      await apiGet('/api/documents/templates');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe('Помилка отримання шаблонів');
      expect((err as ApiError).status).toBe(500);
    }
  });

  it('сбой сети → ApiError со статусом 0 (а не пусто)', async () => {
    mockFetch(new Error('fetch failed'));
    try {
      await apiGet('/api/search?q=x');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
    }
  });

  it('apiSend POST шлёт JSON и разворачивает ответ', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 201,
          json: async () => ({ contact: { id: 'c1' } }),
        }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await apiSend<{ contact: { id: string } }>('/api/contacts', 'POST', {
      firstName: 'A',
    });
    expect(out).toEqual({ contact: { id: 'c1' } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ firstName: 'A' }));
  });
});
