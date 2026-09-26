'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@/components/ui';

interface UsageData {
  today: { requests: number; limit: number; percentage: number };
  month: { requests: number; tokensIn: number; tokensOut: number };
  byProvider: Record<string, { requests: number; tokensIn: number; tokensOut: number }>;
  limitStatus: {
    allowed: boolean;
    current: number;
    limit: number;
    percentage: number;
    isWarning: boolean;
    isExceeded: boolean;
    resetAt: string;
  };
}

export default function AiUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai/usage', { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatNumber = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const getProgressColor = (pct: number): string => {
    if (pct >= 100) return 'bg-red-500';
    if (pct >= 90) return 'bg-amber-500';
    if (pct >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">← Назад</Link>
          <h1 className="text-2xl font-bold">Використання AI</h1>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">← Назад</Link>
        <h1 className="text-2xl font-bold">Використання AI</h1>
      </div>

      {/* Today's Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Сьогодні
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold">{data.today.requests}</p>
                  <p className="text-sm text-foreground-muted">запитів сьогодні</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{data.today.limit}</p>
                  <p className="text-xs text-foreground-muted">ліміт</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="h-3 bg-accent rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(data.today.percentage)}`}
                    style={{ width: `${Math.min(data.today.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-foreground-muted">
                  <span>{data.today.percentage}% використано</span>
                  <span>{data.today.limit - data.today.requests} залишилось</span>
                </div>
              </div>

              {data.limitStatus?.isWarning && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Увага! Використано {data.today.percentage}% денного ліміту.
                  </p>
                </div>
              )}

              {data.limitStatus?.isExceeded && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Денний ліміт вичерпано. Нові AI-запити будуть відхилені до {new Date(data.limitStatus.resetAt).toLocaleTimeString('uk')}.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground-muted">Немає даних</p>
          )}
        </CardContent>
      </Card>

      {/* Monthly Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Цей місяць
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-xl bg-accent/50">
                <p className="text-2xl font-bold">{formatNumber(data.month.requests)}</p>
                <p className="text-xs text-foreground-muted">запитів</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-accent/50">
                <p className="text-2xl font-bold">{formatNumber(data.month.tokensIn)}</p>
                <p className="text-xs text-foreground-muted">вхідних токенів</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-accent/50">
                <p className="text-2xl font-bold">{formatNumber(data.month.tokensOut)}</p>
                <p className="text-xs text-foreground-muted">вихідних токенів</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">Немає даних</p>
          )}
        </CardContent>
      </Card>

      {/* By Provider */}
      <Card>
        <CardHeader>
          <CardTitle>По провайдерах</CardTitle>
        </CardHeader>
        <CardContent>
          {data && Object.keys(data.byProvider).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(data.byProvider).map(([provider, stats]) => (
                <div key={provider} className="flex items-center justify-between p-3 rounded-xl bg-accent/30">
                  <div>
                    <p className="text-sm font-medium capitalize">{provider}</p>
                    <p className="text-xs text-foreground-muted">
                      {formatNumber(stats.requests)} запитів
                    </p>
                  </div>
                  <div className="text-right text-xs text-foreground-muted">
                    <p>{formatNumber(stats.tokensIn)} in</p>
                    <p>{formatNumber(stats.tokensOut)} out</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">Немає запитів цього місяця</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
