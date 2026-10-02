/**
 * Logs — системні логи застосунку
 *
 * Показує:
 * - Помилки API
 * - Події безпеки
 * - Повільні запити
 * - Загальну статистику
 */

'use client';

import {
  Activity,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Trash2,
  Download,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Table,
} from '@/components/ui';

type LogEntry = {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
};

interface LogStats {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

// In-memory log store (same as logger)
const logStore: LogEntry[] = [];
let logId = 0;

export function addLog(
  level: LogEntry['level'],
  message: string,
  context?: Record<string, unknown>,
) {
  logStore.unshift({
    id: String(++logId),
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  });
  // Keep last 1000 logs
  if (logStore.length > 1000) logStore.length = 1000;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats>({ total: 0, errors: 0, warnings: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      // Simulate logs from various sources
      const now = new Date();
      const mockLogs: LogEntry[] = [
        {
          id: '1',
          level: 'info',
          message: 'Система запущена',
          timestamp: new Date(now.getTime() - 3600000).toISOString(),
        },
        {
          id: '2',
          level: 'info',
          message: 'Кеш ініціалізовано',
          context: { entries: 0, maxSize: 10000 },
          timestamp: new Date(now.getTime() - 3500000).toISOString(),
        },
        {
          id: '3',
          level: 'warn',
          message: 'Повільний запит до бази даних',
          context: { query: 'SELECT * FROM contacts', duration: '2.3s' },
          timestamp: new Date(now.getTime() - 1800000).toISOString(),
        },
        {
          id: '4',
          level: 'info',
          message: 'Користувач увійшов в систему',
          context: { email: 'admin@example.com' },
          timestamp: new Date(now.getTime() - 900000).toISOString(),
        },
        {
          id: '5',
          level: 'error',
          message: 'Не вдалося надіслати email',
          context: { to: 'user@example.com', error: 'SMTP connection timeout' },
          timestamp: new Date(now.getTime() - 600000).toISOString(),
        },
        {
          id: '6',
          level: 'info',
          message: 'Створено нову задачу',
          context: { title: 'Зателефонувати клієнту', userId: 'user_123' },
          timestamp: new Date(now.getTime() - 300000).toISOString(),
        },
        {
          id: '7',
          level: 'warn',
          message: 'Rate limit наближається',
          context: { ip: '192.168.1.1', requests: 85, limit: 100 },
          timestamp: new Date(now.getTime() - 120000).toISOString(),
        },
        {
          id: '8',
          level: 'info',
          message: 'AI запит виконано',
          context: { action: 'analyze', duration: '1.2s' },
          timestamp: new Date(now.getTime() - 60000).toISOString(),
        },
        // Add any logs from in-memory store
        ...logStore,
      ];

      setLogs(mockLogs);

      setStats({
        total: mockLogs.length,
        errors: mockLogs.filter((l) => l.level === 'error').length,
        warnings: mockLogs.filter((l) => l.level === 'warn').length,
        info: mockLogs.filter((l) => l.level === 'info').length,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const levelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return (
          <Badge variant="danger" className="font-mono">
            ERROR
          </Badge>
        );
      case 'warn':
        return (
          <Badge variant="warning" className="font-mono">
            WARN
          </Badge>
        );
      default:
        return (
          <Badge variant="info" className="font-mono">
            INFO
          </Badge>
        );
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleClear = () => {
    logStore.length = 0;
    fetchLogs();
  };

  const handleExport = () => {
    const text = filteredLogs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${
            log.context ? ' | ' + JSON.stringify(log.context) : ''
          }`,
      )
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const logColumns = [
    {
      key: 'timestamp',
      header: 'Час',
      className: 'p-2 w-[95px]',
      render: (log: LogEntry) => (
        <span className="font-mono text-xs text-foreground-muted">{formatTime(log.timestamp)}</span>
      ),
    },
    {
      key: 'level',
      header: 'Рівень',
      className: 'p-2 w-[95px]',
      render: (log: LogEntry) => levelBadge(log.level),
    },
    {
      key: 'message',
      header: 'Повідомлення',
      className: 'p-2',
      render: (log: LogEntry) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-foreground" title={log.message}>
            {log.message}
          </p>
          {log.context && (
            <pre className="mt-1 max-h-12 overflow-auto whitespace-pre-wrap break-all rounded bg-secondary/50 p-1.5 font-mono text-[11px] text-foreground-muted">
              {JSON.stringify(log.context, null, 2)}
            </pre>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Системні логи</h1>
          <p className="text-foreground-muted text-sm mt-1">Моніторинг подій та помилок системи</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Експорт
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4" />
            Очистити
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4" />
            Оновити
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-info/10">
                <Activity className="h-5 w-5 text-info" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground-muted">Всього</p>
                <p className="font-mono text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground-muted">Інфо</p>
                <p className="font-mono text-2xl font-bold">{stats.info}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground-muted">Попередження</p>
                <p className="font-mono text-2xl font-bold">{stats.warnings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-danger/10">
                <AlertCircle className="h-5 w-5 text-danger" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground-muted">Помилки</p>
                <p className="font-mono text-2xl font-bold">{stats.errors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              placeholder="Пошук у логах..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full min-w-[200px] flex-1 text-xs"
            />
            <Select
              value={levelFilter}
              onValueChange={setLevelFilter}
              aria-label="Фільтр за рівнем"
              className="h-8 w-48 text-xs"
            >
              <option value="all">Всі рівні</option>
              <option value="error">Помилки (ERROR)</option>
              <option value="warn">Попередження (WARN)</option>
              <option value="info">Інфо (INFO)</option>
            </Select>
            <span className="font-mono text-xs text-foreground-muted">
              Знайдено: {filteredLogs.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <EmptyState
              icon={<Activity className="h-12 w-12" />}
              title="Немає логів"
              description="Змініть фільтри або зачекайте на нові події"
            />
          </CardContent>
        </Card>
      ) : (
        <Table columns={logColumns} data={filteredLogs} pageSize={50} />
      )}
    </div>
  );
}
