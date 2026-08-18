import type { CheckResult } from './types';

export async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    await pool.end();

    return {
      status: 'ok',
      responseTime: Date.now() - start,
      details: {
        time: result.rows[0].time,
      },
    };
  } catch {
    return {
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Database not configured',
    };
  }
}

export async function checkFirebase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { getAuth } = await import('firebase-admin/auth');
    await getAuth();
    return {
      status: 'ok',
      responseTime: Date.now() - start,
    };
  } catch {
    return {
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Firebase not configured',
    };
  }
}

export async function checkOllama(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();

    return {
      status: 'ok',
      responseTime: Date.now() - start,
      details: {
        models: data.models?.length || 0,
      },
    };
  } catch {
    return {
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Ollama not available',
    };
  }
}

export function checkMemory(): CheckResult {
  const start = Date.now();
  const usage = process.memoryUsage();
  const totalMb = Math.round(usage.heapTotal / 1024 / 1024);
  const usedMb = Math.round(usage.heapUsed / 1024 / 1024);
  const percentUsed = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  return {
    status: percentUsed > 90 ? 'degraded' : 'ok',
    responseTime: Date.now() - start,
    details: {
      heapUsed: `${usedMb}MB`,
      heapTotal: `${totalMb}MB`,
      percentUsed: `${percentUsed}%`,
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    },
  };
}
