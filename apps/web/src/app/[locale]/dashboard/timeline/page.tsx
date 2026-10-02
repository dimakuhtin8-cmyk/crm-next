'use client';

import { Phone, Mail, Users, CheckSquare, StickyNote, MessageSquare, History } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { DataError } from '@/components/data-error';
import { Button, Card, CardContent, Badge, Tabs, TabsList, TabsTrigger } from '@/components/ui';

interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  date: string;
  contactId: string | null;
  // AI-збагачення активності (колонки є в схемі, API повертає їх повним рядком)
  aiTags?: string | null;
  aiPriority?: string | null;
}

const typeConfig: Record<
  string,
  { icon: React.ReactNode; dot: string; chip: string; label: string }
> = {
  call: {
    icon: <Phone className="h-4 w-4" />,
    dot: 'bg-info',
    chip: 'border-info/20 bg-info/10 text-info',
    label: 'Дзвінок',
  },
  email: {
    icon: <Mail className="h-4 w-4" />,
    dot: 'bg-primary',
    chip: 'border-primary/20 bg-primary/10 text-primary',
    label: 'Лист',
  },
  meeting: {
    icon: <Users className="h-4 w-4" />,
    dot: 'bg-warning',
    chip: 'border-warning/20 bg-warning/10 text-warning',
    label: 'Зустріч',
  },
  task: {
    icon: <CheckSquare className="h-4 w-4" />,
    dot: 'bg-foreground-muted',
    chip: 'border-border bg-secondary text-foreground-muted',
    label: 'Задача',
  },
  note: {
    icon: <StickyNote className="h-4 w-4" />,
    dot: 'bg-success',
    chip: 'border-success/20 bg-success/10 text-success',
    label: 'Нотатка',
  },
  sms: {
    icon: <MessageSquare className="h-4 w-4" />,
    dot: 'bg-danger',
    chip: 'border-danger/20 bg-danger/10 text-danger',
    label: 'SMS',
  },
};

/** Відносний час українською (Intl.RelativeTimeFormat), фолбек — коротка дата. */
function relativeTime(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'щойно';
  try {
    const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' });
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    const days = Math.floor(hours / 24);
    if (days < 7) return rtf.format(-days, 'day');
  } catch {
    // браузер без Intl.RelativeTimeFormat — звичайна дата
  }
  return new Date(date).toLocaleDateString('uk', { day: 'numeric', month: 'short' });
}

export default function TimelinePage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchActivities();
  }, [page, filterType]);

  const fetchActivities = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterType) params.set('type', filterType);
      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      const data = await res.json();
      setActivities(data.activities || []);
      setTotal(data.total || 0);
    } catch (err) {
      setActivities([]);
      setLoadError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  };

  // Group by date
  const grouped = activities.reduce<Record<string, Activity[]>>((acc, a) => {
    const date = new Date(a.date).toLocaleDateString('uk', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(a);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Таймлайн</h1>
          <p className="text-sm text-foreground-muted">Історія всіх активностей · {total} подій</p>
        </div>
      </div>

      {/* Top bar: фільтр подій Tabs */}
      <Tabs
        value={filterType || 'all'}
        onValueChange={(v) => {
          setFilterType(v === 'all' ? '' : v);
          setPage(1);
        }}
      >
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">Усі</TabsTrigger>
          {Object.entries(typeConfig).map(([key, cfg]) => (
            <TabsTrigger key={key} value={key}>
              {cfg.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : loadError ? (
        <DataError message={loadError} onRetry={fetchActivities} />
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="mx-auto mb-4 h-12 w-12 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">Немає активностей</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              {/* Date header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <h2 className="whitespace-nowrap text-xs font-medium text-foreground-muted">
                  {date}
                </h2>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Вертикальний таймлайн з лівою напрямною */}
              <div className="ml-4 space-y-3 border-l border-border pl-6">
                {items.map((activity) => {
                  const cfg = typeConfig[activity.type] || typeConfig.task;
                  const isAi = Boolean(activity.aiTags || activity.aiPriority);
                  const when = new Date(activity.date);
                  return (
                    <div key={activity.id} className="relative">
                      {/* Точка на лінії таймлайну */}
                      <span
                        className={`absolute -left-[31px] top-5 h-3.5 w-3.5 rounded-full ring-2 ring-background ${cfg.dot}`}
                      />

                      {/* Компактна картка події */}
                      <Card className="p-3 transition-colors hover:border-border-hover">
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${cfg.chip}`}
                          >
                            {cfg.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium">
                                {activity.title}
                              </p>
                              <div className="flex shrink-0 items-center gap-1">
                                <Badge variant="outline" className="px-1.5 py-0 text-2xs">
                                  {cfg.label}
                                </Badge>
                                <Badge
                                  variant={isAi ? 'info' : 'secondary'}
                                  className="px-1.5 py-0 text-2xs"
                                >
                                  {isAi ? 'AI' : 'User'}
                                </Badge>
                              </div>
                            </div>
                            {activity.body && (
                              <p className="mt-1 line-clamp-2 text-xs text-foreground-muted">
                                {activity.body}
                              </p>
                            )}
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                              <span
                                title={when.toLocaleString('uk', {
                                  day: '2-digit',
                                  month: 'long',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              >
                                {relativeTime(activity.date)} ·{' '}
                                {when.toLocaleTimeString('uk', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {activity.contactId && (
                                <Link
                                  href={`/dashboard/contacts/${activity.contactId}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Контакт →
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <span className="text-sm text-foreground-muted">
            Сторінка {page} з {Math.ceil(total / 50)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / 50)}
            onClick={() => setPage(page + 1)}
          >
            Далі
          </Button>
        </div>
      )}
    </div>
  );
}
