'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

const typeConfig: Record<string, { icon: string; color: string }> = {
  call: { icon: '📞', color: 'bg-info/10 text-info' },
  email: { icon: '✉️', color: 'bg-primary/10 text-primary' },
  meeting: { icon: '🤝', color: 'bg-warning/10 text-warning' },
  task: { icon: '📋', color: 'bg-secondary text-foreground-muted' },
  note: { icon: '📝', color: 'bg-success/10 text-success' },
  sms: { icon: '💬', color: 'bg-danger/10 text-danger' },
};

export default function ActivityPage() {
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
    const date = new Date(a.date).toLocaleDateString('uk', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(a);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Активність</h1>
          <p className="text-foreground-muted">{total} подій</p>
        </div>
        <div className="flex gap-2">
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Всі типи</option>
            <option value="call">Дзвінки</option><option value="email">Листи</option><option value="meeting">Зустрічі</option><option value="task">Задачі</option><option value="note">Нотатки</option><option value="sms">SMS</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-foreground-muted">Немає активностей</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-foreground-muted mb-3 sticky top-0 bg-background py-1">{date}</h2>
              <div className="space-y-2 ml-4 border-l-2 border-border pl-4">
                {items.map((activity) => {
                  const cfg = typeConfig[activity.type] || typeConfig.task;
                  return (
                    <div key={activity.id} className="flex gap-3 p-3 bg-card rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                      <div className={cn('h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center text-sm', cfg.color)}>
                        {cfg.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        {activity.body && <p className="text-xs text-foreground-muted mt-1 line-clamp-2">{activity.body}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-foreground-muted">
                            {new Date(activity.date).toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {activity.contactId && (
                            <Link href={`/dashboard/contacts/${activity.contactId}`} className="text-xs text-primary hover:underline">
                              Переглянути контакт →
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

      {total > 50 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button>
          <span className="text-sm text-foreground-muted">Сторінка {page} з {Math.ceil(total / 50)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>Далі</Button>
        </div>
      )}
    </div>
  );
}
