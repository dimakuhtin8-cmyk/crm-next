import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';
import { getTenantQuery } from '@/lib/tenant-query';
import { getProvider } from '@/lib/ai/providers';
import { encrypt } from '@/lib/encryption';
import { withAuth } from '@/lib/auth-guard';

async function POSTHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const { apiKey, provider, model } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'API-ключ обов\'язковий' }, { status: 400 });
    }

    const providerId = provider || 'gemini';
    const providerConfig = getProvider(providerId);
    if (!providerConfig) {
      return NextResponse.json({ error: 'Невідомий провайдер' }, { status: 400 });
    }

    // Validate key prefix if provider has one
    if (providerConfig.keyPrefix && !apiKey.startsWith(providerConfig.keyPrefix)) {
      return NextResponse.json({
        error: `Невірний формат ключа. Ключ ${providerConfig.name} повинен починатися з "${providerConfig.keyPrefix}"`,
      }, { status: 400 });
    }

    // Always encrypt the API key before saving
    const encryptedKey = encrypt(apiKey);

    await prisma.tenant.update({
      where: { id: tq.tenantId },
      data: {
        aiProvider: providerId,
        aiModel: model || providerConfig.models[0]?.id || null,
        aiApiKey: encryptedKey,
        // Also set geminiApiKey for backward compatibility
        ...(providerId === 'gemini' ? { geminiApiKey: encryptedKey } : {}),
      },
    });

    return NextResponse.json({ success: true, provider: providerId });
  } catch (error) {
    console.error('Quick setup error:', error);
    return NextResponse.json({ error: 'Помилка налаштування' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'settings:update' })(POSTHandler);
