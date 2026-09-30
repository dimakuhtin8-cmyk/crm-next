'use client';

import { Bell, CheckSquare, Phone, Mail, Calendar, Repeat, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { DataError } from '@/components/data-error';
import { Card, Badge, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ReminderTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueDate: string | null;
  reminderAt: string | null;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Терміново', color: 'text-danger' },
  high: { label: 'Високий', color: 'text-warning' },
  medium: { label: 'Середній', color: 'text-info' },
  low: { label: 'Низький', color: 'text-foreground-muted' },
};

const typeIcons: Record<string, React.ReactNode> = {
  task: <CheckSquare className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  follow_up: <Repeat className="h-4 w-4" />,
};

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

type Filter = 'all' | 'overdue' | 'upcoming';

const appTypeConfig: Record<string, string> = {
  info: 'bg-primary text-primary-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-danger/10 text-danger',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const [overdue, setOverdue] = useState<ReminderTask[]>([]);
  const [upcoming, setUpcoming] = useState<ReminderTask[]>([]);
  const [appNotifs, setAppNotifs] = useState<AppNotification[]>([]);
  const [sysOpen, setSysOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const loadAll = () => {
    setLoadError(null);
    setLoading(true);
    Promise.all([
      fetch('/api/tasks/reminders?hours=24').then((r) => {
        if (!r.ok) throw new Error(`Нагадування: помилка ${r.status}`);
        return r.json();
      }),
      fetch('/api/notifications').then((r) => {
        if (!r.ok) throw new Error(`Сповіщення: помилка ${r.status}`);
        return r.json();
      }),
    ])
      .then(([rem, notifs]) => {
        setOverdue(rem.overdue || []);
        setUpcoming(rem.upcoming || []);
        setAppNotifs(notifs.notifications || []);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Помилка завантаження');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const markOneRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      setAppNotifs((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new Event('notif-read'));
    } catch {
      // тост не зникає — повтор по кліку
      console.warn('[notifications] mark-one-read failed');
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      setAppNotifs([]);
      window.dispatchEvent(new Event('notif-read'));
    } catch {
      console.warn('[notifications] mark-all-read failed');
    }
  };

  const visible = useMemo(() => {
    const withFlag = [
      ...overdue.map((t) => ({ ...t, flag: 'overdue' as const })),
      ...upcoming.map((t) => ({ ...t, flag: 'upcoming' as const })),
    ];
    if (filter === 'overdue') return withFlag.filter((t) => t.flag === 'overdue');
    if (filter === 'upcoming') return withFlag.filter((t) => t.flag === 'upcoming');
    return withFlag;
  }, [overdue, upcoming, filter]);

  const tabs: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'Усі', count: overdue.length + upcoming.length },
    { id: 'overdue', label: 'Протерміновані', count: overdue.length },
    { id: 'upcoming', label: 'Найближчі', count: upcoming.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          До огляду
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Bell className="h-5 w-5 text-primary-foreground" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Сповіщення</h1>
            <p className="text-foreground-secondary">Нагадування за найближчі 24 години</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Фільтр сповіщень">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors',
              filter === tab.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary',
            )}
          >
            {tab.label}
            <Badge variant="secondary">{tab.count}</Badge>
          </button>
        ))}
      </div>

      {loadError && !loading && <DataError message={loadError} onRetry={loadAll} />}

      {appNotifs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <button
              onClick={() => setSysOpen(!sysOpen)}
              className="flex items-center gap-2 text-sm font-bold hover:text-foreground-muted transition-colors"
              aria-expanded={sysOpen}
            >
              <span className={cn('transition-transform', !sysOpen && '-rotate-90')}>▾</span>
              Системні сповіщення
              <Badge variant="secondary">{appNotifs.length}</Badge>
            </button>
            <button
              onClick={markAllRead}
              className="text-xs font-semibold text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              Прочитати всі
            </button>
          </div>
          {sysOpen && (
            <div className="divide-y divide-border">
              {appNotifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markOneRead(n.id)}
                  className="flex items-start gap-3 px-4 py-3.5 sm:px-5 cursor-pointer hover:bg-secondary/50 transition-colors"
                  title="Позначити прочитаним"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      appTypeConfig[n.type] || appTypeConfig.info,
                    )}
                  >
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{n.title}</span>
                    <span className="block text-xs text-foreground-muted mt-0.5">{n.message}</span>
                    <span className="block text-[11px] text-foreground-muted/70 mt-1">
                      {formatDateTime(n.createdAt)}
                      {n.link && (
                        <Link
                          href={n.link}
                          className="ml-2 font-semibold text-foreground underline-offset-4 hover:underline"
                        >
                          Відкрити →
                        </Link>
                      )}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : visible.length === 0 && appNotifs.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <CheckSquare className="h-6 w-6 text-foreground" />
          </span>
          <p className="font-semibold">Немає сповіщень</p>
          <p className="mt-1 text-sm text-foreground-muted">Все під контролем!</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {visible.map((task) => (
            <Link
              key={`${task.flag}-${task.id}`}
              href={`/dashboard/tasks/${task.id}`}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/50 sm:px-5"
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  task.flag === 'overdue'
                    ? 'bg-danger/10 text-danger'
                    : 'bg-primary text-primary-foreground',
                )}
              >
                {typeIcons[task.type] || <CheckSquare className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{task.title}</span>
                <span
                  className={cn(
                    'block text-xs',
                    task.flag === 'overdue' ? 'text-danger' : 'text-foreground-muted',
                  )}
                >
                  {task.flag === 'overdue' ? 'Протерміновано · ' : ''}
                  {formatDateTime(task.reminderAt)}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 text-xs font-semibold',
                  priorityConfig[task.priority]?.color,
                )}
              >
                {priorityConfig[task.priority]?.label}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
