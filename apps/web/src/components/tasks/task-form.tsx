'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface TaskFormProps {
  taskId?: string;
  initialData?: {
    title: string; description: string; type: string; status: string; priority: string;
    dueDate: string; reminderAt: string; assigneeId: string; contactId: string; dealId: string;
    isRecurring: boolean; recurrenceRule: string;
  };
}

export function TaskForm({ taskId, initialData }: TaskFormProps) {
  const router = useRouter();
  const isEdit = !!taskId;
  const [form, setForm] = useState(initialData || {
    title: '', description: '', type: 'task', status: 'todo', priority: 'medium',
    dueDate: '', reminderAt: '', assigneeId: '', contactId: '', dealId: '',
    isRecurring: false, recurrenceRule: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const body = { ...form, assigneeId: form.assigneeId || null, contactId: form.contactId || null, dealId: form.dealId || null };
      const url = isEdit ? `/api/tasks/${taskId}` : '/api/tasks';
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(isEdit ? `/dashboard/tasks/${taskId}` : '/dashboard/tasks');
    } catch (err) { setError(err instanceof Error ? err.message : 'Помилка'); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader><CardTitle>{isEdit ? 'Редагувати задачу' : 'Нова задача'}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}

            <div className="space-y-2">
              <label className="text-sm font-medium">Назва *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Зателефонувати клієнту" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Опис</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Тип</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="task">Задача</option><option value="call">Дзвінок</option><option value="email">Лист</option><option value="meeting">Зустріч</option><option value="follow_up">Фоллов-ап</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Пріоритет</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="low">Низький</option><option value="medium">Середній</option><option value="high">Високий</option><option value="urgent">Терміново</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Статус</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="todo">До виконання</option><option value="in_progress">В роботі</option><option value="done">Готово</option><option value="cancelled">Скасовано</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Дедлайн</label>
                <Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Нагадування</label>
                <Input type="datetime-local" value={form.reminderAt} onChange={(e) => setForm({ ...form, reminderAt: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="recurring" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <label htmlFor="recurring" className="text-sm font-medium">Повторювана задача</label>
            </div>
            {form.isRecurring && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Правило повторення</label>
                <select value={form.recurrenceRule} onChange={(e) => setForm({ ...form, recurrenceRule: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Оберіть...</option>
                  <option value="daily">Щодня</option><option value="weekly">Щотижня</option><option value="biweekly">Кожні 2 тижні</option><option value="monthly">Щомісяця</option><option value="quarterly">Щокварталу</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>{loading ? 'Збереження...' : isEdit ? 'Зберегти' : 'Створити задачу'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Скасувати</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
