'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Input, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  reminderAt: string | null;
  assigneeId: string | null;
  contactId: string | null;
  dealId: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
}

interface Comment {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
}

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' }> = {
  urgent: { label: 'Терміново', variant: 'default' },
  high: { label: 'Високий', variant: 'default' },
  medium: { label: 'Середній', variant: 'secondary' },
  low: { label: 'Низький', variant: 'outline' },
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' }> = {
  todo: { label: 'До виконання', variant: 'secondary' },
  in_progress: { label: 'В роботі', variant: 'default' },
  done: { label: 'Готово', variant: 'success' },
  cancelled: { label: 'Скасовано', variant: 'outline' },
};

const typeIcons: Record<string, string> = {
  task: '📋', call: '📞', email: '✉️', meeting: '🤝', follow_up: '🔄',
};

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  useEffect(() => { fetchTask(); }, [taskId]);

  const fetchTask = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      setTask(data.task);
    } catch {} finally { setLoading(false); }
  };

  const handleStatusChange = async (status: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchTask();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommentLoading(true);
    try {
      await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      });
      setComment('');
      fetchTask();
    } catch {} finally { setCommentLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Видалити задачу?')) return;
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    router.push('/dashboard/tasks');
  };

  if (loading) return <div className="max-w-4xl mx-auto"><div className="h-8 bg-muted rounded w-1/3 animate-pulse" /></div>;
  if (!task) return <div className="max-w-4xl mx-auto text-center py-12"><p>Задачу не знайдено</p></div>;

  const isOverdue = task.dueDate && task.status !== 'done' && task.status !== 'cancelled' && new Date(task.dueDate) < new Date();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{typeIcons[task.type] || '📋'}</span>
          <div>
            <h1 className="text-2xl font-bold">{task.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={priorityConfig[task.priority]?.variant}>{priorityConfig[task.priority]?.label}</Badge>
              <Badge variant={statusConfig[task.status]?.variant}>{statusConfig[task.status]?.label}</Badge>
              {task.isRecurring && <Badge variant="outline">🔄 Повторювана</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/tasks/${taskId}/edit`}><Button variant="outline">Редагувати</Button></Link>
          <Button variant="outline" onClick={() => router.back()}>Назад</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <Card>
            <CardHeader><CardTitle>Деталі</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {task.description && (
                <div><p className="text-sm text-foreground-muted mb-1">Опис</p><p className="text-sm whitespace-pre-wrap">{task.description}</p></div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-foreground-muted">Тип</p><p className="font-medium">{task.type}</p></div>
                <div><p className="text-sm text-foreground-muted">Дедлайн</p><p className={cn('font-medium', isOverdue && 'text-danger')}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('uk', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p></div>
                <div><p className="text-sm text-foreground-muted">Нагадування</p><p className="font-medium">{task.reminderAt ? new Date(task.reminderAt).toLocaleString('uk') : '—'}</p></div>
                <div><p className="text-sm text-foreground-muted">Створено</p><p className="font-medium">{new Date(task.createdAt).toLocaleDateString('uk')}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader><CardTitle>Коментарі ({task.comments.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddComment} className="flex gap-2">
                <Input placeholder="Додати коментар..." value={comment} onChange={(e) => setComment(e.target.value)} className="flex-1" />
                <Button type="submit" disabled={commentLoading || !comment.trim()}>
                  {commentLoading ? '...' : 'Додати'}
                </Button>
              </form>
              {task.comments.length === 0 ? (
                <p className="text-sm text-foreground-muted text-center py-4">Немає коментарів</p>
              ) : (
                <div className="space-y-3">
                  {task.comments.map((c) => (
                    <div key={c.id} className="p-3 bg-secondary/30 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                      <p className="text-xs text-foreground-muted mt-2">
                        {new Date(c.createdAt).toLocaleDateString('uk', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm font-medium text-foreground-muted">Змінити статус</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <Button key={key} variant={task.status === key ? (cfg.variant === 'success' ? 'outline' : cfg.variant) : 'outline'} size="sm"
                    onClick={() => handleStatusChange(key)} disabled={task.status === key}>
                    {cfg.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <Button variant="destructive" className="w-full" onClick={handleDelete}>Видалити задачу</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
