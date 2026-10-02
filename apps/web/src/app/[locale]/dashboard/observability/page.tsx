/**
 * Observability Dashboard — полная картина по здоровью системы
 *
 * Показывает:
 * - SLO статус (availability, latency, error rate)
 * - Error Budget (сколько осталось)
 * - Метрики (HTTP, DB, AI, Cache)
 * - Алерты
 */

'use client';

import {
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
  Brain,
  Server,
  TrendingUp,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { DataError } from '@/components/data-error';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface SLOData {
  overall: 'healthy' | 'warning' | 'critical';
  slos: {
    name: string;
    description: string;
    target: number;
    current: number;
    budget: {
      remaining: number;
      remainingPercent: number;
      status: string;
    };
  }[];
  alerts: {
    name: string;
    severity: string;
    message: string;
  }[];
}

interface MetricsData {
  uptime: number;
  counters: { name: string; value: number; labels?: Record<string, string> }[];
  histograms: { name: string; count: number; sum: number }[];
  gauges: { name: string; value: number }[];
}

export default function ObservabilityPage() {
  const [sloData, setSloData] = useState<SLOData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [sloRes, metricsRes] = await Promise.all([
        fetch('/api/v1/slo'),
        fetch('/api/v1/metrics?format=json'),
      ]);

      if (!sloRes.ok || !metricsRes.ok) {
        throw new Error(`SLO: ${sloRes.status}, метрики: ${metricsRes.status}`);
      }
      const sloJson = await sloRes.json();
      setSloData(sloJson.data);
      const metricsJson = await metricsRes.json();
      setMetricsData(metricsJson.data);
      setLoadError(null);
    } catch (err) {
      // тик опроса молча (warn), но первая загрузка — с ошибкой на экран
      console.warn('[observability] fetch failed');
      setLoadError((prev) => prev ?? (err instanceof Error ? err.message : 'Помилка завантаження'));
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}д ${hours}г ${mins}хв`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Спостережуваність</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Спостережуваність</h1>
          <p className="text-foreground-muted text-sm mt-1">
            Моніторинг здоров'я системи в реальному часі
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
          Оновити
        </Button>
      </div>

      {loadError && <DataError message={loadError} onRetry={fetchData} />}

      {/* Overall Status */}
      <Card
        className={cn(
          'border-2 shadow-sm',
          sloData?.overall === 'healthy'
            ? 'border-success'
            : sloData?.overall === 'warning'
              ? 'border-warning'
              : 'border-danger',
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'p-3 rounded-2xl',
                sloData?.overall === 'healthy'
                  ? 'bg-success/10'
                  : sloData?.overall === 'warning'
                    ? 'bg-warning/10'
                    : 'bg-danger/10',
              )}
            >
              {sloData?.overall === 'healthy' ? (
                <CheckCircle className="h-8 w-8 text-success" />
              ) : sloData?.overall === 'warning' ? (
                <AlertTriangle className="h-8 w-8 text-warning" />
              ) : (
                <XCircle className="h-8 w-8 text-danger" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {sloData?.overall === 'healthy'
                  ? 'Все нормально'
                  : sloData?.overall === 'warning'
                    ? 'Попередження'
                    : 'Критична ситуація'}
              </h2>
              <p className="text-foreground-muted">
                {sloData?.overall === 'healthy'
                  ? 'Всі SLO в рамках норми'
                  : 'Деякі SLO перевищують допустимі межі'}
              </p>
            </div>
            {metricsData && (
              <div className="ml-auto text-right">
                <p className="text-xs font-medium text-foreground-muted">Аптайм</p>
                <p className="font-mono text-lg font-bold">{formatUptime(metricsData.uptime)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SLO Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sloData?.slos.map((slo) => (
          <Card key={slo.name} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{slo.description}</CardTitle>
              <Badge
                variant={
                  slo.budget.status === 'healthy'
                    ? 'success'
                    : slo.budget.status === 'warning'
                      ? 'warning'
                      : 'danger'
                }
                className="font-mono"
              >
                {slo.current}%
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Progress bar */}
              <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    slo.budget.status === 'healthy'
                      ? 'bg-success'
                      : slo.budget.status === 'warning'
                        ? 'bg-warning'
                        : 'bg-danger',
                  )}
                  style={{ width: `${slo.current}%` }}
                />
              </div>

              <div className="flex justify-between font-mono text-xs text-foreground-muted">
                <span>Ціль: {slo.target}%</span>
                <span>Бюджет: {slo.budget.remainingPercent}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {sloData?.alerts && sloData.alerts.length > 0 && (
        <Card className="border-warning shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Алерти
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {sloData.alerts.map((alert, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-lg p-2.5',
                    alert.severity === 'critical'
                      ? 'bg-danger/10'
                      : alert.severity === 'warning'
                        ? 'bg-warning/10'
                        : 'bg-info/10',
                  )}
                >
                  {alert.severity === 'critical' ? (
                    <XCircle className="h-5 w-5 shrink-0 text-danger" />
                  ) : alert.severity === 'warning' ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                  ) : (
                    <Activity className="h-5 w-5 shrink-0 text-info" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alert.name}</p>
                    <p className="truncate text-xs text-foreground-muted" title={alert.message}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Metrics */}
      {metricsData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground-muted">Пам'ять (heap)</p>
                  <p className="font-mono text-2xl font-bold">
                    {formatBytes(
                      metricsData.gauges.find((g) => g.name === 'system_memory_heap_used_bytes')
                        ?.value || 0,
                    )}
                  </p>
                  <p className="truncate font-mono text-xs text-foreground-muted">
                    з{' '}
                    {formatBytes(
                      metricsData.gauges.find((g) => g.name === 'system_memory_heap_total_bytes')
                        ?.value || 0,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground-muted">Пам'ять (RSS)</p>
                  <p className="font-mono text-2xl font-bold">
                    {formatBytes(
                      metricsData.gauges.find((g) => g.name === 'system_memory_rss_bytes')?.value ||
                        0,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground-muted">HTTP запити</p>
                  <p className="font-mono text-2xl font-bold">
                    {metricsData.counters.find((c) => c.name === 'http_requests_total')?.value || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-info/10">
                  <Database className="h-5 w-5 text-info" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground-muted">DB запити</p>
                  <p className="font-mono text-2xl font-bold">
                    {metricsData.counters.find((c) => c.name === 'db_queries_total')?.value || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent">
                  <Brain className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground-muted">AI запити</p>
                  <p className="font-mono text-2xl font-bold">
                    {metricsData.counters.find((c) => c.name === 'ai_requests_total')?.value || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Про спостережуваність</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-foreground-muted mb-1">
                SLO вікно вимірювання
              </p>
              <p className="font-mono text-sm font-medium">30 днів</p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground-muted mb-1">Оновлення метрик</p>
              <p className="font-mono text-sm font-medium">Кожні 10 секунд</p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground-muted mb-1">Доступність (ціль)</p>
              <p className="font-mono text-sm font-medium">99.9%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground-muted mb-1">Затримка p99 (ціль)</p>
              <p className="font-mono text-sm font-medium">&lt; 500ms</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
