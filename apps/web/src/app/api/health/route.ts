/**
 * Health Check Endpoint
 *
 * Используется для:
 * - Мониторинга доступности (UptimeRobot, Pingdom)
 * - Kubernetes liveness/readiness probes
 * - Проверки перед деплоем
 *
 * GET /api/health
 *
 * Ответ:
 * - 200: всё ок
 * - 503: проблема с БД или сервисом
 */

import { statSync } from 'node:fs';
import v8 from 'node:v8';

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: CheckResult;
    memory: CheckResult;
    disk: CheckResult;
  };
}

interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  latencyMs?: number;
}

const startTime = Date.now();

export async function GET() {
  const checks: HealthCheck['checks'] = {
    database: await checkDatabase(),
    memory: checkMemory(),
    disk: checkDisk(),
  };

  // Определяем общий статус
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus: HealthCheck['status'] = 'healthy';

  if (statuses.includes('error')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('warning')) {
    overallStatus = 'degraded';
  }

  const health: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(health, { status: httpStatus });
}

/**
 * Проверка подключения к БД
 */
async function checkDatabase(): Promise<CheckResult> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;

    if (latencyMs > 1000) {
      return {
        status: 'warning',
        message: 'Повільне підключення до БД',
        latencyMs,
      };
    }

    return { status: 'ok', latencyMs };
  } catch (err: any) {
    return {
      status: 'error',
      message: err.message || 'Не вдалося підключитися до БД',
    };
  }
}

/**
 * Проверка использования памяти
 */
function checkMemory(): CheckResult {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  // heapTotal — текущий размер кучи V8 (растёт по мере необходимости), поэтому
  // % от heapTotal даёт ложные «критические» значения (например, 92% при
  // нормальной нагрузке). Реальный предел — heap_size_limit.
  const heapLimitMB = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
  const usagePercent = Math.round((heapUsedMB / heapLimitMB) * 100);

  if (usagePercent > 90) {
    return {
      status: 'error',
      message: `Критичне використання пам'яті: ${usagePercent}%`,
    };
  }

  if (usagePercent > 70) {
    return {
      status: 'warning',
      message: `Високе використання пам'яті: ${usagePercent}%`,
    };
  }

  return {
    status: 'ok',
    message: `${heapUsedMB}MB / ${heapLimitMB}MB (${usagePercent}%)`,
  };
}

/**
 * Проверка диска (упрощённая)
 */
function checkDisk(): CheckResult {
  // В Serverless (Vercel) диска нет — пропускаем
  if (process.env.VERCEL || process.env.RAILWAY_STATIC_URL) {
    return { status: 'ok', message: 'Serverless — disk check skipped' };
  }

  try {
    // Проверяем доступность файловой системы (размеры не нужны)
    statSync('.');
    return { status: 'ok', message: 'Доступний' };
  } catch {
    return { status: 'ok', message: 'Disk check not available' };
  }
}

/**
 * Простой ping endpoint
 * GET /api/health/ping
 */
export async function HEAD() {
  return new Response(null, { status: 200 });
}
