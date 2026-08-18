'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Card, Badge, Skeleton } from '@/components/ui';
import { BarChartWidget, PieChartWidget, LineChartWidget } from '@/components/analytics/charts';

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics?period=30')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    { name: 'Контакти', value: stats?.totalContacts || 0, sub: `+${stats?.newContacts || 0} за місяць`, color: 'text-primary' },
    { name: 'Активні угоди', value: stats?.activeDeals || 0, sub: `${stats?.conversionRate || 0}% конверсія`, color: 'text-info' },
    { name: 'Завершені угоди', value: stats?.wonDeals || 0, sub: `${stats?.lostDeals || 0} втрачено`, color: 'text-success' },
    { name: 'Прогноз виручки', value: `₴${(stats?.forecast || 0).toLocaleString('uk')}`, sub: `₴${(stats?.totalRevenue || 0).toLocaleString('uk')} отримано`, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Огляд</h1>
        <p className="text-foreground-secondary">Статистика за останні 30 днів</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className="p-5">
            <p className="text-sm text-foreground-muted">{stat.name}</p>
            <p className={`mt-2 text-3xl font-bold tracking-tight ${stat.color}`}>{stat.value}</p>
            <p className="mt-1 text-sm text-foreground-muted">{stat.sub}</p>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by month */}
        <Card>
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold">Виручка по місяцях</h2>
          </div>
          <div className="p-5">
            <BarChartWidget data={data?.revenueByMonth || []} />
          </div>
        </Card>

        {/* Deals by stage (funnel) */}
        <Card>
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold">Воронка угод</h2>
          </div>
          <div className="p-5">
            <BarChartWidget data={data?.dealsByStage || []} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contacts trend */}
        <Card>
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold">Нові контакти</h2>
          </div>
          <div className="p-5">
            <LineChartWidget data={data?.contactsByMonth || []} />
          </div>
        </Card>

        {/* Tasks by status */}
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

        {/* Activities by type */}
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
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/dashboard/contacts">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-primary">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center">
                <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-primary">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success-light flex items-center justify-center">
                <svg className="h-5 w-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-primary">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning-light flex items-center justify-center">
                <svg className="h-5 w-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
    </div>
  );
}
