'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Skeleton } from '@/components/ui';

interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: { name: string | null; email: string | null } | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Створено',
  update: 'Оновлено',
  delete: 'Видалено',
  login: 'Вхід',
  logout: 'Вихід',
  invite: 'Запрошення',
  role_change: 'Зміна ролі',
  export: 'Експорт',
  import: 'Імпорт',
};

const ENTITY_LABELS: Record<string, string> = {
  contact: 'Контакт',
  deal: 'Угода',
  task: 'Задача',
  member: 'Учасник',
  settings: 'Налаштування',
  auth: 'Авторизація',
  pipeline: 'Воронка',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/10 text-green-700 dark:text-green-300',
  update: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  delete: 'bg-red-500/10 text-red-700 dark:text-red-300',
  login: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  logout: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  invite: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  role_change: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  export: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  import: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity', entityFilter);

      const res = await fetch(`/api/audit?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">← Назад</Link>
        <h1 className="text-2xl font-bold">Журнал аудиту</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-foreground-muted" />
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                <option value="">Всі дії</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={entityFilter}
                onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                <option value="">Всі сутності</option>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <span className="text-sm text-foreground-muted ml-auto">
              {total} записів
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-foreground-muted">
              Журнал порожній
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Дата</th>
                    <th className="text-left px-4 py-3 font-medium">Користувач</th>
                    <th className="text-left px-4 py-3 font-medium">Дія</th>
                    <th className="text-left px-4 py-3 font-medium">Сутність</th>
                    <th className="text-left px-4 py-3 font-medium">ID</th>
                    <th className="text-left px-4 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground-muted whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {log.user?.name || log.user?.email || <span className="text-foreground-muted">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={`${ACTION_COLORS[log.action] || ''} text-xs`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {ENTITY_LABELS[log.entity] || log.entity}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground-muted max-w-[120px] truncate">
                        {log.entityId || '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground-muted text-xs">
                        {log.ipAddress || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-foreground-muted">
            Сторінка {page} з {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
