'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { RevenueChart, PieChartWidget, FunnelChart } from '@/components/analytics/charts';
import { DataError } from '@/components/data-error';
import { QuickSelect } from '@/components/quick-create';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';

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

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const tRoot = useTranslations();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');

  const typeLabels: Record<string, string> = {
    call: tRoot('timeline.calls'),
    email: tRoot('timeline.emails'),
    meeting: tRoot('timeline.meetings'),
    task: tRoot('timeline.tasks'),
    note: tRoot('timeline.notes'),
    sms: 'SMS',
  };

  const loadAnalytics = () => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/analytics?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(t('errors.requestFailed', { status: r.status }));
        return r.json();
      })
      .then(setData)
      .catch((err: unknown) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : t('errors.loadFailed'));
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
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-foreground-secondary">{t('subtitle')}</p>
        </div>
        <div className="w-44">
          <QuickSelect
            value={period}
            onChange={setPeriod}
            options={[
              { id: '7', name: t('periodDays7') },
              { id: '30', name: t('periodDays30') },
              { id: '90', name: t('periodDays90') },
              { id: '365', name: t('periodYear') },
            ]}
          />
        </div>
      </div>

      {loadError && <DataError message={loadError} onRetry={loadAnalytics} />}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 shadow-sm">
          <p className="text-sm text-foreground-muted">{t('conversion')}</p>
          <p className="mt-2 text-2xl font-bold text-primary">{s?.conversionRate || 0}%</p>
          <p className="text-sm text-foreground-muted">
            {t('wonOfTotal', {
              won: s?.wonDeals || 0,
              total: (s?.wonDeals || 0) + (s?.lostDeals || 0),
            })}
          </p>
        </Card>
        <Card className="p-5 shadow-sm">
          <p className="text-sm text-foreground-muted">{t('totalRevenue')}</p>
          <p className="mt-2 text-2xl font-bold text-success">
            ₴{(s?.totalRevenue || 0).toLocaleString('uk')}
          </p>
          <p className="text-sm text-foreground-muted">{t('fromWonDeals')}</p>
        </Card>
        <Card className="p-5 shadow-sm">
          <p className="text-sm text-foreground-muted">{t('forecast')}</p>
          <p className="mt-2 text-2xl font-bold text-warning">
            ₴{(s?.forecast || 0).toLocaleString('uk')}
          </p>
          <p className="text-sm text-foreground-muted">{t('basedOnAverageDeal')}</p>
        </Card>
        <Card className="p-5 shadow-sm">
          <p className="text-sm text-foreground-muted">{t('activeDeals')}</p>
          <p className="mt-2 text-2xl font-bold text-info">{s?.activeDeals || 0}</p>
          <p className="text-sm text-foreground-muted">{t('inWorkPipeline')}</p>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card className="shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle>{t('revenueByMonth')}</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <RevenueChart data={data?.revenueByMonth || []} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle>{tRoot('deals.salesPipeline')}</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <FunnelChart data={data?.dealsByStage || []} />
          </CardContent>
        </Card>

        {/* Activities */}
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle>{t('activitiesByPeriod')}</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <PieChartWidget
              data={(data?.activitiesByType || []).map((a) => ({
                name: typeLabels[a.name] || a.name,
                value: a.count,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top managers */}
      {data?.topManagers && data.topManagers.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle>{t('topManagers')}</CardTitle>
          </CardHeader>
          <div className="divide-y divide-border">
            {data.topManagers.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground-muted w-6">{i + 1}</span>
                  <span className="font-medium">{m.name}</span>
                </div>
                <span className="text-sm text-foreground-muted">
                  {t('dealsCount', { count: m.deals })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
