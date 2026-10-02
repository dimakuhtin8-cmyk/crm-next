'use client';

import { Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { resetTour, useTour, useTourAutoStart } from '@/components/tour/tour-provider';
import { Badge, Card, Skeleton, Table } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Показники дашборду (аналітика за 30 днів). */
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
}

/** Рядок таблиці «Останні угоди». */
type RecentDeal = {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  probability: number;
  company: string | null;
  createdAt: string;
  contact?: { firstName: string; lastName: string } | null;
};

/** Виконання автоматизації (відповідь збагачена полем ruleName). */
type AutomationLogItem = {
  id: string;
  ruleName?: string;
  actionType: string;
  result: string;
  executedAt: string;
};

/** Запис активності — фолбек-джерело AI-стрічки. */
type ActivityItem = {
  id: string;
  type: string;
  description: string;
  contactName: string | null;
  createdAt: string;
};

/** AI-стрічка: логи автоматизацій або запасні активності. */
type FeedState =
  | { kind: 'logs'; items: AutomationLogItem[] }
  | { kind: 'activities'; items: ActivityItem[] }
  | null;

const currencySymbols: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
};

const actionLabels: Record<string, string> = {
  set_field: 'Оновлено поле',
  create_task: 'Створено задачу',
  send_notification: 'Надіслано сповіщення',
  move_deal: 'Переміщено угоду',
  send_message: 'Надіслано повідомлення',
};

const activityTypeLabels: Record<string, string> = {
  call: 'Дзвінок',
  email: 'Лист',
  meeting: 'Зустріч',
  task: 'Задача',
  note: 'Нотатка',
  sms: 'SMS',
};

const formatFeedTime = (value: string) =>
  new Date(value).toLocaleString('uk', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const dealColumns = [
  {
    key: 'title',
    header: 'Назва',
    className: 'w-1/3',
    render: (deal: RecentDeal) => <span className="block truncate font-medium">{deal.title}</span>,
  },
  {
    key: 'value',
    header: 'Сума',
    render: (deal: RecentDeal) =>
      deal.value == null
        ? '—'
        : `${currencySymbols[deal.currency] || deal.currency}${deal.value.toLocaleString('uk')}`,
  },
  {
    key: 'contact',
    header: 'Контакт',
    render: (deal: RecentDeal) => (
      <span className="block truncate text-sm text-foreground-muted">
        {deal.contact
          ? `${deal.contact.firstName} ${deal.contact.lastName || ''}`.trim()
          : deal.company || '—'}
      </span>
    ),
  },
  {
    key: 'probability',
    header: 'Ймовірність',
    render: (deal: RecentDeal) => (
      <span className="text-sm text-foreground-muted">{deal.probability}%</span>
    ),
  },
  {
    key: 'createdAt',
    header: 'Створено',
    render: (deal: RecentDeal) =>
      new Date(deal.createdAt).toLocaleDateString('uk', { day: '2-digit', month: 'short' }),
  },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentDeals, setRecentDeals] = useState<RecentDeal[]>([]);
  const [feed, setFeed] = useState<FeedState>(null);
  const [automationStats, setAutomationStats] = useState<{
    total: number;
    active: number;
  } | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [steps, setSteps] = useState<{
    hasContacts: boolean;
    hasDeals: boolean;
    telegramConnected: boolean;
    aiConnected: boolean;
    hasTeammates: boolean;
  } | null>(null);
  const [stepsHidden, setStepsHidden] = useState(false);
  const { startTour } = useTour();
  const router = useRouter();

  useTourAutoStart('dashboard');

  useEffect(() => {
    // AI-стрічка: спочатку логи автоматизацій, далі запасні активності.
    const loadFeed = async () => {
      try {
        const res = await fetch('/api/automation/logs?limit=6');
        if (res.ok) {
          const payload = await res.json();
          const logs: AutomationLogItem[] = payload.logs || [];
          if (logs.length > 0) {
            setFeed({ kind: 'logs', items: logs });
            return;
          }
        }
      } catch {
        // роут лише для адміністраторів: 403 для учасника — ідемо в фолбек
      }
      try {
        const res = await fetch('/api/activity/recent?limit=6');
        const payload = await res.json();
        setFeed({ kind: 'activities', items: payload.activities || [] });
      } catch {
        // тихий фолбек: стрічка просто лишиться порожньою
        setFeed({ kind: 'activities', items: [] });
      }
    };

    fetch('/api/analytics?period=30')
      .then((r) => r.json())
      .then((d: DashboardData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Останні угоди: GET /api/deals відповідає через apiSuccess.
    fetch('/api/deals?limit=8')
      .then((r) => r.json())
      .then((d) => setRecentDeals(d.data?.deals || d.deals || []))
      .catch(() => {
        // угоди просто не покажемо
      });

    // Метрика автоматизацій: тихий збій дає 0 і підпис «—».
    fetch('/api/automation/rules')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rules: Array<{ enabled: boolean }> = d?.rules || [];
        setAutomationStats({
          total: rules.length,
          active: rules.filter((r) => r.enabled).length,
        });
      })
      .catch(() => {
        // тихий збій: показник лишається 0 із підписом «—»
        setAutomationStats(null);
      });

    void loadFeed();

    // Пробний період — ненав'язливий баннер, тихий збій допустимий.
    fetch('/api/billing/subscription', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.subscription?.isTrial && (d.subscription.trialDaysLeft || 0) > 0) {
          setTrialDaysLeft(d.subscription.trialDaysLeft);
        }
      })
      .catch(() => {
        // фонова перевірка пробного періоду: баннера просто не буде
      });
    // «Перші кроки» — з даних, тихий збій допустимий.
    try {
      if (localStorage.getItem('first-steps-hidden') === '1') setStepsHidden(true);
    } catch {
      // localStorage недоступний — картка покажеться
    }
    fetch('/api/onboarding/checklist', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSteps(d);
      })
      .catch(() => {
        // фоновий чекліст: мовчки, картки просто не буде
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Trial banner */}
      {trialDaysLeft !== null && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="text-lg">🎁</span>
          <p>
            <span className="font-semibold">Пробний період: залишилось {trialDaysLeft} дн.</span>{' '}
            <span className="text-foreground-muted">
              Насолоджуйтесь повними можливостями — після закінчення діятимуть ліміти безкоштовного
              плану, дані збережуться.
            </span>
          </p>
        </div>
      )}

      {/* First steps */}
      {steps &&
        !stepsHidden &&
        !(
          steps.hasContacts &&
          steps.hasDeals &&
          steps.telegramConnected &&
          steps.aiConnected &&
          steps.hasTeammates
        ) && (
          <Card className="p-5" data-tour="first-steps">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Перші кроки</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    resetTour('dashboard');
                    startTour('dashboard');
                  }}
                  className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                >
                  Пройти тур
                </button>
                <button
                  onClick={() => {
                    try {
                      localStorage.setItem('first-steps-hidden', '1');
                    } catch {
                      // localStorage недоступний — просто ховаємо до перезавантаження
                    }
                    setStepsHidden(true);
                  }}
                  className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                >
                  Пізніше
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {[
                {
                  done: steps.hasContacts,
                  label: 'Додати або імпортувати контакти',
                  href: '/dashboard/contacts',
                },
                { done: steps.hasDeals, label: 'Створити першу угоду', href: '/dashboard/deals' },
                {
                  done: steps.telegramConnected,
                  label: 'Підключити Telegram',
                  href: '/dashboard/settings/telegram',
                },
                {
                  done: steps.aiConnected,
                  label: 'Підключити AI',
                  href: '/dashboard/settings/ai-keys',
                },
                {
                  done: steps.hasTeammates,
                  label: 'Запросити колегу',
                  href: '/dashboard/settings/tenants',
                },
              ].map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="flex items-center gap-3 rounded-xl border border-border px-4 py-2.5 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      s.done ? 'bg-success text-white' : 'bg-secondary text-foreground-muted',
                    )}
                  >
                    {s.done ? '✓' : '·'}
                  </span>
                  <span className={cn(s.done && 'text-foreground-muted line-through')}>
                    {s.label}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}

      {/* Шапка */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Огляд</h1>
        <p className="text-sm text-foreground-muted">Статистика за останні 30 днів</p>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-foreground-muted">Контакти</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
            {stats?.totalContacts || 0}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">+{stats?.newContacts || 0} за місяць</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-foreground-muted">Активні угоди</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
            {stats?.activeDeals || 0}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {stats?.conversionRate || 0}% конверсія
          </p>
        </Card>

        <Card className="border-foreground bg-foreground p-4 text-background">
          <p className="text-xs font-medium text-background/60">Виграна виручка</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-primary">
            ₴{(stats?.totalRevenue || 0).toLocaleString('uk')}
          </p>
          <p className="mt-1 text-xs text-background/60">{stats?.wonDeals || 0} виграних угод</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-foreground-muted">AI-автоматизації</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
            {automationStats ? automationStats.total : 0}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {automationStats ? `${automationStats.active} активних` : '—'}
          </p>
        </Card>
      </div>

      {/* Основна секція */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Останні угоди */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-base font-semibold">Останні угоди</h2>
            <Link
              href="/dashboard/deals"
              className="text-xs font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Всі угоди →
            </Link>
          </div>
          <div className="p-4">
            {recentDeals.length === 0 ? (
              <p className="py-8 text-center text-sm text-foreground-muted">Угод поки немає</p>
            ) : (
              <Table
                columns={dealColumns}
                data={recentDeals}
                pageSize={10}
                onRowClick={(deal) => router.push('/dashboard/deals/' + deal.id)}
                emptyMessage="Угод поки немає"
              />
            )}
          </div>
        </Card>

        {/* AI-стрічка */}
        <Card>
          <div className="border-b border-border p-4">
            <h2 className="text-base font-semibold">AI та автоматизації</h2>
          </div>
          {feed === null ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : feed.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground-muted">Подій ще немає</p>
          ) : feed.kind === 'logs' ? (
            <ul>
              {feed.items.map((log) => (
                <li
                  key={log.id}
                  className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <span className="rounded-md bg-secondary p-1.5 text-foreground-muted">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {log.ruleName || 'Система'}
                      </Badge>
                      <Badge
                        variant={log.result === 'error' ? 'danger' : 'success'}
                        className="text-xs"
                      >
                        {log.result === 'error' ? 'Помилка' : 'Успіх'}
                      </Badge>
                    </div>
                    <p className="truncate text-sm">
                      {actionLabels[log.actionType] || log.actionType}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-foreground-muted">
                    {formatFeedTime(log.executedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {feed.items.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <Badge variant="outline" className="text-xs">
                      {activityTypeLabels[activity.type] || activity.type}
                    </Badge>
                    <p className="truncate text-sm">{activity.description}</p>
                    {activity.contactName && (
                      <p className="text-xs text-foreground-muted">{activity.contactName}</p>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-xs text-foreground-muted">
                    {formatFeedTime(activity.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
