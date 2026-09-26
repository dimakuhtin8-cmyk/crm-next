/**
 * Cache Monitor — визуальная панель мониторинга кэша
 * 
 * Показывает:
 * - Hit/Miss rate
 * - Размер кэша
 * - Топ ключей
 * - Очистка кэша
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

export default function CacheMonitorPage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchStats();
    // Обновляем каждые 5 секунд
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/v1/cache/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await fetch('/api/v1/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: 'all' }),
      });
      await fetchStats();
    } catch {} finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Моніторинг кешу</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Моніторинг кешу</h1>
          <p className="text-foreground-muted text-sm mt-1">
            Статистика використання кешу в реальному часі
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Оновити
          </Button>
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={clearing}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Очистити кеш
          </Button>
        </div>
      </div>

      {stats && (
        <>
          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-success/10">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Влучання</p>
                    <p className="text-2xl font-bold">{stats.hits}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-danger/10">
                    <TrendingDown className="h-5 w-5 text-danger" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Промахи</p>
                    <p className="text-2xl font-bold">{stats.misses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Записів</p>
                    <p className="text-2xl font-bold">{stats.size}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-warning/10">
                    <BarChart3 className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Set/Remove</p>
                    <p className="text-2xl font-bold">{stats.sets}/{stats.deletes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    stats.hitRate >= 80 ? 'bg-success/10' : 
                    stats.hitRate >= 50 ? 'bg-warning/10' : 'bg-danger/10'
                  )}>
                    <Clock className={cn(
                      'h-5 w-5',
                      stats.hitRate >= 80 ? 'text-success' : 
                      stats.hitRate >= 50 ? 'text-warning' : 'text-danger'
                    )} />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Hit Rate</p>
                    <p className="text-2xl font-bold">{stats.hitRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hit Rate Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Hit Rate</span>
                <Badge variant={stats.hitRate >= 80 ? 'success' : stats.hitRate >= 50 ? 'warning' : 'danger'}>
                  {stats.hitRate}%
                </Badge>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    stats.hitRate >= 80 ? 'bg-success' : 
                    stats.hitRate >= 50 ? 'bg-warning' : 'bg-danger'
                  )}
                  style={{ width: `${stats.hitRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-foreground-muted">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>

          {/* Інформація */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Про кеш</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-foreground-muted mb-1">Тип кешу</p>
                  <p className="font-medium">In-Memory (LRU)</p>
                </div>
                <div>
                  <p className="text-foreground-muted mb-1">Максимум записів</p>
                  <p className="font-medium">10,000</p>
                </div>
                <div>
                  <p className="text-foreground-muted mb-1">Очищення</p>
                  <p className="font-medium">Кожні 5 хвилин (auto)</p>
                </div>
                <div>
                  <p className="text-foreground-muted mb-1">Стратегія</p>
                  <p className="font-medium">Cache-Aside + Stale-While-Revalidate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
