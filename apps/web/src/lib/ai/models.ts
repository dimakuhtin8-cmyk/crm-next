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

import { cache } from '@/lib/cache';
import { getProviderKey } from './keys';

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

/**
 * Fetch the live model list from the provider. Throws on any failure —
 * callers decide the fallback.
 */
export async function fetchProviderModels(provider: string, apiKey: string): Promise<DynamicModel[]> {
  switch (provider) {
    case 'gemini': {
      // VERIFIED live (models.list, Sep 2026).
      const data = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        {}
      );
      const models = Array.isArray(data?.models) ? data.models : [];
      return models
        .filter((m: any) =>
          Array.isArray(m?.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          typeof m?.name === 'string'
        )
        .map((m: any) => {
          const id = String(m.name).replace(/^models\//, '');
          return { id, name: id };
        })
        .slice(0, 50);
    }
    case 'openai': {
      // Standard endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.openai.com/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return openAiStyleIds(data)
        .filter((id) => id.startsWith('gpt-'))
        .sort()
        .slice(0, 50)
        .map((id) => ({ id, name: id }));
    }
    case 'anthropic': {
      // Documented endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.anthropic.com/v1/models', {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      });
      return openAiStyleIds(data)
        .sort()
        .slice(0, 50)
        .map((id) => ({ id, name: id }));
    }
    case 'deepseek': {
      // Documented endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.deepseek.com/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return openAiStyleIds(data)
        .sort()
        .slice(0, 50)
        .map((id) => ({ id, name: id }));
    }
    case 'groq': {
      // OpenAI-compatible endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.groq.com/openai/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return openAiStyleIds(data)
        .sort()
        .slice(0, 50)
        .map((id) => ({ id, name: id }));
    }
    case 'mistral': {
      // Documented endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.mistral.ai/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return openAiStyleIds(data)
        .sort()
        .slice(0, 50)
        .map((id) => ({ id, name: id }));
    }
    case 'together': {
      // Documented endpoint, НЕ ПРОВЕРЕНО live.
      const data = await fetchJson('https://api.together.xyz/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      });
      return openAiStyleIds(data)
        .sort()
        .slice(0, 50)
        .map((id) => ({ id, name: id }));
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
 * Get models for a tenant+provider: live fetch → 24h cache → static fallback.
 * `staticFallback` is the hardcoded providers.ts list (last resort, never throws).
 */
export async function getProviderModels(
  tenantId: string,
  provider: string,
  staticFallback: DynamicModel[] = []
): Promise<ModelListResult> {
  const key = cacheKey(tenantId, provider);

  // Fresh cache first — no network inside TTL.
  const fresh = cache.get<DynamicModel[]>(key);
  if (fresh) return { models: fresh, source: 'cache' };

  try {
    const apiKey = await getProviderKey(tenantId, provider);
    if (!apiKey) {
      const cached = cache.get<DynamicModel[]>(key);
      if (cached) return { models: cached, source: 'cache' };
      return { models: staticFallback, source: 'static' };
    }
    const models = await fetchProviderModels(provider, apiKey);
    if (models.length === 0) throw new Error('empty list');
    cache.set(key, models, MODELS_TTL_MS);
    return { models, source: 'live' };
  } catch {
    const cached = cache.get<DynamicModel[]>(key);
    if (cached) return { models: cached, source: 'cache' };
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
