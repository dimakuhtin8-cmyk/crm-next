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

import { useState, useEffect } from 'react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { 
  Activity, 
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Trash2,
  Filter,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

interface LogStats {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

// In-memory log store (same as logger)
const logStore: LogEntry[] = [];
let logId = 0;

export function addLog(level: LogEntry['level'], message: string, context?: Record<string, unknown>) {
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
        errors: mockLogs.filter(l => l.level === 'error').length,
        warnings: mockLogs.filter(l => l.level === 'warn').length,
        info: mockLogs.filter(l => l.level === 'info').length,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="h-4 w-4 text-danger" />;
      case 'warn': return <AlertTriangle className="h-4 w-4 text-warning" />;
      default: return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error': return <Badge variant="danger">Помилка</Badge>;
      case 'warn': return <Badge variant="warning">Попередження</Badge>;
      default: return <Badge variant="success">Інфо</Badge>;
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
    const text = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${
        log.context ? ' | ' + JSON.stringify(log.context) : ''
      }`
    ).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Системні логи</h1>
          <p className="text-foreground-muted text-sm mt-1">
            Моніторинг подій та помилок системи
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Експорт
          </Button>
          <Button variant="outline" onClick={handleClear}>
            <Trash2 className="h-4 w-4 mr-2" />
            Очистити
          </Button>
          <Button variant="outline" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Оновити
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-info/10">
                <Activity className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Всього</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Інфо</p>
                <p className="text-lg font-bold">{stats.info}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Попередження</p>
                <p className="text-lg font-bold">{stats.warnings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-danger/10">
                <AlertCircle className="h-5 w-5 text-danger" />
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Помилки</p>
                <p className="text-lg font-bold">{stats.errors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Пошук у логах..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="all">Всі рівні</option>
              <option value="error">Помилки</option>
              <option value="warn">Попередження</option>
              <option value="info">Інфо</option>
            </select>
            <span className="text-sm text-foreground-muted">
              Знайдено: {filteredLogs.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Activity className="h-12 w-12 text-foreground-muted mx-auto mb-4" />
            <p className="text-foreground-muted">Немає логів</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getLevelBadge(log.level)}
                      <span className="text-xs text-foreground-muted">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.context && (
                      <pre className="mt-2 text-xs text-foreground-muted bg-secondary/50 rounded-lg p-2 overflow-x-auto">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
