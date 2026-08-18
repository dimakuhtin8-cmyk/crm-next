'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  date: string;
  contactId: string | null;
}

const typeConfig: Record<string, { icon: string; color: string; label: string }> = {
  call: { icon: '📞', color: 'bg-info/10 text-info border-info/20', label: 'Дзвінок' },
  email: { icon: '✉️', color: 'bg-primary/10 text-primary border-primary/20', label: 'Лист' },
  meeting: { icon: '🤝', color: 'bg-warning/10 text-warning border-warning/20', label: 'Зустріч' },
  task: { icon: '📋', color: 'bg-secondary text-foreground-muted border-border', label: 'Задача' },
  note: { icon: '📝', color: 'bg-success/10 text-success border-success/20', label: 'Нотатка' },
  sms: { icon: '💬', color: 'bg-danger/10 text-danger border-danger/20', label: 'SMS' },
};

export default function TimelinePage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { fetchActivities(); }, [page, filterType]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterType) params.set('type', filterType);
      const res = await fetch(`/api/activity?${params}`);
      const data = await res.json();
      setActivities(data.activities || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  };

  // Group by date
  const grouped = activities.reduce<Record<string, Activity[]>>((acc, a) => {
    const date = new Date(a.date).toLocaleDateString('uk', {
      day: 'numeric', month: 'long', year: 'numeric',
      weekday: 'long',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(a);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Таймлайн</h1>
          <p className="text-foreground-muted">Історія всіх активностей · {total} подій</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Всі типи</option>
            <option value="call">📞 Дзвінки</option>
            <option value="email">✉️ Листи</option>
            <option value="meeting">🤝 Зустрічі</option>
            <option value="task">📋 Задачі</option>
            <option value="note">📝 Нотатки</option>
            <option value="sms">💬 SMS</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {Object.entries(typeConfig).map(([key, cfg]) => {
          const count = activities.filter((a) => a.type === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilterType(filterType === key ? '' : key)}
              className={cn(
                'p-3 rounded-lg border text-center transition-all',
                filterType === key
                  ? 'border-primary bg-primary-light ring-1 ring-primary/20'
                  : 'border-border bg-card hover:bg-secondary/50',
              )}
            >
              <span className="text-xl">{cfg.icon}</span>
              <p className="text-xs text-foreground-muted mt-1">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg className="h-12 w-12 mx-auto text-foreground-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-foreground-muted">Немає активностей</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border" />
                <h2 className="text-sm font-semibold text-foreground-muted whitespace-nowrap">{date}</h2>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Activities */}
              <div className="relative ml-4 pl-6 border-l-2 border-border space-y-4">
                {items.map((activity, idx) => {
                  const cfg = typeConfig[activity.type] || typeConfig.task;
                  return (
                    <div key={activity.id} className="relative">
                      {/* Dot */}
                      <div className={cn(
                        'absolute -left-[31px] top-3 h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center text-[10px]',
                        cfg.color,
                      )}>
                        {cfg.icon}
                      </div>

                      {/* Card */}
                      <div className="p-4 bg-card rounded-xl border border-border hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{activity.title}</p>
                            {activity.body && (
                              <p className="text-sm text-foreground-muted mt-1 line-clamp-3">{activity.body}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs ml-3 flex-shrink-0">
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-xs text-foreground-muted">
                            {new Date(activity.date).toLocaleTimeString('uk', {
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
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Назад
          </Button>
          <span className="text-sm text-foreground-muted">
            Сторінка {page} з {Math.ceil(total / 50)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>
            Далі
          </Button>
        </div>
      )}
    </div>
  );
}
