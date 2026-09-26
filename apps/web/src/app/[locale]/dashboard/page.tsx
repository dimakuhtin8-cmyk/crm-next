'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Card, Badge, Skeleton } from '@/components/ui';
import { BarChartWidget, PieChartWidget, LineChartWidget } from '@/components/analytics/charts';
import {
  CheckSquare,
  Clock,
  Activity,
  AlertTriangle,
  Calendar,
  Settings2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Phone,
  Mail,
  StickyNote,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardData {
  stats: {
    totalContacts: number;
    newContacts: number;
    activeDeals: number;
    wonDeals: number;
    lostDeals: number;
    conversionRate: number;
    totalRevenue: number;
    forecast: number;
  };
  tasksByStatus: Array<{ name: string; count: number }>;
  dealsByStage: Array<{ name: string; count: number }>;
  contactsByMonth: Array<{ name: string; count: number }>;
  revenueByMonth: Array<{ name: string; revenue: number }>;
  activitiesByType: Array<{ name: string; count: number }>;
}

interface UpcomingTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string | null;
  reminderAt: string | null;
  isOverdue: boolean;
  isReminderDue: boolean;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  dealId: string | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  todo: 'До виконання',
  in_progress: 'В роботі',
  done: 'Готово',
  cancelled: 'Скасовано',
};

const typeLabels: Record<string, string> = {
  call: 'Дзвінки',
  email: 'Листи',
  meeting: 'Зустрічі',
  task: 'Задачі',
  note: 'Нотатки',
  sms: 'SMS',
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Терміново', color: 'text-danger' },
  high: { label: 'Високий', color: 'text-warning' },
  medium: { label: 'Середній', color: 'text-info' },
  low: { label: 'Низький', color: 'text-foreground-muted' },
};

const activityIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
};

type WidgetId =
  | 'stats'
  | 'revenue'
  | 'funnel'
  | 'contacts'
  | 'tasksPie'
  | 'activitiesPie'
  | 'upcoming'
  | 'recent'
  | 'quick';

const DEFAULT_WIDGETS: Array<{ id: WidgetId; title: string; span: string }> = [
  { id: 'stats', title: 'Метрики', span: 'md:col-span-6' },
  { id: 'revenue', title: 'Виручка по місяцях', span: 'md:col-span-3' },
  { id: 'funnel', title: 'Воронка угод', span: 'md:col-span-3' },
  { id: 'contacts', title: 'Нові контакти', span: 'md:col-span-2' },
  { id: 'tasksPie', title: 'Задачі', span: 'md:col-span-2' },
  { id: 'activitiesPie', title: 'Активності', span: 'md:col-span-2' },
  { id: 'upcoming', title: 'Ближчі задачі', span: 'md:col-span-3' },
  { id: 'recent', title: 'Останні активності', span: 'md:col-span-3' },
  { id: 'quick', title: 'Швидкі посилання', span: 'md:col-span-6' },
];

const STORAGE_KEY = 'crm-dashboard-widgets-v1';

function loadWidgetState(): { order: WidgetId[]; hidden: WidgetId[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: DEFAULT_WIDGETS.map((w) => w.id), hidden: [] };
    const parsed = JSON.parse(raw) as { order?: string[]; hidden?: string[] };
    const known = new Set(DEFAULT_WIDGETS.map((w) => w.id));
    const order = (parsed.order || []).filter((id): id is WidgetId => known.has(id as WidgetId));
    // Append any new widgets missing from storage
    for (const w of DEFAULT_WIDGETS) {
      if (!order.includes(w.id)) order.push(w.id);
    }
    const hidden = (parsed.hidden || []).filter((id): id is WidgetId => known.has(id as WidgetId));
    return { order, hidden };
  } catch {
    return { order: DEFAULT_WIDGETS.map((w) => w.id), hidden: [] };
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => DEFAULT_WIDGETS.map((w) => w.id));
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics?period=30').then(r => r.json()),
      fetch('/api/tasks/upcoming?limit=5&hours=48').then(r => r.json()),
      fetch('/api/activity/recent?limit=5').then(r => r.json()),
    ])
      .then(([analytics, tasks, activities]) => {
        setData(analytics);
        setUpcomingTasks(tasks.tasks || []);
        setRecentActivities(activities.activities || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const { order, hidden } = loadWidgetState();
    setWidgetOrder(order);
    setHiddenWidgets(hidden);
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: widgetOrder, hidden: hiddenWidgets }));
    } catch {}
  }, [widgetOrder, hiddenWidgets, prefsLoaded]);

  const moveWidget = (id: WidgetId, dir: -1 | 1) => {
    setWidgetOrder((prev) => {
      const idx = prev.indexOf(id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const toggleWidget = (id: WidgetId) => {
    setHiddenWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  };

  const resetWidgets = () => {
    setWidgetOrder(DEFAULT_WIDGETS.map((w) => w.id));
    setHiddenWidgets([]);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const statCards = [
    { name: 'Контакти', value: stats?.totalContacts || 0, sub: `+${stats?.newContacts || 0} за місяць`, accent: false },
    { name: 'Активні угоди', value: stats?.activeDeals || 0, sub: `${stats?.conversionRate || 0}% конверсія`, accent: false },
    { name: 'Завершені угоди', value: stats?.wonDeals || 0, sub: `${stats?.lostDeals || 0} втрачено`, accent: false },
    { name: 'Прогноз виручки', value: `₴${(stats?.forecast || 0).toLocaleString('uk')}`, sub: `₴${(stats?.totalRevenue || 0).toLocaleString('uk')} отримано`, accent: true },
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const widgets: Record<WidgetId, React.ReactNode> = {
    stats: (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.name}
            className={cn(
              'p-5',
              stat.accent && 'border-black bg-[#111214] text-white'
            )}
          >
            <p className={cn('text-sm', stat.accent ? 'text-white/60' : 'text-foreground-muted')}>{stat.name}</p>
            <p className={cn(
              'mt-2 text-3xl font-bold tabular-nums tracking-tight',
              stat.accent ? 'text-[#FFC700]' : 'text-[#111214]'
            )}>
              {stat.value}
            </p>
            <p className={cn('mt-1 text-sm', stat.accent ? 'text-white/60' : 'text-foreground-muted')}>{stat.sub}</p>
          </Card>
        ))}
      </div>
    ),
    revenue: (
      <Card>
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Виручка по місяцях</h2>
        </div>
        <div className="p-5">
          <BarChartWidget data={data?.revenueByMonth || []} />
        </div>
      </Card>
    ),
    funnel: (
      <Card>
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Воронка угод</h2>
        </div>
        <div className="p-5">
          <BarChartWidget data={data?.dealsByStage || []} />
        </div>
      </Card>
    ),
    contacts: (
      <Card>
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Нові контакти</h2>
        </div>
        <div className="p-5">
          <LineChartWidget data={data?.contactsByMonth || []} />
        </div>
      </Card>
    ),
    tasksPie: (
      <Card>
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Задачі</h2>
        </div>
        <div className="p-5">
          <PieChartWidget
            data={(data?.tasksByStatus || []).map((t) => ({
              name: statusLabels[t.name] || t.name,
              value: t.count,
            }))}
          />
        </div>
      </Card>
    ),
    activitiesPie: (
      <Card>
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Активності</h2>
        </div>
        <div className="p-5">
          <PieChartWidget
            data={(data?.activitiesByType || []).map((a) => ({
              name: typeLabels[a.name] || a.name,
              value: a.count,
            }))}
          />
        </div>
      </Card>
    ),
    upcoming: (
      <Card>
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#111214]" />
              <h2 className="text-lg font-semibold">Ближчі задачі</h2>
            </div>
            <Link href="/dashboard/tasks" className="text-sm font-semibold text-[#111214] underline-offset-4 hover:underline">
              Всі →
            </Link>
          </div>
        </div>
        <div className="p-5">
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckSquare className="h-12 w-12 text-foreground-muted mx-auto mb-3" />
              <p className="text-sm text-foreground-muted">Немає ближчих задач</p>
              <p className="text-xs text-foreground-muted/70 mt-1">Все під контролем!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/dashboard/tasks/${task.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                >
                  <div className={cn(
                    'p-2 rounded-lg',
                    task.isOverdue ? 'bg-danger/10 text-danger' : 'bg-[#111214] text-[#FFC700]'
                  )}>
                    {activityIcons[task.type] || <CheckSquare className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{task.title}</p>
                    <p className={cn(
                      'text-xs',
                      task.isOverdue ? 'text-danger' : 'text-foreground-muted'
                    )}>
                      {task.dueDate && formatDate(task.dueDate)}
                    </p>
                  </div>
                  <span className={cn('text-xs font-medium', priorityConfig[task.priority]?.color)}>
                    {priorityConfig[task.priority]?.label}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
    ),
    recent: (
      <Card>
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#111214]" />
              <h2 className="text-lg font-semibold">Останні активності</h2>
            </div>
            <Link href="/dashboard/timeline" className="text-sm font-semibold text-[#111214] underline-offset-4 hover:underline">
              Таймлайн →
            </Link>
          </div>
        </div>
        <div className="p-5">
          {recentActivities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-foreground-muted mx-auto mb-3" />
              <p className="text-sm text-foreground-muted">Немає активностей</p>
              <p className="text-xs text-foreground-muted/70 mt-1">Почніть з додавання контактів</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-secondary text-foreground-muted">
                    {activityIcons[activity.type] || <Activity className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.description}</p>
                    {activity.contactName && (
                      <p className="text-xs text-foreground-muted">
                        {activity.contactName}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-foreground-muted whitespace-nowrap">
                    {formatDate(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    ),
    quick: (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/dashboard/contacts">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-[#111214]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#111214] flex items-center justify-center">
                <svg className="h-5 w-5 text-[#FFC700]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Контакти</p>
                <p className="text-sm text-foreground-muted">{stats?.totalContacts || 0} контактів</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/dashboard/deals">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-[#111214]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#111214] flex items-center justify-center">
                <svg className="h-5 w-5 text-[#FFC700]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Угоди</p>
                <p className="text-sm text-foreground-muted">{stats?.activeDeals || 0} активних</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/dashboard/tasks">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-[#111214]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#111214] flex items-center justify-center">
                <svg className="h-5 w-5 text-[#FFC700]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Задачі</p>
                <p className="text-sm text-foreground-muted">{data?.tasksByStatus?.find((t) => t.name !== 'done' && t.name !== 'cancelled')?.count || 0} активних</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    ),
  };

  const spanFor = (id: WidgetId) => DEFAULT_WIDGETS.find((w) => w.id === id)?.span || 'md:col-span-6';
  const titleFor = (id: WidgetId) => DEFAULT_WIDGETS.find((w) => w.id === id)?.title || id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111214]">Огляд</h1>
          <p className="text-foreground-secondary">Статистика за останні 30 днів</p>
        </div>
        <button
          onClick={() => setCustomizing(!customizing)}
          className={cn(
            'inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors',
            customizing
              ? 'border-[#111214] bg-[#111214] text-[#FFC700]'
              : 'border-border bg-card text-[#111214] hover:border-[#111214]'
          )}
          aria-expanded={customizing}
        >
          <Settings2 className="h-4 w-4" />
          Налаштувати
        </button>
      </div>

      {customizing && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Віджети дашборда</h2>
            <button
              onClick={resetWidgets}
              className="text-sm font-semibold text-[#111214] underline-offset-4 hover:underline"
            >
              Скинути
            </button>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            Приховуйте непотрібне та змінюйте порядок. Налаштування зберігаються в цьому браузері.
          </p>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {widgetOrder.map((id, idx) => {
              const hidden = hiddenWidgets.includes(id);
              return (
                <li key={id} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 text-sm font-medium">{titleFor(id)}</span>
                  {hidden && <Badge variant="outline">Приховано</Badge>}
                  <button
                    onClick={() => moveWidget(id, -1)}
                    disabled={idx === 0}
                    className="rounded-lg p-2 text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
                    title="Вище"
                    aria-label={`Перемістити ${titleFor(id)} вище`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveWidget(id, 1)}
                    disabled={idx === widgetOrder.length - 1}
                    className="rounded-lg p-2 text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
                    title="Нижче"
                    aria-label={`Перемістити ${titleFor(id)} нижче`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleWidget(id)}
                    className={cn(
                      'rounded-lg p-2 transition-colors',
                      hidden
                        ? 'bg-[#FFC700]/20 text-[#111214] hover:bg-[#FFC700]/30'
                        : 'text-foreground-muted hover:bg-secondary hover:text-foreground'
                    )}
                    title={hidden ? 'Показати' : 'Приховати'}
                    aria-label={`${hidden ? 'Показати' : 'Приховати'} ${titleFor(id)}`}
                    aria-pressed={!hidden}
                  >
                    {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {widgetOrder
          .filter((id) => !hiddenWidgets.includes(id))
          .map((id) => (
            <div key={id} className={cn('min-w-0', spanFor(id))}>
              {widgets[id]}
            </div>
          ))}
      </div>

      {widgetOrder.filter((id) => !hiddenWidgets.includes(id)).length === 0 && (
        <Card className="p-10 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-foreground-muted" />
          <p className="font-semibold">Усі віджети приховано</p>
          <p className="mt-1 text-sm text-foreground-muted">Увімкніть хоча б один віджет у налаштуваннях вище.</p>
        </Card>
      )}
    </div>
  );
}
