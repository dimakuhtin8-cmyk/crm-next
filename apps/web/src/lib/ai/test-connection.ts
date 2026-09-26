/**
 * AI Provider Connection Testing
 *
 * Tests API key validity by sending a minimal request.
 * Returns structured result with status and message.
 */

import { getProvider } from './providers';
import { decrypt } from '@/lib/encryption';

export interface TestResult {
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  provider: string;
  model: string;
  lastChecked: Date;
  latencyMs: number;
}

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  together: 'https://api.together.xyz/v1/chat/completions',
};

function maskKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

async function testGemini(apiKey: string, model: string): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return { ok: true, message: `Підключено. Латентність: ${latencyMs}ms`, latencyMs };
    }

    if (res.status === 400 || res.status === 403) {
      return { ok: false, message: `Невірний API-ключ (${res.status})`, latencyMs };
    }

    return { ok: false, message: `Помилка сервера: ${res.status}`, latencyMs };
  } catch (err) {
    return { ok: false, message: `Тайм-аут з'єднання (${Date.now() - start}ms)`, latencyMs: Date.now() - start };
  }
}

async function testOpenAICompatible(
  providerId: string,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const endpoint = PROVIDER_ENDPOINTS[providerId];
  if (!endpoint) {
    return { ok: false, message: 'Невідомий провайдер', latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    };

    // Anthropic uses different headers and body format
    if (providerId === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
      body.system = 'You are a helpful assistant.';
      body.max_tokens = 1;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return { ok: true, message: `Підключено. Латентність: ${latencyMs}ms`, latencyMs };
    }

    // 400 = key is valid but request format issue (key works)
    if (res.status === 400) {
      return { ok: true, message: `Ключ валідний (400 — тестовий запит). ${latencyMs}ms`, latencyMs };
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: `Невірний API-ключ (${res.status})`, latencyMs };
    }

    if (res.status === 429) {
      return { ok: true, message: `Ключ валідний, але досягнуто ліміт запитів (${res.status}). ${latencyMs}ms`, latencyMs };
    }

    const errText = await res.text().catch(() => 'Unknown error');
    return { ok: false, message: `Помилка ${res.status}: ${errText.slice(0, 100)}`, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { ok: false, message: `Тайм-аут з'єднання (${latencyMs}ms)`, latencyMs };
    }
    return { ok: false, message: `Помилка з'єднання: ${err instanceof Error ? err.message : 'Unknown'}`, latencyMs };
  }
}

/**
 * Test a RAW (plaintext, not yet saved) API key against the specified provider.
 * Used by POST /api/ai/test-key where the key comes straight from the form.
 */
export async function testProviderConnection(
  providerId: string,
  rawApiKey: string,
  model?: string
): Promise<TestResult> {
  const provider = getProvider(providerId);
  if (!provider) {
    return {
      status: 'error',
      message: `Невідомий провайдер: ${providerId}`,
      provider: providerId,
      model: model || 'unknown',
      lastChecked: new Date(),
      latencyMs: 0,
    };
  }

  const resolvedModel = model || provider.models[0]?.id || 'unknown';

  let result: { ok: boolean; message: string; latencyMs: number };

  if (providerId === 'gemini') {
    result = await testGemini(rawApiKey, resolvedModel);
  } else {
    result = await testOpenAICompatible(providerId, rawApiKey, resolvedModel);
  }

  return {
    status: result.ok ? 'connected' : 'error',
    message: result.message,
    provider: providerId,
    model: resolvedModel,
    lastChecked: new Date(),
    latencyMs: result.latencyMs,
  };
}

/**
 * Test a STORED (encrypted in DB) API key.
 * Decrypts first; a non-decryptable value means legacy/corrupt storage.
 */
export async function testStoredProviderConnection(
  providerId: string,
  storedKey: string,
  model?: string
): Promise<TestResult> {
  const provider = getProvider(providerId);
  const resolvedModel = model || provider?.models[0]?.id || 'unknown';

  let key: string;
  try {
    key = decrypt(storedKey);
  } catch {
    return {
      status: 'error',
      message: 'API-ключ повреждён или сохранён в устаревшем формате — пересохраните его в настройках',
      provider: providerId,
      model: resolvedModel,
      lastChecked: new Date(),
      latencyMs: 0,
    };
  }

  return testProviderConnection(providerId, key, model);
}

/**
 * Get connection status for all configured providers of a tenant
 */
export async function getAllProviderStatuses(
  tenantId: string
): Promise<TestResult[]> {
  const { prisma } = await import('@crm-next/database');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
      geminiApiKey: true,
      aiFallbackProvider: true,
    },
  });

  if (!tenant) return [];

  const results: TestResult[] = [];
  const tested = new Set<string>();

  // Test primary provider
  const primaryProvider = tenant.aiProvider || 'gemini';
  const primaryKey = tenant.aiApiKey || tenant.geminiApiKey;

  if (primaryKey && !tested.has(primaryProvider)) {
    const result = await testStoredProviderConnection(primaryProvider, primaryKey, tenant.aiModel || undefined);
    results.push(result);
    tested.add(primaryProvider);
  }

  // Test fallback provider if configured
  if (tenant.aiFallbackProvider && !tested.has(tenant.aiFallbackProvider)) {
    const fallbackKey = tenant.aiApiKey; // Same key field used for both
    if (fallbackKey) {
      const result = await testStoredProviderConnection(tenant.aiFallbackProvider, fallbackKey);
      results.push(result);
      tested.add(tenant.aiFallbackProvider);
    }
  }

  // If no providers configured, add a "not configured" entry
  if (results.length === 0) {
    results.push({
      status: 'not_configured',
      message: 'AI не налаштовано. Додайте API-ключ.',
      provider: primaryProvider,
      model: tenant.aiModel || 'unknown',
      lastChecked: new Date(),
      latencyMs: 0,
    });
  }

  return results;
}
