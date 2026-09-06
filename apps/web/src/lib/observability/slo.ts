/**
 * SLO (Service Level Objectives) — целевые показатели надёжности
 * 
 * Концепция:
 * - SLI (Service Level Indicator) — что измеряем (latency, availability, errors)
 * - SLO (Service Level Objective) —目標값 (99.9% availability, p99 < 500ms)
 * - Error Budget — сколько ещё можем позволить ошибок
 * 
 * Наши SLO:
 * - Availability: 99.9% (8.76 часов простоя в год)
 * - Latency p99: < 500ms
 * - Error Rate: < 0.1%
 * - Data Durability: 99.999999% (8 ноликов)
 */

import { metrics } from './metrics';
import { createLogger } from '@/lib/logging/logger';

const log = createLogger({ service: 'slo' });

// ============ SLO Definitions ============

export interface SLO {
  name: string;
  description: string;
  target: number; // percent (e.g., 99.9)
  windowDays: number; // measurement window
}

export interface SLI {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface ErrorBudget {
  sloName: string;
  totalBudget: number; // total allowed errors
  consumed: number; // consumed errors
  remaining: number;
  remainingPercent: number;
  exhaustsAt: Date | null; // when budget will be exhausted
  status: 'healthy' | 'warning' | 'exhausted';
}

// ============ SLO Registry ============

export const SLO_REGISTRY: Record<string, SLO> = {
  availability: {
    name: 'availability',
    description: 'Час роботи сервісу',
    target: 99.9, // 99.9%
    windowDays: 30,
  },
  latency: {
    name: 'latency',
    description: 'Час відповіді API (p99)',
    target: 99.0, // 99% запитів < 500ms
    windowDays: 30,
  },
  errorRate: {
    name: 'errorRate',
    description: 'Частка помилкових запитів',
    target: 99.9, // < 0.1% ошибок
    windowDays: 30,
  },
};

// ============ SLI Calculations ============

/**
 * Рассчитать Availability SLI
 * = (total - errors) / total * 100
 */
export function calculateAvailabilitySLI(
  totalRequests: number,
  errorRequests: number
): SLI {
  const availability = totalRequests > 0
    ? ((totalRequests - errorRequests) / totalRequests) * 100
    : 100;

  return {
    name: 'availability',
    value: Math.round(availability * 100) / 100,
    unit: '%',
    timestamp: Date.now(),
  };
}

/**
 * Рассчитать Latency SLI
 * = % запросов < threshold
 */
export function calculateLatencySLI(
  latencies: number[],
  thresholdMs: number = 500
): SLI {
  if (latencies.length === 0) {
    return {
      name: 'latency',
      value: 100,
      unit: '%',
      timestamp: Date.now(),
    };
  }

  const withinThreshold = latencies.filter(l => l < thresholdMs).length;
  const percentage = (withinThreshold / latencies.length) * 100;

  return {
    name: 'latency',
    value: Math.round(percentage * 100) / 100,
    unit: '%',
    timestamp: Date.now(),
  };
}

/**
 * Рассчитать Error Rate SLI
 * = (1 - errors / total) * 100
 */
export function calculateErrorRateSLI(
  totalRequests: number,
  errorRequests: number
): SLI {
  const errorRate = totalRequests > 0
    ? (1 - errorRequests / totalRequests) * 100
    : 100;

  return {
    name: 'errorRate',
    value: Math.round(errorRate * 100) / 100,
    unit: '%',
    timestamp: Date.now(),
  };
}

// ============ Error Budget ============

/**
 * Рассчитать Error Budget
 */
export function calculateErrorBudget(
  slo: SLO,
  totalRequests: number,
  errorRequests: number
): ErrorBudget {
  // Error budget = (100% - target%) * total requests
  const allowedErrorPercent = (100 - slo.target) / 100;
  const totalBudget = Math.floor(totalRequests * allowedErrorPercent);
  const consumed = errorRequests;
  const remaining = Math.max(0, totalBudget - consumed);
  const remainingPercent = totalBudget > 0
    ? Math.round((remaining / totalBudget) * 100)
    : 100;

  // Определяем статус
  let status: ErrorBudget['status'] = 'healthy';
  if (remainingPercent <= 0) {
    status = 'exhausted';
  } else if (remainingPercent <= 20) {
    status = 'warning';
  }

  // Рассчитываем, когда закончится бюджет
  let exhaustsAt: Date | null = null;
  if (consumed > 0 && remaining > 0) {
    const errorRate = consumed / (Date.now() / 1000); // errors per second
    const secondsUntilExhaust = remaining / errorRate;
    exhaustsAt = new Date(Date.now() + secondsUntilExhaust * 1000);
  }

  return {
    sloName: slo.name,
    totalBudget,
    consumed,
    remaining,
    remainingPercent,
    exhaustsAt,
    status,
  };
}

// ============ SLO Monitor ============

class SLOMonitor {
  private requestLog: { timestamp: number; duration: number; isError: boolean }[] = [];
  private windowMs: number = 30 * 24 * 60 * 60 * 1000; // 30 дней

  /**
   * Записать запрос
   */
  recordRequest(durationMs: number, isError: boolean): void {
    this.requestLog.push({
      timestamp: Date.now(),
      duration: durationMs,
      isError,
    });

    // Очищаем старые записи
    this.cleanup();
  }

  /**
   * Получить все SLI
   */
  getSLIs(): SLI[] {
    const { total, errors, latencies } = this.getWindowStats();

    return [
      calculateAvailabilitySLI(total, errors),
      calculateLatencySLI(latencies),
      calculateErrorRateSLI(total, errors),
    ];
  }

  /**
   * Получить все Error Budgets
   */
  getErrorBudgets(): ErrorBudget[] {
    const { total, errors } = this.getWindowStats();

    return Object.values(SLO_REGISTRY).map(slo =>
      calculateErrorBudget(slo, total, errors)
    );
  }

  /**
   * Получить статус SLO
   */
  getSLOStatus(): {
    overall: 'healthy' | 'warning' | 'critical';
    slos: { name: string; status: string; sli: SLI; budget: ErrorBudget }[];
  } {
    const sliMap = new Map(this.getSLIs().map(sli => [sli.name, sli]));
    const budgets = this.getErrorBudgets();

    const slos = budgets.map(budget => ({
      name: budget.sloName,
      status: budget.status,
      sli: sliMap.get(budget.sloName)!,
      budget,
    }));

    // Overall status
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (slos.some(s => s.budget.status === 'exhausted')) {
      overall = 'critical';
    } else if (slos.some(s => s.budget.status === 'warning')) {
      overall = 'warning';
    }

    return { overall, slos };
  }

  /**
   * Проверить, в рамках ли SLO
   */
  isWithinSLO(): boolean {
    const { overall } = this.getSLOStatus();
    return overall === 'healthy';
  }

  /**
   * Получить статистику за окно
   */
  private getWindowStats(): { total: number; errors: number; latencies: number[] } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const windowRequests = this.requestLog.filter(r => r.timestamp >= windowStart);

    return {
      total: windowRequests.length,
      errors: windowRequests.filter(r => r.isError).length,
      latencies: windowRequests.map(r => r.duration),
    };
  }

  /**
   * Очистить старые записи
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.requestLog = this.requestLog.filter(r => r.timestamp >= cutoff);
  }
}

export const sloMonitor = new SLOMonitor();

// ============ Alerting Rules ============

export interface AlertRule {
  name: string;
  condition: (slos: ReturnType<typeof sloMonitor.getSLOStatus>) => boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export const ALERT_RULES: AlertRule[] = [
  {
    name: 'slo_exhausted',
    condition: (slos) => slos.overall === 'critical',
    severity: 'critical',
    message: 'Error Budget вичерпано! Потрібне негайне втручання.',
  },
  {
    name: 'slo_warning',
    condition: (slos) => slos.overall === 'warning',
    severity: 'warning',
    message: 'Error Budget наближається до вичерпання.',
  },
  {
    name: 'high_latency',
    condition: (slos) => {
      const latencySLI = slos.slos.find(s => s.name === 'latency');
      return latencySLI ? latencySLI.sli.value < 95 : false;
    },
    severity: 'warning',
    message: 'Час відповіді API перевищує норму.',
  },
];

/**
 * Проверить алерты
 */
export function checkAlerts(): AlertRule[] {
  const slos = sloMonitor.getSLOStatus();
  return ALERT_RULES.filter(rule => rule.condition(slos));
}

// ============ Dashboard Data ============

/**
 * Получить данные для SLO дашборда
 */
export function getSLODashboardData() {
  const slos = sloMonitor.getSLOStatus();
  const alerts = checkAlerts();

  return {
    timestamp: new Date().toISOString(),
    overall: slos.overall,
    slo: slos.slos.map(s => ({
      name: s.name,
      description: SLO_REGISTRY[s.name]?.description,
      target: SLO_REGISTRY[s.name]?.target,
      current: s.sli.value,
      budget: {
        remaining: s.budget.remaining,
        remainingPercent: s.budget.remainingPercent,
        status: s.budget.status,
      },
    })),
    alerts: alerts.map(a => ({
      name: a.name,
      severity: a.severity,
      message: a.message,
    })),
  };
}
