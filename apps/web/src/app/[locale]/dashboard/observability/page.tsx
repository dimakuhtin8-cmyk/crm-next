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

import { useState, useEffect } from 'react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { 
  Activity, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Database,
  Brain,
  Server,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
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

      if (sloRes.ok) {
        const sloJson = await sloRes.json();
        setSloData(sloJson.data);
      }

      if (metricsRes.ok) {
        const metricsJson = await metricsRes.json();
        setMetricsData(metricsJson.data);
      }
    } catch {} finally {
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Спостережуваність</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Спостережуваність</h1>
          <p className="text-foreground-muted text-sm mt-1">
            Моніторинг здоров'я системи в реальному часі
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Оновити
        </Button>
      </div>

      {/* Overall Status */}
      <Card className={cn(
        'border-2',
        sloData?.overall === 'healthy' ? 'border-success' :
        sloData?.overall === 'warning' ? 'border-warning' : 'border-danger'
      )}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              'p-3 rounded-2xl',
              sloData?.overall === 'healthy' ? 'bg-success/10' :
              sloData?.overall === 'warning' ? 'bg-warning/10' : 'bg-danger/10'
            )}>
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
                {sloData?.overall === 'healthy' ? 'Все нормально' :
                 sloData?.overall === 'warning' ? 'Попередження' : 'Критична ситуація'}
              </h2>
              <p className="text-foreground-muted">
                {sloData?.overall === 'healthy' 
                  ? 'Всі SLO в рамках норми'
                  : 'Деякі SLO перевищують допустимі межі'}
              </p>
            </div>
            {metricsData && (
              <div className="ml-auto text-right">
                <p className="text-sm text-foreground-muted">Аптайм</p>
                <p className="text-lg font-bold">{formatUptime(metricsData.uptime)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SLO Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sloData?.slos.map((slo) => (
          <Card key={slo.name}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{slo.description}</h3>
                <Badge variant={
                  slo.budget.status === 'healthy' ? 'success' :
                  slo.budget.status === 'warning' ? 'warning' : 'danger'
                }>
                  {slo.current}%
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    slo.budget.status === 'healthy' ? 'bg-success' :
                    slo.budget.status === 'warning' ? 'bg-warning' : 'bg-danger'
                  )}
                  style={{ width: `${slo.current}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-foreground-muted">
                <span>Ціль: {slo.target}%</span>
                <span>Бюджет: {slo.budget.remainingPercent}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {sloData?.alerts && sloData.alerts.length > 0 && (
        <Card className="border-warning">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Алерти
            </h3>
            <div className="space-y-2">
              {sloData.alerts.map((alert, i) => (
                <div key={i} className={cn(
                  'flex items-center gap-3 p-3 rounded-lg',
                  alert.severity === 'critical' ? 'bg-danger/10' :
                  alert.severity === 'warning' ? 'bg-warning/10' : 'bg-info/10'
                )}>
                  {alert.severity === 'critical' ? (
                    <XCircle className="h-5 w-5 text-danger" />
                  ) : alert.severity === 'warning' ? (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  ) : (
                    <Activity className="h-5 w-5 text-info" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{alert.name}</p>
                    <p className="text-xs text-foreground-muted">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Metrics */}
      {metricsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Пам'ять</p>
                  <p className="font-bold">
                    {formatBytes(
                      metricsData.gauges.find(g => g.name === 'system_memory_heap_used_bytes')?.value || 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Запити</p>
                  <p className="font-bold">
                    {metricsData.counters.find(c => c.name === 'http_requests_total')?.value || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-info/10">
                  <Database className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">DB запити</p>
                  <p className="font-bold">
                    {metricsData.counters.find(c => c.name === 'db_queries_total')?.value || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-100">
                  <Brain className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">AI запити</p>
                  <p className="font-bold">
                    {metricsData.counters.find(c => c.name === 'ai_requests_total')?.value || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Про спостережуваність</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-foreground-muted mb-1">SLO вікно вимірювання</p>
              <p className="font-medium">30 днів</p>
            </div>
            <div>
              <p className="text-foreground-muted mb-1">Оновлення метрик</p>
              <p className="font-medium">Кожні 10 секунд</p>
            </div>
            <div>
              <p className="text-foreground-muted mb-1">Доступність (ціль)</p>
              <p className="font-medium">99.9%</p>
            </div>
            <div>
              <p className="text-foreground-muted mb-1">Затримка p99 (ціль)</p>
              <p className="font-medium">&lt; 500ms</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
