'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Filter, ChevronLeft, ChevronRight, Check, X, Clock, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@/components/ui';
import { AI_PROVIDERS } from '@/lib/ai/providers';

interface LogEntry {
  id: string;
  provider: string;
  model: string;
  status: string;
  durationMs: number;
  promptPreview: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  success: { label: 'Успішно', color: 'bg-green-500/10 text-green-700 dark:text-green-300', icon: <Check className="w-3 h-3" /> },
  error: { label: 'Помилка', color: 'bg-red-500/10 text-red-700 dark:text-red-300', icon: <X className="w-3 h-3" /> },
  rate_limited: { label: 'Ліміт', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: <Clock className="w-3 h-3" /> },
  timeout: { label: 'Тайм-аут', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300', icon: <Clock className="w-3 h-3" /> },
};

export default function CopilotLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: '20' });
    if (providerFilter) params.set('provider', providerFilter);
    if (statusFilter) params.set('status', statusFilter);

    try {
      const res = await fetch(`/api/ai/logs?${params}`, { credentials: 'include' });
      const json = await res.json();
      setData(json);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, providerFilter, statusFilter]);

  const formatDuration = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  const getProviderName = (id: string): string => {
    return AI_PROVIDERS.find(p => p.id === id)?.name || id;
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/copilot" className="text-muted-foreground hover:text-foreground">← Назад</Link>
        <h1 className="text-2xl font-bold">Логи AI-запитів</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-foreground-muted" />
              <span className="text-sm font-medium">Фільтри:</span>
            </div>

            <select
              value={providerFilter}
              onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
            >
              <option value="">Всі провайдери</option>
              {AI_PROVIDERS.filter(p => p.id !== 'custom').map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
            >
              <option value="">Всі статуси</option>
              <option value="success">Успішно</option>
              <option value="error">Помилка</option>
              <option value="rate_limited">Ліміт</option>
              <option value="timeout">Тайм-аут</option>
            </select>

            {(providerFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setProviderFilter(''); setStatusFilter(''); setPage(1); }}
              >
                Скинути
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : data && data.logs.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted">Час</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted">Провайдер</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted">Модель</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted">Статус</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-foreground-muted">Тривалість</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-muted">Запит</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => {
                  const statusConf = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;
                  return (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-foreground-muted whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('uk', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium capitalize">{getProviderName(log.provider)}</td>
                      <td className="px-4 py-3 text-sm text-foreground-muted">{log.model}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.color}`}>
                          {statusConf.icon}
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-foreground-muted font-mono">
                        {formatDuration(log.durationMs)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground-muted max-w-[200px] truncate">
                        {log.promptPreview || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 mx-auto text-foreground-muted/40 mb-3" />
              <p className="text-sm text-foreground-muted">Немає логів</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > data.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground-muted">
            {data.total} записів, сторінка {data.page} з {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
