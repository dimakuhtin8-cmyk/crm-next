/**
 * Metrics Collection — сбор метрик производительности
 * 
 * Метрики:
 * - HTTP requests (count, latency, status codes)
 * - Database queries (count, latency)
 * - AI requests (count, latency, tokens, cost)
 * - Cache (hit/miss rate)
 * - Queue (pending, processing, failed)
 * - System (memory, CPU, uptime)
 * 
 * Хранение: In-Memory (для dev) → Prometheus/DataDog (для prod)
 */

import { createLogger } from '@/lib/logging/logger';

const log = createLogger({ service: 'metrics' });

// ============ Types ============

export interface MetricPoint {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

export interface Counter {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

export interface Histogram {
  name: string;
  buckets: HistogramBucket[];
  sum: number;
  count: number;
  labels?: Record<string, string>;
}

// ============ Metric Store ============

class MetricsStore {
  private counters = new Map<string, number>();
  private histograms = new Map<string, { values: number[]; labels?: Record<string, string> }>();
  private gauges = new Map<string, number>();
  private startTime = Date.now();

  /**
   * Увеличить счётчик
   */
  increment(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Записать значение в гистограмму
   */
  observe(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const histogram = this.histograms.get(key) || { values: [], labels };
    histogram.values.push(value);
    this.histograms.set(key, histogram);
  }

  /**
   * Установить gauge
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Получить все метрики в формате Prometheus
   */
  toPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters.entries()) {
      const [name, labelsStr] = this.parseKey(key);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${labelsStr} ${value}`);
    }

    // Histograms
    for (const [key, histogram] of this.histograms.entries()) {
      const [name, labelsStr] = this.parseKey(key);
      const buckets = this.calculateBuckets(histogram.values);
      
      lines.push(`# TYPE ${name} histogram`);
      for (const bucket of buckets) {
        const le = bucket.le === Infinity ? '+Inf' : String(bucket.le);
        lines.push(`${name}_bucket{le="${le}"}${labelsStr} ${bucket.count}`);
      }
      lines.push(`${name}_sum${labelsStr} ${histogram.values.reduce((a, b) => a + b, 0)}`);
      lines.push(`${name}_count${labelsStr} ${histogram.values.length}`);
    }

    // Gauges
    for (const [key, value] of this.gauges.entries()) {
      const [name, labelsStr] = this.parseKey(key);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${labelsStr} ${value}`);
    }

    return lines.join('\n');
  }

  /**
   * Получить метрики в JSON
   */
  toJSON(): any {
    const counters: Counter[] = [];
    for (const [key, value] of this.counters.entries()) {
      const [name, labelsStr] = this.parseKey(key);
      counters.push({ name, value, labels: this.parseLabels(labelsStr) });
    }

    const histograms: Histogram[] = [];
    for (const [key, histogram] of this.histograms.entries()) {
      const [name, labelsStr] = this.parseKey(key);
      histograms.push({
        name,
        buckets: this.calculateBuckets(histogram.values),
        sum: histogram.values.reduce((a, b) => a + b, 0),
        count: histogram.values.length,
        labels: this.parseLabels(labelsStr),
      });
    }

    const gauges: { name: string; value: number; labels?: Record<string, string> }[] = [];
    for (const [key, value] of this.gauges.entries()) {
      const [name, labelsStr] = this.parseKey(key);
      gauges.push({ name, value, labels: this.parseLabels(labelsStr) });
    }

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      counters,
      histograms,
      gauges,
    };
  }

  /**
   * Очистить метрики
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }

  // ============ Helpers ============

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelsStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelsStr}}`;
  }

  private parseKey(key: string): [string, string] {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) return [key, ''];
    return [match[1], match[2] ? `{${match[2]}}` : ''];
  }

  private parseLabels(labelsStr: string): Record<string, string> | undefined {
    if (!labelsStr) return undefined;
    const labels: Record<string, string> = {};
    const regex = /(\w+)="([^"]+)"/g;
    let match;
    while ((match = regex.exec(labelsStr)) !== null) {
      labels[match[1]] = match[2];
    }
    return Object.keys(labels).length > 0 ? labels : undefined;
  }

  private calculateBuckets(values: number[]): HistogramBucket[] {
    const bucketEdges = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, Infinity];
    return bucketEdges.map(le => ({
      le,
      count: values.filter(v => v <= le).length,
    }));
  }
}

// ============ Singleton Instance ============

export const metrics = new MetricsStore();

// ============ HTTP Metrics ============

/**
 * Записать метрику HTTP запроса
 */
export function recordHTTPRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  const labels = {
    method,
    path: normalizePath(path),
    status: String(statusCode),
  };

  metrics.increment('http_requests_total', labels);
  metrics.observe('http_request_duration_ms', durationMs, labels);
}

/**
 * Нормализовать путь (убрать динамические части)
 * /api/deals/123 -> /api/deals/:id
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/api\/v\d+/, '/api')
    .replace(/\/[a-f0-9]{20,}/g, '/:id')
    .replace(/\/\d+/g, '/:id');
}

// ============ Database Metrics ============

export function recordDBQuery(
  operation: string,
  table: string,
  durationMs: number
): void {
  const labels = { operation, table };
  metrics.increment('db_queries_total', labels);
  metrics.observe('db_query_duration_ms', durationMs, labels);
}

// ============ AI Metrics ============

export function recordAIRequest(
  provider: string,
  model: string,
  durationMs: number,
  tokens?: number,
  cost?: number
): void {
  const labels = { provider, model };
  metrics.increment('ai_requests_total', labels);
  metrics.observe('ai_request_duration_ms', durationMs, labels);
  
  if (tokens) {
    metrics.observe('ai_tokens_total', tokens, labels);
  }
  if (cost) {
    metrics.observe('ai_cost_usd', cost, labels);
  }
}

// ============ Cache Metrics ============

export function recordCacheHit(hit: boolean): void {
  metrics.increment('cache_requests_total', { hit: String(hit) });
}

// ============ System Metrics ============

export function recordSystemMetrics(): void {
  const memUsage = process.memoryUsage();
  metrics.gauge('system_memory_heap_used_bytes', memUsage.heapUsed);
  metrics.gauge('system_memory_heap_total_bytes', memUsage.heapTotal);
  metrics.gauge('system_memory_rss_bytes', memUsage.rss);
  metrics.gauge('system_uptime_seconds', Math.floor((Date.now() - metrics.startTime) / 1000));
}
