export interface CheckResult {
  status: 'ok' | 'degraded' | 'error';
  responseTime: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: CheckResult;
    firebase: CheckResult;
    ollama: CheckResult;
    memory: CheckResult;
  };
}
