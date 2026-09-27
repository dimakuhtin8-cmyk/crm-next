import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';
import { getTenantQuery } from '@/lib/tenant-query';
import { getProvider } from '@/lib/ai/providers';
import { setProviderKey, getProviderKeyRaw } from '@/lib/ai/keys';
import { withAuth } from '@/lib/auth-guard';

async function POSTHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const { apiKey, provider, model } = body;

    const providerId = provider || 'gemini';
    const providerConfig = getProvider(providerId);
    if (!providerConfig) {
      return NextResponse.json({ error: 'Невідомий провайдер' }, { status: 400 });
    }

    // Activate an already-saved key without re-entering it.
    if (!apiKey) {
      const existing = await getProviderKeyRaw(tq.tenantId, providerId);
      if (!existing) {
        return NextResponse.json({ error: 'Для цього провайдера немає збереженого ключа' }, { status: 400 });
      }
      await prisma.tenant.update({
        where: { id: tq.tenantId },
        data: {
          aiProvider: providerId,
          aiModel: model || providerConfig.models[0]?.id || null,
        },
      });
      return NextResponse.json({ success: true, provider: providerId, activated: true });
    }

    if (typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'API-ключ обов\'язковий' }, { status: 400 });
    }

    // Validate key prefix if provider has one (supports multiple, e.g. AIza + AQ. for Gemini)
    const acceptedPrefixes = [
      providerConfig.keyPrefix,
      ...(providerConfig.keyPrefixes || []),
    ].filter(Boolean);
    if (acceptedPrefixes.length > 0 && !acceptedPrefixes.some((p) => apiKey.startsWith(p))) {
      return NextResponse.json({
        error: `Невірний формат ключа. Ключ ${providerConfig.name} повинен починатися з "${acceptedPrefixes.join('" або "')}"`,
      }, { status: 400 });
    }

    // Save to per-provider store (AiProviderKey) + keep legacy tenant
    // fields in sync for the active provider path.
    await setProviderKey(tq.tenantId, providerId, apiKey);

    // Prefetch + cache the live model list right away (best-effort).
    const { refreshProviderModels } = await import('@/lib/ai/models');
    await refreshProviderModels(tq.tenantId, providerId);

    await prisma.tenant.update({
      where: { id: tq.tenantId },
      data: {
        aiProvider: providerId,
        aiModel: model || providerConfig.models[0]?.id || null,
      },
    });

    return NextResponse.json({ success: true, provider: providerId });
  } catch (error) {
    console.error('Quick setup error:', error);
    return NextResponse.json({ error: 'Помилка налаштування' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'settings:update' })(POSTHandler);
