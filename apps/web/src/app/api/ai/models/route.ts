/**
 * GET /api/ai/models?provider=<id> — live model list for a provider.
 *
 * Uses the tenant's saved key, 24h cache, static fallback.
 * Never leaks the key — only ids/names + source are returned.
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { getProvider } from '@/lib/ai/providers';
import { getProviderModels } from '@/lib/ai/models';
import { withAuth } from '@/lib/auth-guard';

async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider') || 'gemini';
    const provider = getProvider(providerId);
    if (!provider) {
      return NextResponse.json({ error: 'Невідомий провайдер' }, { status: 400 });
    }

    const result = await getProviderModels(
      tq.tenantId,
      providerId,
      provider.models.map((m) => ({ id: m.id, name: m.name }))
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('List AI models error:', error);
    return NextResponse.json({ error: 'Помилка отримання моделей' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
