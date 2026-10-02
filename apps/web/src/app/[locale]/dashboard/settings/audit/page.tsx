'use client';

import { RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

import { QuickSelect } from '@/components/quick-create';
import { Button, Card, CardContent, Badge, Skeleton, Table } from '@/components/ui';

type AuditLogEntry = {
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
};

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

const ACTION_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  login: 'default',
  logout: 'secondary',
  invite: 'warning',
  role_change: 'warning',
  export: 'info',
  import: 'info',
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

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">Журнал аудиту</h1>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-foreground-muted" />
              <div className="w-44">
                <QuickSelect
                  value={actionFilter}
                  onChange={(v) => {
                    setActionFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { id: '', name: 'Всі дії' },
                    ...Object.entries(ACTION_LABELS).map(([k, v]) => ({ id: k, name: v })),
                  ]}
                  placeholder="Всі дії"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-44">
                <QuickSelect
                  value={entityFilter}
                  onChange={(v) => {
                    setEntityFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { id: '', name: 'Всі сутності' },
                    ...Object.entries(ENTITY_LABELS).map(([k, v]) => ({ id: k, name: v })),
                  ]}
                  placeholder="Всі сутності"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <span className="text-sm text-foreground-muted ml-auto">{total} записів</span>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Table<AuditLogEntry>
          data={logs}
          columns={[
            {
              key: 'createdAt',
              header: 'Дата',
              className: 'px-3 py-2',
              render: (row) => (
                <span className="whitespace-nowrap text-foreground-muted text-xs">
                  {formatDate(row.createdAt)}
                </span>
              ),
            },
            {
              key: 'user',
              header: 'Користувач',
              className: 'px-3 py-2',
              render: (row) =>
                row.user?.name ||
                row.user?.email || <span className="text-foreground-muted">—</span>,
            },
            {
              key: 'action',
              header: 'Дія',
              className: 'px-3 py-2',
              render: (row) => (
                <Badge variant={ACTION_VARIANTS[row.action] ?? 'secondary'} className="text-xs">
                  {ACTION_LABELS[row.action] || row.action}
                </Badge>
              ),
            },
            {
              key: 'entity',
              header: 'Сутність',
              className: 'px-3 py-2',
              render: (row) => ENTITY_LABELS[row.entity] || row.entity,
            },
            {
              key: 'entityId',
              header: 'ID',
              className: 'px-3 py-2',
              render: (row) => (
                <span className="block max-w-[120px] truncate font-mono text-xs text-foreground-muted">
                  {row.entityId || '—'}
                </span>
              ),
            },
            {
              key: 'ipAddress',
              header: 'IP',
              className: 'px-3 py-2',
              render: (row) => (
                <span className="font-mono text-xs text-foreground-muted">
                  {row.ipAddress || '—'}
                </span>
              ),
            },
          ]}
          emptyMessage="Журнал порожній"
          pageSize={limit}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
