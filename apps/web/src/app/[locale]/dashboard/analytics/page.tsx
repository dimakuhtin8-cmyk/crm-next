'use client';

import { useEffect, useState } from 'react';

import { RevenueChart, PieChartWidget, FunnelChart } from '@/components/analytics/charts';
import { DataError } from '@/components/data-error';
import { QuickSelect } from '@/components/quick-create';
import { Card, Skeleton } from '@/components/ui';

interface AnalyticsData {
  stats: {
    totalContacts: number;
    activeDeals: number;
    wonDeals: number;
    lostDeals: number;
    conversionRate: number;
    totalRevenue: number;
    forecast: number;
  };
  dealsByStage: Array<{ name: string; count: number }>;
  revenueByMonth: Array<{ name: string; revenue: number }>;
  topManagers: Array<{ name: string; deals: number }>;
  activitiesByType: Array<{ name: string; count: number }>;
}

const typeLabels: Record<string, string> = {
  call: 'Дзвінки',
  email: 'Листи',
  meeting: 'Зустрічі',
  task: 'Задачі',
  note: 'Нотатки',
  sms: 'SMS',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');

  const loadAnalytics = () => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/analytics?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Помилка ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((err: unknown) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : 'Помилка завантаження');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const s = data?.stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Аналітика</h1>
          <p className="text-foreground-secondary">Динаміка та статистика CRM</p>
        </div>
        <div className="w-44">
          <QuickSelect
            value={period}
            onChange={setPeriod}
            options={[
              { id: '7', name: 'За 7 днів' },
              { id: '30', name: 'За 30 днів' },
              { id: '90', name: 'За 90 днів' },
              { id: '365', name: 'За рік' },
            ]}
          />
        </div>
      </div>

      {loadError && <DataError message={loadError} onRetry={loadAnalytics} />}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-foreground-muted">Конверсія</p>
          <p className="mt-2 text-3xl font-bold text-primary">{s?.conversionRate || 0}%</p>
          <p className="text-sm text-foreground-muted">
            {s?.wonDeals || 0} виграних з {(s?.wonDeals || 0) + (s?.lostDeals || 0)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-foreground-muted">Загальна виручка</p>
          <p className="mt-2 text-3xl font-bold text-success">
            ₴{(s?.totalRevenue || 0).toLocaleString('uk')}
          </p>
          <p className="text-sm text-foreground-muted">Від виграних угод</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-foreground-muted">Прогноз</p>
          <p className="mt-2 text-3xl font-bold text-warning">
            ₴{(s?.forecast || 0).toLocaleString('uk')}
          </p>
          <p className="text-sm text-foreground-muted">На основі середньої угоди</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-foreground-muted">Активні угоди</p>
          <p className="mt-2 text-3xl font-bold text-info">{s?.activeDeals || 0}</p>
          <p className="text-sm text-foreground-muted">У робочій воронці</p>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card>
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Виручка по місяцях</h2>
        </div>
        <div className="p-5">
          <RevenueChart data={data?.revenueByMonth || []} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <Card>
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold">Воронка продажів</h2>
          </div>
          <div className="p-5">
            <FunnelChart data={data?.dealsByStage || []} />
          </div>
        </Card>

        {/* Activities */}
        <Card>
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold">Активності за період</h2>
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
      </div>

      {/* Top managers */}
      {data?.topManagers && data.topManagers.length > 0 && (
        <Card>
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold">Топ менеджери</h2>
          </div>
          <div className="divide-y divide-border">
            {data.topManagers.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground-muted w-6">{i + 1}</span>
                  <span className="font-medium">{m.name}</span>
                </div>
                <span className="text-sm text-foreground-muted">{m.deals} угод</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
