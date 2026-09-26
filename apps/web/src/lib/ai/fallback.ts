/**
 * AI Fallback & Retry Logic
 *
 * When primary provider fails (429, 5xx, timeout):
 * 1. Retry up to 2 times with exponential backoff
 * 2. If still failing, try fallback provider (if configured)
 * 3. Log the fallback event
 */

import { prisma } from '@crm-next/database';
import { decrypt } from '@/lib/encryption';
import { getProvider } from './providers';
import { logAiRequest, incrementUsage } from './usage';

export interface FallbackConfig {
  tenantId: string;
  primaryProvider: string;
  primaryApiKey: string;
  primaryModel: string;
  fallbackProvider?: string;
  fallbackApiKey?: string;
  fallbackModel?: string;
}

export interface AiRequestOptions {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiResult {
  response: string;
  model: string;
  provider: string;
  retries: number;
  usedFallback: boolean;
}

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY = 1000; // 1 second

/**
 * Load fallback config from tenant
 */
export async function loadFallbackConfig(tenantId: string): Promise<FallbackConfig | null> {
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

  if (!tenant) return null;

  const primaryKey = tenant.aiApiKey || tenant.geminiApiKey || '';
  if (!primaryKey) return null;

  return {
    tenantId,
    primaryProvider: tenant.aiProvider || 'gemini',
    primaryApiKey: primaryKey,
    primaryModel: tenant.aiModel || getProvider(tenant.aiProvider || 'gemini')?.models[0]?.id || 'gemini-2.0-flash',
    fallbackProvider: tenant.aiFallbackProvider || undefined,
    fallbackApiKey: primaryKey, // Same key, different provider
    fallbackModel: undefined,
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit')) return true;
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return true;
    if (msg.includes('timeout') || msg.includes('econnreset')) return true;
  }
  return false;
}

/**
 * Execute AI request with retry and fallback
 */
export async function executeWithFallback(
  config: FallbackConfig,
  options: AiRequestOptions,
  executeFn: (provider: string, apiKey: string, model: string, opts: AiRequestOptions) => Promise<string>
): Promise<AiResult> {
  const startTime = Date.now();
  let lastError: unknown = null;
  let usedFallback = false;
  let retries = 0;

  // All keys must be encrypted
  const primaryKey = decrypt(config.primaryApiKey);

  // Try primary provider with retries
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await executeFn(
        config.primaryProvider,
        primaryKey,
        config.primaryModel,
        options
      );

      // Success — log and return
      const durationMs = Date.now() - startTime;
      await logAiRequest({
        tenantId: config.tenantId,
        provider: config.primaryProvider,
        model: config.primaryModel,
        status: 'success',
        durationMs,
        promptPreview: options.prompt,
      });
      await incrementUsage(config.tenantId, config.primaryProvider);

      return {
        response,
        model: config.primaryModel,
        provider: config.primaryProvider,
        retries: attempt,
        usedFallback: false,
      };
    } catch (error) {
      lastError = error;
      retries = attempt;

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      // Non-retryable or max retries reached — break to try fallback
      break;
    }
  }

  // Log the primary failure
  const durationMs = Date.now() - startTime;
  await logAiRequest({
    tenantId: config.tenantId,
    provider: config.primaryProvider,
    model: config.primaryModel,
    status: lastError instanceof Error &&
      (lastError.message.includes('429') || lastError.message.includes('rate limit'))
      ? 'rate_limited'
      : 'error',
    durationMs,
    promptPreview: options.prompt,
    errorMessage: lastError instanceof Error ? lastError.message : 'Unknown error',
  });

  // Try fallback provider if configured
  if (config.fallbackProvider && config.fallbackApiKey) {
    const fallbackKey = decrypt(config.fallbackApiKey);

    const fallbackModel = config.fallbackModel ||
      getProvider(config.fallbackProvider)?.models[0]?.id ||
      'unknown';

    try {
      const response = await executeFn(
        config.fallbackProvider,
        fallbackKey,
        fallbackModel,
        options
      );

      const fallbackDurationMs = Date.now() - startTime;
      await logAiRequest({
        tenantId: config.tenantId,
        provider: config.fallbackProvider,
        model: fallbackModel,
        status: 'success',
        durationMs: fallbackDurationMs,
        promptPreview: options.prompt,
      });
      await incrementUsage(config.tenantId, config.fallbackProvider);

      return {
        response,
        model: fallbackModel,
        provider: config.fallbackProvider,
        retries,
        usedFallback: true,
      };
    } catch (fallbackError) {
      await logAiRequest({
        tenantId: config.tenantId,
        provider: config.fallbackProvider,
        model: fallbackModel,
        status: 'error',
        durationMs: Date.now() - startTime,
        promptPreview: options.prompt,
        errorMessage: fallbackError instanceof Error ? fallbackError.message : 'Fallback failed',
      });
    }
  }

  // Both primary and fallback failed
  throw lastError || new Error('AI провайдер недоступний');
}
