/**
 * API-ключи по провайдерам (мульти-ключи).
 *
 * GET    /api/ai/keys — список провайдеров с маской ключа (без секретов)
 * POST   /api/ai/keys — сохранить ключ { provider, apiKey }
 * DELETE /api/ai/keys — удалить ключ { provider }
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { getProvider } from '@/lib/ai/providers';
import { listProviderKeys, setProviderKey, deleteProviderKey } from '@/lib/ai/keys';
import { withAuth } from '@/lib/auth-guard';

async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const keys = await listProviderKeys(tq.tenantId);
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('List AI keys error:', error);
    return NextResponse.json({ error: 'Помилка отримання ключів' }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const { provider, apiKey } = body as { provider?: unknown; apiKey?: unknown };

    if (!provider || typeof provider !== 'string' || !getProvider(provider)) {
      return NextResponse.json({ error: 'Невідомий провайдер' }, { status: 400 });
    }
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json({ error: 'API-ключ обов\'язковий' }, { status: 400 });
    }

    await setProviderKey(tq.tenantId, provider, apiKey.trim());
    // Prefetch + cache the live model list right away (best-effort).
    const { refreshProviderModels } = await import('@/lib/ai/models');
    await refreshProviderModels(tq.tenantId, provider);
    const keys = await listProviderKeys(tq.tenantId);
    return NextResponse.json({ success: true, keys });
  } catch (error) {
    console.error('Save AI key error:', error);
    return NextResponse.json({ error: 'Помилка збереження ключа' }, { status: 500 });
  }
}

async function DELETEHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { provider } = body as { provider?: unknown };
    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({ error: 'Вкажіть провайдера' }, { status: 400 });
    }

    await deleteProviderKey(tq.tenantId, provider);
    const keys = await listProviderKeys(tq.tenantId);
    return NextResponse.json({ success: true, keys });
  } catch (error) {
    console.error('Delete AI key error:', error);
    return NextResponse.json({ error: 'Помилка видалення ключа' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
export const POST = withAuth({ permission: 'settings:update' })(POSTHandler);
export const DELETE = withAuth({ permission: 'settings:update' })(DELETEHandler);
