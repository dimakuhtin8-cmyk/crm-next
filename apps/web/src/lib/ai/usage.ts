/**
 * AI Usage Tracking — per-tenant usage limits and logging
 *
 * Default limits:
 * - 1500 requests/day per tenant (configurable via aiDailyLimit)
 * - Warning at 90% usage
 * - Block at 100%
 */

import { prisma } from '@crm-next/database';
import { cache } from '@/lib/cache';

const USAGE_CACHE_TTL = 60_000; // 1 minute
const COUNTER_CACHE_PREFIX = 'ai:usage:';

export interface UsageStatus {
  allowed: boolean;
  current: number;
  limit: number;
  percentage: number;
  isWarning: boolean;
  isExceeded: boolean;
  resetAt: Date;
}

export interface UsageStats {
  today: { requests: number; limit: number; percentage: number };
  month: { requests: number; tokensIn: number; tokensOut: number };
  byProvider: Record<string, { requests: number; tokensIn: number; tokensOut: number }>;
  recentLogs: Array<{
    id: string;
    provider: string;
    model: string;
    status: string;
    durationMs: number;
    createdAt: Date;
  }>;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get tenant's daily limit
 */
export async function getTenantLimit(tenantId: string): Promise<number> {
  const cacheKey = `${COUNTER_CACHE_PREFIX}limit:${tenantId}`;
  const cached = cache.get<number>(cacheKey);
  if (cached !== null) return cached;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiDailyLimit: true },
  });

  const limit = tenant?.aiDailyLimit || 1500;
  cache.set(cacheKey, limit, 300_000); // cache 5 min
  return limit;
}

/**
 * Get or create today's usage counter
 */
async function getTodayCounter(tenantId: string, provider: string): Promise<number> {
  const date = getToday();
  const cacheKey = `${COUNTER_CACHE_PREFIX}${tenantId}:${provider}:${date}`;
  const cached = cache.get<number>(cacheKey);
  if (cached !== null) return cached;

  const counter = await prisma.aiUsageCounter.findUnique({
    where: { tenantId_provider_date: { tenantId, provider, date } },
    select: { requests: true },
  });

  const count = counter?.requests || 0;
  cache.set(cacheKey, count, USAGE_CACHE_TTL);
  return count;
}

/**
 * Check if a request is allowed under the tenant's limits
 */
export async function checkUsageLimit(
  tenantId: string,
  provider: string
): Promise<UsageStatus> {
  const [current, limit] = await Promise.all([
    getTodayCounter(tenantId, provider),
    getTenantLimit(tenantId),
  ]);

  const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
  const isWarning = percentage >= 90;
  const isExceeded = current >= limit;

  // Reset at midnight UTC
  const now = new Date();
  const resetAt = new Date(now);
  resetAt.setUTCHours(24, 0, 0, 0);

  return {
    allowed: !isExceeded,
    current,
    limit,
    percentage,
    isWarning,
    isExceeded,
    resetAt,
  };
}

/**
 * Increment usage counter (after successful request)
 */
export async function incrementUsage(
  tenantId: string,
  provider: string,
  tokensIn: number = 0,
  tokensOut: number = 0
): Promise<void> {
  const date = getToday();

  await prisma.aiUsageCounter.upsert({
    where: { tenantId_provider_date: { tenantId, provider, date } },
    create: { tenantId, provider, date, requests: 1, tokensIn, tokensOut },
    update: {
      requests: { increment: 1 },
      tokensIn: { increment: tokensIn },
      tokensOut: { increment: tokensOut },
    },
  });

  // Invalidate cache
  const cacheKey = `${COUNTER_CACHE_PREFIX}${tenantId}:${provider}:${date}`;
  cache.delete(cacheKey);
}

/**
 * Log an AI request
 */
export async function logAiRequest(data: {
  tenantId: string;
  provider: string;
  model: string;
  status: 'success' | 'error' | 'rate_limited' | 'timeout';
  durationMs: number;
  promptPreview?: string;
  errorMessage?: string;
  tokensIn?: number;
  tokensOut?: number;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        tenantId: data.tenantId,
        provider: data.provider,
        model: data.model,
        status: data.status,
        durationMs: data.durationMs,
        promptPreview: data.promptPreview?.slice(0, 100) || null,
        errorMessage: data.errorMessage || null,
        tokensIn: data.tokensIn || null,
        tokensOut: data.tokensOut || null,
      },
    });
  } catch (err) {
    // Don't let logging failures break AI requests
    console.error('Failed to log AI request:', err);
  }
}

/**
 * Get usage statistics for a tenant
 */
export async function getUsageStats(tenantId: string): Promise<UsageStats> {
  const today = getToday();
  const monthStart = getMonthStart();
  const limit = await getTenantLimit(tenantId);

  // Today's requests across all providers
  const todayCounters = await prisma.aiUsageCounter.findMany({
    where: { tenantId, date: today },
  });
  const todayRequests = todayCounters.reduce((sum, c) => sum + c.requests, 0);

  // Month totals
  const monthCounters = await prisma.aiUsageCounter.findMany({
    where: {
      tenantId,
      date: { gte: monthStart },
    },
  });
  const monthRequests = monthCounters.reduce((sum, c) => sum + c.requests, 0);
  const monthTokensIn = monthCounters.reduce((sum, c) => sum + c.tokensIn, 0);
  const monthTokensOut = monthCounters.reduce((sum, c) => sum + c.tokensOut, 0);

  // By provider (this month)
  const byProvider: Record<string, { requests: number; tokensIn: number; tokensOut: number }> = {};
  for (const c of monthCounters) {
    if (!byProvider[c.provider]) {
      byProvider[c.provider] = { requests: 0, tokensIn: 0, tokensOut: 0 };
    }
    byProvider[c.provider].requests += c.requests;
    byProvider[c.provider].tokensIn += c.tokensIn;
    byProvider[c.provider].tokensOut += c.tokensOut;
  }

  // Recent logs (last 20)
  const recentLogs = await prisma.aiUsageLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      provider: true,
      model: true,
      status: true,
      durationMs: true,
      createdAt: true,
    },
  });

  return {
    today: {
      requests: todayRequests,
      limit,
      percentage: limit > 0 ? Math.round((todayRequests / limit) * 100) : 0,
    },
    month: {
      requests: monthRequests,
      tokensIn: monthTokensIn,
      tokensOut: monthTokensOut,
    },
    byProvider,
    recentLogs,
  };
}

/**
 * Get paginated logs for a tenant
 */
export async function getAiLogs(
  tenantId: string,
  options: {
    page?: number;
    limit?: number;
    provider?: string;
    status?: string;
    from?: string;
    to?: string;
  } = {}
): Promise<{
  logs: Array<{
    id: string;
    provider: string;
    model: string;
    status: string;
    durationMs: number;
    promptPreview: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const { page = 1, limit = 20, provider, status, from, to } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };
  if (provider) where.provider = provider;
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.aiUsageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        provider: true,
        model: true,
        status: true,
        durationMs: true,
        promptPreview: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.aiUsageLog.count({ where }),
  ]);

  return { logs, total, page, limit };
}
