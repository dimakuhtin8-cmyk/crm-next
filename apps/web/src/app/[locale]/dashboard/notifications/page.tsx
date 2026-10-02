'use client';

import {
  Bell,
  CheckSquare,
  Phone,
  Mail,
  Calendar,
  Repeat,
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { DataError } from '@/components/data-error';
import {
  Card,
  Badge,
  Skeleton,
  Button,
  buttonVariants,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
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

/** Відносний час українською: «через 45 хв» / «2 год тому» / «вчора». */
function relativeTime(value: string | null): string {
  if (!value) return '—';
  const diffMs = new Date(value).getTime() - Date.now();
  const absSec = Math.abs(diffMs) / 1000;
  const sign = diffMs >= 0 ? 1 : -1;
  if (absSec < 60) return 'зараз';
  try {
    const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' });
    if (absSec < 3600) return rtf.format(sign * Math.round(absSec / 60), 'minute');
    if (absSec < 86400) return rtf.format(sign * Math.round(absSec / 3600), 'hour');
    return rtf.format(sign * Math.round(absSec / 86400), 'day');
  } catch {
    // браузер без Intl.RelativeTimeFormat — звичайна дата
    return formatDateTime(value);
  }
}

/** Час доби HH:MM для хвоста рядка «відносний час · 14:30». */
function timeOfDay(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
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
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          До огляду
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Bell className="h-5 w-5 text-primary-foreground" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Сповіщення</h1>
              <p className="text-sm text-foreground-secondary">
                Нагадування за найближчі 24 години
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={markAllRead}
            disabled={appNotifs.length === 0}
            title="Позначити всі системні сповіщення прочитаними"
          >
            <CheckCheck className="h-4 w-4" />
            Позначити всі прочитаними
          </Button>
        </div>
      </div>

      {/* Фільтр нагадувань */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="max-w-full overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
              <Badge variant="secondary">{tab.count}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loadError && !loading && <DataError message={loadError} onRetry={loadAll} />}

      {/* Системні сповіщення */}
      {appNotifs.length > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSysOpen(!sysOpen)}
            aria-expanded={sysOpen}
            className="gap-2"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', !sysOpen && '-rotate-90')} />
            Системні сповіщення
            <Badge variant="secondary">{appNotifs.length}</Badge>
          </Button>

          {sysOpen && (
            <div className="mt-2 space-y-2">
              {appNotifs.map((n) => (
                <Card
                  key={n.id}
                  onClick={() => markOneRead(n.id)}
                  title="Позначити прочитаним"
                  className="cursor-pointer p-3 transition-colors hover:border-border-hover"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        appTypeConfig[n.type] || appTypeConfig.info,
                      )}
                    >
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-info"
                          aria-label="Непрочитане"
                        />
                        <p className="truncate text-sm font-semibold">{n.title}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-foreground-muted">{n.message}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                        <span title={formatDateTime(n.createdAt)}>
                          {relativeTime(n.createdAt)} · {timeOfDay(n.createdAt)}
                        </span>
                        {n.link && (
                          <Link
                            href={n.link}
                            className={cn(
                              buttonVariants({ variant: 'outline', size: 'sm' }),
                              'h-7 gap-1 px-2 text-2xs',
                            )}
                          >
                            Відкрити
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Нагадування задач */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : visible.length === 0 && appNotifs.length === 0 ? (
        <Card className="p-5 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <CheckSquare className="h-6 w-6 text-foreground" />
          </span>
          <p className="font-semibold">Немає сповіщень</p>
          <p className="mt-1 text-sm text-foreground-muted">Все під контролем!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((task) => (
            <Link key={`${task.flag}-${task.id}`} href={`/dashboard/tasks/${task.id}`}>
              <Card className="p-3 transition-colors hover:border-border-hover">
                <div className="flex items-center gap-3">
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{task.title}</p>
                    <p
                      className={cn(
                        'mt-0.5 text-xs',
                        task.flag === 'overdue' ? 'text-danger' : 'text-foreground-muted',
                      )}
                      title={formatDateTime(task.reminderAt)}
                    >
                      {task.flag === 'overdue' ? 'Протерміновано · ' : ''}
                      {relativeTime(task.reminderAt)} · {timeOfDay(task.reminderAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-xs font-semibold',
                      priorityConfig[task.priority]?.color,
                    )}
                  >
                    {priorityConfig[task.priority]?.label}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
