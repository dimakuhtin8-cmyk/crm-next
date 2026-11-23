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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('queues');
  const tCommon = useTranslations('common');
  const tRoot = useTranslations();
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
      setLoadError((prev) => prev ?? t('loadFailed'));
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
      if (!res.ok) throw new Error(tCommon('errors.requestStatus', { status: res.status }));
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
        <h1 className="text-2xl font-bold">{t('title')}</h1>
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
      header: tRoot('quickCreate.task.types.task'),
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
      header: tCommon('status'),
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
      header: t('attempts'),
      className: 'p-2 w-[90px] font-mono text-xs',
      render: (job: JobRow) => `${job.attempts}/${job.maxAttempts}`,
    },
    {
      key: 'createdAt',
      header: tRoot('deals.created'),
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
            {t('download')}
          </a>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-foreground-muted text-sm mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4" />
            {tCommon('update')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleCleanup} disabled={clearing}>
            <Trash2 className="h-4 w-4" />
            {t('clear')}
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
                    <p className="text-xs font-medium text-foreground-muted">{t('pending')}</p>
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
                    <p className="text-xs font-medium text-foreground-muted">{t('processing')}</p>
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
                    <p className="text-xs font-medium text-foreground-muted">
                      {tRoot('tasks.done')}
                    </p>
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
                    <p className="text-xs font-medium text-foreground-muted">
                      {tRoot('automation.logs.errorsFilter')}
                    </p>
                    <p className="font-mono text-2xl font-bold">{stats.failed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Типи задач */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('jobTypes.title')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                  <Mail className="h-5 w-5 shrink-0 text-info" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-foreground-muted">
                      {t('jobTypes.emailDescription')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                  <Brain className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">AI</p>
                    <p className="text-xs text-foreground-muted">{t('jobTypes.aiDescription')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                  <Download className="h-5 w-5 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tRoot('contacts.export')}</p>
                    <p className="text-xs text-foreground-muted">
                      {t('jobTypes.exportDescription')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50">
                  <Bell className="h-5 w-5 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tRoot('notifications.title')}</p>
                    <p className="text-xs text-foreground-muted">
                      {t('jobTypes.notificationsDescription')}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Останні задачі (реальні дані з БД) */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-sm">{t('recent')}</h3>
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="h-6 px-2.5 text-xs">
                    {tCommon('all')}
                    <span className="ml-1.5 font-mono text-[11px] text-foreground-muted">
                      {jobs.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="h-6 px-2.5 text-xs">
                    {t('pending')}
                    <span className="ml-1.5 font-mono text-[11px] text-foreground-muted">
                      {stats.pending}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="processing" className="h-6 px-2.5 text-xs">
                    {t('processing')}
                    <span className="ml-1.5 font-mono text-[11px] text-foreground-muted">
                      {stats.processing}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="failed" className="h-6 px-2.5 text-xs">
                    {tRoot('automation.logs.errorsFilter')}
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
              emptyMessage={t('empty')}
            />
          </div>

          {/* Информация */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('about')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-1">{t('engine')}</p>
                  <p className="font-mono text-sm font-medium">{t('engineValue')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-1">
                    {t('retryStrategy')}
                  </p>
                  <p className="font-mono text-sm font-medium">Exponential Backoff (1s → 16s)</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-1">
                    {t('maxAttempts')}
                  </p>
                  <p className="font-mono text-sm font-medium">3</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted mb-1">
                    {t('jobTimeout')}
                  </p>
                  <p className="font-mono text-sm font-medium">{t('jobTimeoutValue')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
