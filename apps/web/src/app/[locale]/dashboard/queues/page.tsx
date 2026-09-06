/**
 * Queues Monitor — визуальная панель мониторинга очередей
 * 
 * Показывает:
 * - Статус задач (pending, processing, completed, failed)
 * - Количество по типам
 * - Очередь на обработку
 * - Кнопка очистки
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader, 
  Trash2,
  RefreshCw,
  Mail,
  Brain,
  Download,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export default function QueuesPage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/v1/queue/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setClearing(true);
    try {
      await fetch('/api/v1/queue/stats', { method: 'DELETE' });
      await fetchStats();
    } catch {} finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Черги задач</h1>
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
          <h1 className="text-2xl font-bold">Черги задач</h1>
          <p className="text-foreground-muted text-sm mt-1">
            Моніторинг фонових задач в реальному часі
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Оновити
          </Button>
          <Button variant="outline" onClick={handleCleanup} disabled={clearing}>
            <Trash2 className="h-4 w-4 mr-2" />
            Очистити
          </Button>
        </div>
      </div>

      {stats && (
        <>
          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-warning/10">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Очікують</p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-info/10">
                    <Loader className="h-5 w-5 text-info animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Обробляються</p>
                    <p className="text-2xl font-bold">{stats.processing}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-success/10">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Виконано</p>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-danger/10">
                    <XCircle className="h-5 w-5 text-danger" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted">Помилки</p>
                    <p className="text-2xl font-bold">{stats.failed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Типи задач */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">Типи задач</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                  <Mail className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-foreground-muted">Розсилка листів</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                  <Brain className="h-5 w-5 text-violet-500" />
                  <div>
                    <p className="text-sm font-medium">AI</p>
                    <p className="text-xs text-foreground-muted">Обробка даних</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                  <Download className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">Експорт</p>
                    <p className="text-xs text-foreground-muted">Завантаження файлів</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                  <Bell className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Сповіщення</p>
                    <p className="text-xs text-foreground-muted">Push та вбудовані</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Інформація */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Про чергу</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-foreground-muted mb-1">Движок</p>
                  <p className="font-medium">In-Memory Queue</p>
                </div>
                <div>
                  <p className="text-foreground-muted mb-1">Retry стратегія</p>
                  <p className="font-medium">Exponential Backoff (1s → 16s)</p>
                </div>
                <div>
                  <p className="text-foreground-muted mb-1">Макс. спроб</p>
                  <p className="font-medium">3</p>
                </div>
                <div>
                  <p className="text-foreground-muted mb-1">Таймаут задачі</p>
                  <p className="font-medium">30 секунд</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
