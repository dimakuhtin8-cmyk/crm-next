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
import { useState, useEffect } from 'react';

import { DataError } from '@/components/data-error';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

type JobRow = {
  id: string;
  type: string;
  status: string;
  priority: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export default function QueuesPage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    const [okStats, okJobs] = await Promise.all([fetchStats(), fetchJobs()]);
    if (!okStats || !okJobs) {
      // тик опроса молча (warn внутри), но первая загрузка — с ошибкой на экран
      setLoadError((prev) => prev ?? 'Не вдалося завантажити черги');
    } else {
      setLoadError(null);
    }
  };

  const fetchJobs = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/queue/jobs?limit=20');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        return true;
      }
      return false;
    } catch {
      console.warn('[queues] jobs fetch failed');
      return false;
    }
  };

  const fetchStats = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/v1/queue/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
        return true;
      }
      return false;
    } catch {
      console.warn('[queues] stats fetch failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/v1/queue/stats', { method: 'DELETE' });
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      await fetchStats();
    } catch {
      console.warn('[queues] cleanup failed');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Черги задач</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const visibleJobs =
    statusFilter === 'all' ? jobs : jobs.filter((job) => job.status === statusFilter);

  const jobColumns = [
    {
      key: 'id',
      header: 'Job ID',
      className: 'p-2 w-[130px]',
      render: (job: JobRow) => (
        <span className="block truncate font-mono text-xs" title={job.id}>
          {job.id}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Задача',
      className: 'p-2',
      render: (job: JobRow) => (
        <div className="min-w-0">
          <span className="text-sm font-medium">{job.type}</span>
          {job.lastError && (
            <p className="truncate text-xs text-danger max-w-[320px]" title={job.lastError}>
              {job.lastError.slice(0, 120)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      className: 'p-2 w-[130px]',
      render: (job: JobRow) => (
        <Badge
          variant={
            job.status === 'completed'
              ? 'success'
              : job.status === 'failed'
                ? 'danger'
                : job.status === 'processing'
                  ? 'info'
                  : 'secondary'
          }
          className="font-mono"
        >
          {job.status}
        </Badge>
      ),
    },
    {
      key: 'attempts',
      header: 'Спроби',
      className: 'p-2 w-[90px] font-mono text-xs',
      render: (job: JobRow) => `${job.attempts}/${job.maxAttempts}`,
    },
    {
      key: 'createdAt',
      header: 'Створено',
      className: 'p-2 w-[120px] text-xs text-foreground-muted',
      render: (job: JobRow) =>
        new Date(job.createdAt).toLocaleString('uk', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      key: 'download',
      header: '',
      className: 'p-2 w-[90px]',
      render: (job: JobRow) =>
        job.type === 'export' && job.status === 'completed' ? (
          <a
            href={`/api/queue/jobs/${job.id}/download`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Скачати
          </a>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Черги задач</h1>
          <p className="text-foreground-muted text-sm mt-1">
            Моніторинг фонових задач в реальному часі
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4" />
            Оновити
          </Button>
          <Button variant="destructive" size="sm" onClick={handleCleanup} disabled={clearing}>
            <Trash2 className="h-4 w-4" />
            Очистити
          </Button>
        </div>
      </div>

      {loadError && <DataError message={loadError} onRetry={fetchAll} />}

      {stats && (
        <>
          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-warning/10">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground-muted">Очікують</p>
                    <p className="font-mono text-2xl font-bold">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-info/10">
                    <Loader className="h-5 w-5 text-info animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground-muted">Обробляються</p>
                    <p className="font-mono text-2xl font-bold">{stats.processing}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-success/10">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground-muted">Виконано</p>
                    <p className="font-mono text-2xl font-bold">{stats.completed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-danger/10">
                    <XCircle className="h-5 w-5 text-danger" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground-muted">Помилки</p>
                    <p className="font-mono text-2xl font-bold">{stats.failed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Типи задач */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Типи задач</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                  <Mail className="h-5 w-5 shrink-0 text-info" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-foreground-muted">Розсилка листів</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                  <Brain className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">AI</p>
                    <p className="text-xs text-foreground-muted">Обробка даних</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                  <Download className="h-5 w-5 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Експорт</p>
                    <p className="text-xs text-foreground-muted">Завантаження файлів</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                  <Bell className="h-5 w-5 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Сповіщення</p>
                    <p className="text-xs text-foreground-muted">Push та вбудовані</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Останні задачі (реальні дані з БД) */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-sm">Останні задачі</h3>
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="h-6 px-2.5 text-xs">
                    Усі
                    <span className="ml-1.5 font-mono text-[11px] text-foreground-muted">
                      {jobs.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="h-6 px-2.5 text-xs">
                    Очікують
                    <span className="ml-1.5 font-mono text-[11px] text-foreground-muted">
                      {stats.pending}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="processing" className="h-6 px-2.5 text-xs">
                    Обробляються
                    <span className="ml-1.5 font-mono text-[11px] text-foreground-muted">
                      {stats.processing}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="failed" className="h-6 px-2.5 text-xs">
                    Помилки
                    <span className="ml-1.5 font-mono text-[11px] text-foreground-muted">
                      {stats.failed}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Table
              columns={jobColumns}
              data={visibleJobs}
              pageSize={20}
              emptyMessage="Задач цього статусу поки немає"
            />
          </div>

          {/* Информация */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Про чергу</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-1">Движок</p>
                  <p className="font-mono text-sm font-medium">Postgres + зовнішній планувальник</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-1">Retry стратегія</p>
                  <p className="font-mono text-sm font-medium">Exponential Backoff (1s → 16s)</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-1">Макс. спроб</p>
                  <p className="font-mono text-sm font-medium">3</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-1">Таймаут задачі</p>
                  <p className="font-mono text-sm font-medium">30 секунд</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
