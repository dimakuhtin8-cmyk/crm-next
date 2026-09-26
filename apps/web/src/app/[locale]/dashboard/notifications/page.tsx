'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Card, Badge, Skeleton } from '@/components/ui';
import {
  Bell,
  CheckSquare,
  Phone,
  Mail,
  Calendar,
  Repeat,
  ArrowLeft,
} from 'lucide-react';
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

type Filter = 'all' | 'overdue' | 'upcoming';

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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    fetch('/api/tasks/reminders?hours=24')
      .then((r) => r.json())
      .then((data) => {
        setOverdue(data.overdue || []);
        setUpcoming(data.upcoming || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-muted transition-colors hover:text-[#111214]"
        >
          <ArrowLeft className="h-4 w-4" />
          До огляду
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111214]">
            <Bell className="h-5 w-5 text-[#FFC700]" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111214]">Сповіщення</h1>
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
                ? 'border-[#111214] bg-[#111214] text-[#FFC700]'
                : 'border-border bg-card text-[#111214] hover:border-[#111214]'
            )}
          >
            {tab.label}
            <Badge variant="secondary">{tab.count}</Badge>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFC700]/20">
            <CheckSquare className="h-6 w-6 text-[#111214]" />
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
                  task.flag === 'overdue' ? 'bg-danger/10 text-danger' : 'bg-[#111214] text-[#FFC700]'
                )}
              >
                {typeIcons[task.type] || <CheckSquare className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{task.title}</span>
                <span className={cn(
                  'block text-xs',
                  task.flag === 'overdue' ? 'text-danger' : 'text-foreground-muted'
                )}>
                  {task.flag === 'overdue' ? 'Протерміновано · ' : ''}
                  {formatDateTime(task.reminderAt)}
                </span>
              </span>
              <span className={cn('shrink-0 text-xs font-semibold', priorityConfig[task.priority]?.color)}>
                {priorityConfig[task.priority]?.label}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
