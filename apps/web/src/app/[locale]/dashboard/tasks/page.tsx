'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { QuickCreatePopover, QuickTaskForm, QuickSelect } from '@/components/quick-create';
import { useTourAutoStart } from '@/components/tour/tour-provider';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  EmptyState,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { filterTasksByTab, isTaskOverdue, isTaskToday, type TaskTab } from '@/lib/task-tabs';
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

/** Виконавець зі списку команди поточного тенанта. */
interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

const priorityConfig: Record<string, { label: string; color: string; order: number }> = {
  urgent: { label: 'Терміново', color: 'text-danger', order: 0 },
  high: { label: 'Високий', color: 'text-warning', order: 1 },
  medium: { label: 'Середній', color: 'text-info', order: 2 },
  low: { label: 'Низький', color: 'text-foreground-muted', order: 3 },
};

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'success'; color: string }
> = {
  todo: { label: 'До виконання', variant: 'secondary', color: 'border-t-foreground-muted' },
  in_progress: { label: 'В роботі', variant: 'default', color: 'border-t-primary' },
  done: { label: 'Готово', variant: 'success', color: 'border-t-success' },
  cancelled: { label: 'Скасовано', variant: 'outline', color: 'border-t-foreground-muted' },
};

const typeIcons: Record<string, string> = {
  task: '📋',
  call: '📞',
  email: '✉️',
  meeting: '🤝',
  follow_up: '🔄',
};

/** Варіант бейджа пріоритету для рядка списку. */
const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'secondary'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [tab, setTab] = useState<TaskTab>('all');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);

  // Швидке створення задачі
  const [quickOpen, setQuickOpen] = useState(false);
  const quickBtnRef = useRef<HTMLButtonElement>(null);

  useTourAutoStart('tasks');

  const handleQuickCreated = () => {
    setQuickOpen(false);
    setPage(1);
    fetchTasks();
  };

  useEffect(() => {
    fetchTasks();
  }, [page, filterPriority]);

  // Виконавці для аватарів: тихий запит, без впливу на роботу сторінки
  useEffect(() => {
    fetch('/api/team')
      .then((res) => res.json())
      .then((data: { members?: TeamMember[] }) => setMembers(data.members || []))
      .catch(() => {
        // команда недоступна: аватарів не буде, список працює як раніше
      });
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterPriority) params.set('priority', filterPriority);
      params.set('page', String(page));
      params.set('limit', '100');
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setTotal(data.total || 0);
    } catch {
      // список просто лишиться порожнім
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTasks();
  };

  const toggleStatus = async (task: Task) => {
    const nextStatus =
      task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done';
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

  // Виконавець задачі зі стану команди
  const assigneeOf = (t: Task): TeamMember | null => {
    if (!t.assigneeId) return null;
    return members.find((m) => m.id === t.assigneeId) ?? null;
  };

  // Drag-and-drop обробники канбану
  const handleDragStart = (task: Task) => setDraggedTask(task);
  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverStatus(null);
  };
  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverStatus(status);
  };
  const handleDragLeave = () => setDragOverStatus(null);

  const handleDrop = async (newStatus: string) => {
    if (!draggedTask || draggedTask.status === newStatus) {
      handleDragEnd();
      return;
    }
    // Оптимістичне оновлення
    setTasks((prev) =>
      prev.map((t) => (t.id === draggedTask.id ? { ...t, status: newStatus } : t)),
    );
    try {
      await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      fetchTasks();
    }
    handleDragEnd();
  };

  // Що бачить користувач: фільтр активного таба поверх завантаженого списку
  const visibleTasks = filterTasksByTab(tasks, tab);

  // Допоміжні функції календаря
  const getCalendarDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const days: Array<{ date: Date; tasks: Task[]; isCurrentMonth: boolean }> = [];

    // Попередній місяць (доповнення згори)
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        tasks: visibleTasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), date)),
        isCurrentMonth: false,
      });
    }

    // Поточний місяць
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        tasks: visibleTasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), date)),
        isCurrentMonth: true,
      });
    }

    // Наступний місяць (доповнення знизу)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({
        date,
        tasks: visibleTasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), date)),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // Канбан: групування видимих задач за статусом
  const kanbanColumns = Object.entries(statusConfig).map(([key, cfg]) => ({
    key,
    ...cfg,
    tasks: visibleTasks.filter((t) => t.status === key),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Задачі</h1>
          <p className="text-foreground-muted">{total} задач</p>
        </div>
        <div className="flex gap-2">
          {/* Перемикач вигляду: список / канбан / календар */}
          <div className="flex h-8 items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button
              onClick={() => setView('list')}
              className={cn(
                'h-7 rounded-md px-3 text-xs font-medium transition-colors',
                view === 'list'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-foreground-muted hover:bg-secondary/50',
              )}
            >
              Список
            </button>
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'h-7 rounded-md px-3 text-xs font-medium transition-colors',
                view === 'kanban'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-foreground-muted hover:bg-secondary/50',
              )}
            >
              Канбан
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'h-7 rounded-md px-3 text-xs font-medium transition-colors',
                view === 'calendar'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-foreground-muted hover:bg-secondary/50',
              )}
            >
              Календар
            </button>
          </div>
          <Button ref={quickBtnRef} onClick={() => setQuickOpen(true)} data-tour="task-add">
            <svg
              className="h-4 w-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Нова задача
          </Button>
          <QuickCreatePopover
            anchorEl={quickBtnRef.current}
            open={quickOpen}
            onClose={() => setQuickOpen(false)}
            title="Нова задача"
          >
            <QuickTaskForm onCreated={handleQuickCreated} />
          </QuickCreatePopover>
        </div>
      </div>

      {/* Таби: коли дивитися задачі */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TaskTab)} className="w-full">
        <TabsList data-tour="task-views">
          <TabsTrigger value="all">Усі</TabsTrigger>
          <TabsTrigger value="today">Сьогодні</TabsTrigger>
          <TabsTrigger value="overdue">Прострочені</TabsTrigger>
          <TabsTrigger value="completed">Завершені</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Пошук + фільтри */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Пошук задач..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <Button type="submit" variant="secondary">
              Знайти
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-primary-light')}
            >
              Фільтри
            </Button>
          </form>
          {showFilters && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-border">
              <div className="w-44">
                <QuickSelect
                  value={filterPriority}
                  onChange={(v) => {
                    setFilterPriority(v);
                    setPage(1);
                  }}
                  options={[
                    { id: '', name: 'Всі пріоритети' },
                    { id: 'urgent', name: 'Терміново' },
                    { id: 'high', name: 'Високий' },
                    { id: 'medium', name: 'Середній' },
                    { id: 'low', name: 'Низький' },
                  ]}
                  placeholder="Всі пріоритети"
                />
              </div>
              {filterPriority && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterPriority('');
                    setPage(1);
                  }}
                >
                  Скинути
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ВИГЛЯД «СПИСОК» */}
      {view === 'list' &&
        (loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                title="Задач не знайдено"
                description="Створіть першу задачу, щоб нічого не забути"
                action={<Button onClick={() => setQuickOpen(true)}>Створити задачу</Button>}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {visibleTasks.map((task) => {
              const assignee = assigneeOf(task);
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/50',
                    isTaskOverdue(task) && 'border-l-2 border-l-danger',
                  )}
                >
                  <Checkbox
                    checked={task.status === 'done'}
                    onCheckedChange={() => toggleStatus(task)}
                    aria-label="Позначити виконаною"
                    className="shrink-0"
                  />
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                  >
                    <p
                      className={cn(
                        'truncate text-sm font-medium',
                        task.status === 'done' && 'line-through text-foreground-muted',
                      )}
                    >
                      {task.title}
                    </p>
                  </div>
                  {task.dueDate && (
                    <Badge
                      variant={
                        isTaskOverdue(task) ? 'danger' : isTaskToday(task) ? 'warning' : 'outline'
                      }
                      className="shrink-0 whitespace-nowrap text-xs"
                    >
                      {new Date(task.dueDate).toLocaleDateString('uk', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Badge>
                  )}
                  <Badge
                    variant={priorityVariant[task.priority] ?? 'secondary'}
                    className="hidden shrink-0 sm:inline-flex"
                  >
                    {priorityConfig[task.priority]?.label}
                  </Badge>
                  {assignee && (
                    <Avatar
                      name={assignee.name || assignee.email || '?'}
                      src={assignee.image || undefined}
                      size="sm"
                      className="h-6 w-6 shrink-0 text-2xs"
                    />
                  )}
                  {task.assigneeId && !assignee && (
                    <Avatar name="?" size="sm" className="h-6 w-6 shrink-0 text-2xs" />
                  )}
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="shrink-0 rounded-md p-1.5 text-foreground-muted transition-colors hover:bg-danger-light hover:text-danger"
                    aria-label="Видалити задачу"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}

      {/* ВИГЛЯД «КАНБАН» */}
      {view === 'kanban' &&
        (loading ? (
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 h-96 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {kanbanColumns.map((col) => (
              <div
                key={col.key}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(col.key)}
                className={cn(
                  'flex-shrink-0 w-72 flex flex-col rounded-xl border border-border bg-secondary/30 transition-colors',
                  dragOverStatus === col.key &&
                    'border-primary bg-primary/5 ring-2 ring-primary/20',
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-between p-3 border-b border-border border-t-2',
                    col.color,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{col.label}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {col.tasks.length}
                    </Badge>
                  </div>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
                  {col.tasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      onDragEnd={handleDragEnd}
                      onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                      className={cn(
                        'p-3 bg-card rounded-lg border border-border cursor-pointer hover:shadow-md transition-all',
                        isTaskOverdue(task) && 'border-l-2 border-l-danger',
                        draggedTask?.id === task.id && 'opacity-50 scale-95',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs">{typeIcons[task.type] || '📋'}</span>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            priorityConfig[task.priority]?.color,
                          )}
                        >
                          {priorityConfig[task.priority]?.label}
                        </span>
                      </div>
                      <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                      {task.dueDate && (
                        <p
                          className={cn(
                            'text-xs mt-2',
                            isTaskOverdue(task) ? 'text-danger' : 'text-foreground-muted',
                          )}
                        >
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
        ))}

      {/* ВИГЛЯД «КАЛЕНДАР» */}
      {view === 'calendar' &&
        (loading ? (
          <div className="h-96 bg-muted rounded-lg animate-pulse" />
        ) : (
          <Card>
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">
                {new Date().toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            <div className="grid grid-cols-7 gap-px bg-border">
              {['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((day) => (
                <div
                  key={day}
                  className="bg-background p-2 text-center text-xs font-medium text-foreground-muted"
                >
                  {day}
                </div>
              ))}
              {getCalendarDays().map((day, i) => {
                const isToday = isSameDay(day.date, new Date());
                return (
                  <div
                    key={i}
                    className={cn(
                      'bg-background p-2 min-h-[80px]',
                      !day.isCurrentMonth && 'text-foreground-muted/50',
                    )}
                  >
                    <div
                      className={cn(
                        'text-sm font-medium mb-1',
                        isToday &&
                          'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center',
                      )}
                    >
                      {day.date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {day.tasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                          className={cn(
                            'text-xs p-1 rounded truncate cursor-pointer hover:bg-secondary/50',
                            task.status === 'done'
                              ? 'line-through text-foreground-muted'
                              : 'bg-primary/10',
                            isTaskOverdue(task) && 'bg-danger/10 text-danger',
                          )}
                        >
                          {task.title}
                        </div>
                      ))}
                      {day.tasks.length > 3 && (
                        <p className="text-xs text-foreground-muted">+{day.tasks.length - 3}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}

      {/* Пагінація (лише список) */}
      {view === 'list' && total > 100 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <span className="text-sm text-foreground-muted">
            Сторінка {page} з {Math.ceil(total / 100)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / 100)}
            onClick={() => setPage(page + 1)}
          >
            Далі
          </Button>
        </div>
      )}
    </div>
  );
}
