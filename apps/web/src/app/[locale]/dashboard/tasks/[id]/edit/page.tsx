'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { TaskForm } from '@/components/tasks/task-form';
import { Button } from '@/components/ui';

interface TaskData {
  title: string; description: string; type: string; status: string; priority: string;
  dueDate: string; reminderAt: string; assigneeId: string; contactId: string; dealId: string;
  isRecurring: boolean; recurrenceRule: string;
}

export default function EditTaskPage() {
  const params = useParams();
  const taskId = params.id as string;
  const [data, setData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}`).then((r) => r.json()).then((d) => {
      const t = d.task;
      setData({
        title: t.title || '', description: t.description || '', type: t.type || 'task',
        status: t.status || 'todo', priority: t.priority || 'medium',
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 16) : '',
        reminderAt: t.reminderAt ? new Date(t.reminderAt).toISOString().slice(0, 16) : '',
        assigneeId: t.assigneeId || '', contactId: t.contactId || '', dealId: t.dealId || '',
        isRecurring: t.isRecurring || false, recurrenceRule: t.recurrenceRule || '',
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [taskId]);

  if (loading) return <div className="max-w-2xl mx-auto"><div className="h-8 bg-muted rounded w-1/3 animate-pulse" /></div>;
  if (!data) return <div className="max-w-2xl mx-auto text-center py-12"><p>Задачу не знайдено</p><Button onClick={() => window.history.back()}>Назад</Button></div>;
  return <TaskForm taskId={taskId} initialData={data} />;
}
