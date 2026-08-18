import { checkDatabase, checkFirebase, checkOllama, checkMemory } from './checks';

import type { HealthCheckResult } from './types';

export async function getHealthCheck(): Promise<HealthCheckResult> {
  const [database, firebase, ollama, memory] = await Promise.all([
    checkDatabase(),
    checkFirebase(),
    checkOllama(),
    Promise.resolve(checkMemory()),
  ]);

  const checks = { database, firebase, ollama, memory };
  const hasError = Object.values(checks).some((c) => c.status === 'error');
  const hasDegraded = Object.values(checks).some((c) => c.status === 'degraded');

  return {
    status: hasError ? 'error' : hasDegraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    checks,
  };
}
