/**
 * Dynamic provider model lists.
 *
 * Static lists in providers.ts go stale in weeks (Gemini shipped 3 versions
 * in 5 weeks). This module fetches the real list from each provider using
 * the tenant's saved key, caches for 24h, and falls back to the static
 * list when the fetch fails or nothing was ever cached.
 *
 * Live-verified against real APIs: gemini only (models.list).
 * openai / anthropic / deepseek / groq / mistral / together: standard
 * documented endpoints, НЕ ПРОВЕРЕНО live (no keys available).
 */

import { getProviderKey } from './keys';

import { cache } from '@/lib/cache';

export interface DynamicModel {
  id: string;
  name: string;
}

const MODELS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(tenantId: string, provider: string): string {
  return `ai-models:${tenantId}:${provider}`;
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`models.list HTTP ${res.status}`);
  }
  return res.json();
}

function openAiStyleIds(data: any): string[] {
  const list = Array.isArray(data?.data) ? data.data : [];
  return list.map((m: any) => m?.id).filter((id: unknown): id is string => typeof id === 'string');
}

// Non-chat models (TTS, image, embeddings...) pollute the chat picker.
const NON_CHAT_PATTERN =
  /tts|whisper|dall-e|embedding|image|audio|transcribe|realtime|vision|moderation/i;

function toChatModels(ids: string[]): DynamicModel[] {
  return ids
    .filter((id) => !NON_CHAT_PATTERN.test(id))
    .sort()
    .slice(0, 50)
    .map((id) => ({ id, name: id }));
}

/**
 * Fetch the live model list from the provider. Throws on any failure —
 * callers decide the fallback.
 */
export async function fetchProviderModels(
  provider: string,
  apiKey: string,
): Promise<DynamicModel[]> {
  switch (provider) {
    case 'gemini': {
      // VERIFIED live (models.list, Sep 2026).
      const data = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        {},
      );
      const models = Array.isArray(data?.models) ? data.models : [];
      return models
        .filter(
          (m: any) =>
            Array.isArray(m?.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            typeof m?.name === 'string',
        )
        .map((m: any) => String(m.name).replace(/^models\//, ''))
        .filter((id: string) => !NON_CHAT_PATTERN.test(id))
        .slice(0, 50)
        .map((id: string) => ({ id, name: id }));
    }
    case 'openai': {
      // Standard endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.openai.com/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return toChatModels(openAiStyleIds(data).filter((id) => id.startsWith('gpt-')));
    }
    case 'anthropic': {
      // Documented endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.anthropic.com/v1/models', {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      });
      return toChatModels(openAiStyleIds(data));
    }
    case 'deepseek': {
      // Documented endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.deepseek.com/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return toChatModels(openAiStyleIds(data));
    }
    case 'groq': {
      // OpenAI-compatible endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.groq.com/openai/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return toChatModels(openAiStyleIds(data));
    }
    case 'mistral': {
      // Documented endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.mistral.ai/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return toChatModels(openAiStyleIds(data));
    }
    case 'together': {
      // Documented endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.together.xyz/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return toChatModels(openAiStyleIds(data));
    }
    default:
      throw new Error(`Невідомий провайдер: ${provider}`);
  }
}

export interface ModelListResult {
  models: DynamicModel[];
  source: 'live' | 'cache' | 'static';
}

/**
 * Allowlist: picker shows ONLY curated static models (providers.ts).
 * Live list may contain dozens of aliases/gemma/tts variants users never pick,
 * so we intersect live ∩ static. Static entries missing from live (renames lag)
 * are backfilled from the static list — picker always equals the curated set.
 */
function applyAllowlist(
  live: DynamicModel[],
  staticFallback: DynamicModel[],
): { models: DynamicModel[]; ok: boolean } {
  if (live.length === 0) {
    return { models: staticFallback, ok: false };
  }
  // Пустой static = allowlist не задан → живой список как есть (старое поведение).
  if (staticFallback.length === 0) {
    return { models: live, ok: true };
  }
  const allowed = new Set(staticFallback.map((m) => m.id));
  const liveIds = new Set(live.map((m) => m.id));
  const filtered = live.filter((m) => allowed.has(m.id));
  const missing = staticFallback.filter((m) => !liveIds.has(m.id));
  const picked = [...filtered, ...missing];
  if (picked.length === 0) return { models: staticFallback, ok: false };
  return { models: picked, ok: true };
}

/**
 * Get models for a tenant+provider: live fetch → 24h cache → static fallback.
 * `staticFallback` is the hardcoded providers.ts list (last resort, never throws).
 * Returned list is always allowlist-filtered (see applyAllowlist).
 */
export async function getProviderModels(
  tenantId: string,
  provider: string,
  staticFallback: DynamicModel[] = [],
): Promise<ModelListResult> {
  const key = cacheKey(tenantId, provider);

  // Fresh cache first — no network inside TTL.
  const fresh = cache.get<DynamicModel[]>(key);
  if (fresh) {
    const picked = applyAllowlist(fresh, staticFallback);
    return { models: picked.models, source: picked.ok ? 'cache' : 'static' };
  }

  try {
    const apiKey = await getProviderKey(tenantId, provider);
    if (!apiKey) {
      const cached = cache.get<DynamicModel[]>(key);
      if (cached) {
        const picked = applyAllowlist(cached, staticFallback);
        return { models: picked.models, source: picked.ok ? 'cache' : 'static' };
      }
      return { models: staticFallback, source: 'static' };
    }
    const models = await fetchProviderModels(provider, apiKey);
    const picked = applyAllowlist(models, staticFallback);
    if (!picked.ok) return { models: staticFallback, source: 'static' };
    cache.set(key, picked.models, MODELS_TTL_MS);
    return { models: picked.models, source: 'live' };
  } catch {
    const cached = cache.get<DynamicModel[]>(key);
    if (cached) {
      const picked = applyAllowlist(cached, staticFallback);
      return { models: picked.models, source: picked.ok ? 'cache' : 'static' };
    }
    return { models: staticFallback, source: 'static' };
  }
}

/** Prefetch + cache models right after a key is saved (best-effort, never throws). */
export async function refreshProviderModels(tenantId: string, provider: string): Promise<void> {
  try {
    const apiKey = await getProviderKey(tenantId, provider);
    if (!apiKey) return;
    const models = await fetchProviderModels(provider, apiKey);
    if (models.length > 0) {
      cache.set(cacheKey(tenantId, provider), models, MODELS_TTL_MS);
    }
  } catch {
    // best-effort: UI falls back to cache/static
  }
}
