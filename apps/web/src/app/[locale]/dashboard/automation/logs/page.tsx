/**
 * Automation Logs — история выполнения автоматизаций
 * 
 * Показывает:
 * - Все выполненные действия
 * - Фильтр по правилам, сделкам, результату
 * - Очистка старых логов
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Button, Badge, Select } from '@/components/ui';
import { 
  Activity, 
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutomationLog {
  id: string;
  ruleId: string | null;
  ruleName: string;
  dealId: string | null;
  triggerType: string;
  actionType: string;
  result: string;
  details: string | null;
  executedAt: string;
}

export default function AutomationLogsPage() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchLogs();
  }, [resultFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (resultFilter !== 'all') params.set('result', resultFilter);
      
      const res = await fetch(`/api/automation/logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data.logs);
        setTotal(data.data.total);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('Видалити логи старіші за 30 днів?')) return;
    
    try {
      await fetch('/api/automation/logs?olderThan=30', { method: 'DELETE' });
      fetchLogs();
    } catch {}
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-danger" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-warning" />;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'success':
        return <Badge variant="success">Успіх</Badge>;
      case 'error':
        return <Badge variant="danger">Помилка</Badge>;
      default:
        return <Badge variant="warning">Невідомо</Badge>;
    }
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'stage_change':
        return 'Зміна стадії';
      case 'deal_created':
        return 'Створення угоди';
      case 'deal_won':
        return 'Виграш угоди';
      case 'deal_lost':
        return 'Програш угоди';
      case 'deal_created_timer':
        return 'Таймер створення';
      case 'manual':
        return 'Ручне виконання';
      default:
        return trigger;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'send_notification':
        return 'Надіслати сповіщення';
      case 'create_task':
        return 'Створити задачу';
      case 'set_field':
        return 'Встановити поле';
      case 'move_deal':
        return 'Перемістити угоду';
      default:
        return action;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Логи автоматизації</h1>
          <p className="text-foreground-muted text-sm mt-1">
            Історія виконання автоматичних правил
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Оновити
          </Button>
          <Button variant="outline" onClick={handleCleanup}>
            <Trash2 className="h-4 w-4 mr-2" />
            Очистити старі
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-foreground-muted" />
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <option value="all">Всі результати</option>
              <option value="success">Успішні</option>
              <option value="error">Помилки</option>
            </Select>
            <div className="text-sm text-foreground-muted">
              Знайдено: {total}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Activity className="h-12 w-12 text-foreground-muted mx-auto mb-4" />
            <p className="text-foreground-muted">Немає логів виконання</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getResultIcon(log.result)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold">{log.ruleName}</span>
                      {getResultBadge(log.result)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-foreground-muted">
                      <span>{getTriggerLabel(log.triggerType)}</span>
                      <span>→</span>
                      <span>{getActionLabel(log.actionType)}</span>
                    </div>
                    
                    {log.details && (
                      <p className="text-sm text-foreground-muted mt-1 truncate">
                        {log.details}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right text-sm text-foreground-muted">
                    {formatDate(log.executedAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More */}
      {logs.length < total && (
        <div className="text-center">
          <Button variant="outline" onClick={() => {
            setLimit(prev => prev + 50);
            fetchLogs();
          }}>
            Завантажити ще
          </Button>
        </div>
      )}
    </div>
  );
}
