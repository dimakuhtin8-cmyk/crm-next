'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Input, Badge, Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  contactId: string | null;
  dealId: string | null;
  isRecurring: boolean;
  createdAt: string;
}

const priorityConfig: Record<string, { label: string; color: string; order: number }> = {
  urgent: { label: 'Терміново', color: 'text-danger', order: 0 },
  high: { label: 'Високий', color: 'text-warning', order: 1 },
  medium: { label: 'Середній', color: 'text-info', order: 2 },
  low: { label: 'Низький', color: 'text-foreground-muted', order: 3 },
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success'; color: string }> = {
  todo: { label: 'До виконання', variant: 'secondary', color: 'border-t-foreground-muted' },
  in_progress: { label: 'В роботі', variant: 'default', color: 'border-t-primary' },
  done: { label: 'Готово', variant: 'success', color: 'border-t-success' },
  cancelled: { label: 'Скасовано', variant: 'outline', color: 'border-t-foreground-muted' },
};

const typeIcons: Record<string, string> = {
  task: '📋', call: '📞', email: '✉️', meeting: '🤝', follow_up: '🔄',
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<'list' | 'kanban'>('list');

  useEffect(() => { fetchTasks(); }, [page, filterStatus, filterPriority]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      params.set('page', String(page));
      params.set('limit', '100');
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchTasks(); };

  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done';
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchTasks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Видалити задачу?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  const isOverdue = (t: Task) => t.dueDate && t.status !== 'done' && t.status !== 'cancelled' && new Date(t.dueDate) < new Date();

  // Kanban: group tasks by status
  const kanbanColumns = Object.entries(statusConfig).map(([key, cfg]) => ({
    key,
    ...cfg,
    tasks: tasks.filter((t) => t.status === key),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Задачі</h1>
          <p className="text-foreground-muted">{total} задач</p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={cn('px-3 py-1.5 text-sm transition-colors', view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary')}
            >
              Список
            </button>
            <button
              onClick={() => setView('kanban')}
              className={cn('px-3 py-1.5 text-sm transition-colors', view === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary')}
            >
              Канбан
            </button>
          </div>
          <Link href="/dashboard/tasks/new">
            <Button>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Нова задача
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Input placeholder="Пошук задач..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <Button type="submit" variant="secondary">Знайти</Button>
            <Button type="button" variant="outline" onClick={() => setShowFilters(!showFilters)} className={cn(showFilters && 'bg-primary-light')}>
              Фільтри
            </Button>
          </form>
          {showFilters && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-border">
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Всі статуси</option>
                <option value="todo">До виконання</option>
                <option value="in_progress">В роботі</option>
                <option value="done">Готово</option>
                <option value="cancelled">Скасовано</option>
              </select>
              <select value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Всі пріоритети</option>
                <option value="urgent">Терміново</option>
                <option value="high">Високий</option>
                <option value="medium">Середній</option>
                <option value="low">Низький</option>
              </select>
              {(filterStatus || filterPriority) && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterStatus(''); setFilterPriority(''); setPage(1); }}>Скинути</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LIST VIEW */}
      {view === 'list' && (
        loading ? (
          <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : tasks.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <p className="text-foreground-muted mb-4">Задач не знайдено</p>
            <Link href="/dashboard/tasks/new"><Button>Створити задачу</Button></Link>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className={cn(
                'flex items-center gap-4 p-4 bg-card rounded-lg border border-border hover:bg-secondary/50 transition-colors',
                isOverdue(task) && 'border-l-2 border-l-danger',
              )}>
                <button onClick={() => toggleStatus(task)} className={cn(
                  'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                  task.status === 'done' ? 'bg-success border-success' : 'border-border hover:border-primary',
                )}>
                  {task.status === 'done' && <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{typeIcons[task.type] || '📋'}</span>
                    <p className={cn('font-medium text-sm', task.status === 'done' && 'line-through text-foreground-muted')}>{task.title}</p>
                    {task.isRecurring && <span className="text-xs">🔄</span>}
                  </div>
                  {task.dueDate && (
                    <span className={cn('text-xs', isOverdue(task) ? 'text-danger font-medium' : 'text-foreground-muted')}>
                      {new Date(task.dueDate).toLocaleDateString('uk')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-xs font-medium', priorityConfig[task.priority]?.color)}>
                    {priorityConfig[task.priority]?.label}
                  </span>
                  <Badge variant={statusConfig[task.status]?.variant || 'outline'} className="text-xs">
                    {statusConfig[task.status]?.label}
                  </Badge>
                  <button onClick={() => handleDelete(task.id)} className="rounded p-1 text-foreground-muted hover:text-danger transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* KANBAN VIEW */}
      {view === 'kanban' && (
        loading ? (
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="flex-1 h-96 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {kanbanColumns.map((col) => (
              <div key={col.key} className={cn('flex-shrink-0 w-72 flex flex-col rounded-xl border border-border bg-secondary/30')}>
                <div className={cn('flex items-center justify-between p-3 border-b border-border border-t-2', col.color)}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{col.label}</h3>
                    <Badge variant="secondary" className="text-xs">{col.tasks.length}</Badge>
                  </div>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
                  {col.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                      className={cn(
                        'p-3 bg-card rounded-lg border border-border cursor-pointer hover:shadow-md transition-all',
                        isOverdue(task) && 'border-l-2 border-l-danger',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs">{typeIcons[task.type] || '📋'}</span>
                        <span className={cn('text-xs font-medium', priorityConfig[task.priority]?.color)}>
                          {priorityConfig[task.priority]?.label}
                        </span>
                      </div>
                      <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                      {task.dueDate && (
                        <p className={cn('text-xs mt-2', isOverdue(task) ? 'text-danger' : 'text-foreground-muted')}>
                          {new Date(task.dueDate).toLocaleDateString('uk')}
                        </p>
                      )}
                    </div>
                  ))}
                  {col.tasks.length === 0 && (
                    <p className="text-xs text-foreground-muted text-center py-4">Немає задач</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Pagination (list only) */}
      {view === 'list' && total > 100 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button>
          <span className="text-sm text-foreground-muted">Сторінка {page} з {Math.ceil(total / 100)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 100)} onClick={() => setPage(page + 1)}>Далі</Button>
        </div>
      )}
    </div>
  );
}
