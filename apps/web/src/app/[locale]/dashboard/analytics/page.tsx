'use client';

import { useEffect, useState } from 'react';

import { Card, Skeleton } from '@/components/ui';
import { BarChartWidget, RevenueChart, PieChartWidget, FunnelChart } from '@/components/analytics/charts';

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
  call: 'Дзвінки', email: 'Листи', meeting: 'Зустрічі',
  task: 'Задачі', note: 'Нотатки', sms: 'SMS',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" /><Skeleton className="h-80" />
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
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="7">За 7 днів</option>
          <option value="30">За 30 днів</option>
          <option value="90">За 90 днів</option>
          <option value="365">За рік</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-foreground-muted">Конверсія</p>
          <p className="mt-2 text-3xl font-bold text-primary">{s?.conversionRate || 0}%</p>
          <p className="text-sm text-foreground-muted">{s?.wonDeals || 0} виграних з {s?.wonDeals! + s?.lostDeals! || 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-foreground-muted">Загальна виручка</p>
          <p className="mt-2 text-3xl font-bold text-success">₴{(s?.totalRevenue || 0).toLocaleString('uk')}</p>
          <p className="text-sm text-foreground-muted">Від виграних угод</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-foreground-muted">Прогноз</p>
          <p className="mt-2 text-3xl font-bold text-warning">₴{(s?.forecast || 0).toLocaleString('uk')}</p>
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
