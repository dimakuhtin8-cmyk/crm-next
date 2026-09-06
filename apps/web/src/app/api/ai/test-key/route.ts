/**
 * POST /api/ai/test-key — Test AI provider connection
 *
 * Body: { apiKey: string, provider: string, model?: string }
 * Returns: { status, message, provider, model, lastChecked, latencyMs }
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { testProviderConnection } from '@/lib/ai/test-connection';
import { withAuth } from '@/lib/auth-guard';

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, provider, model } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'API-ключ обов\'язковий' }, { status: 400 });
    }

    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({ error: 'Провайдер обов\'язковий' }, { status: 400 });
    }

    const result = await testProviderConnection(provider, apiKey, model);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test key error:', error);
    return NextResponse.json(
      { error: 'Помилка тестування ключа' },
      { status: 500 }
    );
  }
}

export const POST = withAuth({ permission: 'settings:update' })(POSTHandler);
