'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { QuickSelect } from '@/components/quick-create';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

interface TaskFormProps {
  taskId?: string;
  initialData?: {
    title: string;
    description: string;
    type: string;
    status: string;
    priority: string;
    dueDate: string;
    reminderAt: string;
    assigneeId: string;
    contactId: string;
    dealId: string;
    isRecurring: boolean;
    recurrenceRule: string;
  };
}

export function TaskForm({ taskId, initialData }: TaskFormProps) {
  const router = useRouter();
  const isEdit = !!taskId;
  const [form, setForm] = useState(
    initialData || {
      title: '',
      description: '',
      type: 'task',
      status: 'todo',
      priority: 'medium',
      dueDate: '',
      reminderAt: '',
      assigneeId: '',
      contactId: '',
      dealId: '',
      isRecurring: false,
      recurrenceRule: '',
    },
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    fetch('/api/team', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setTeamMembers(data.members || []))
      .catch(() => {
        // команда для селекта виконавця: мовчазно, поле лишається порожнім
        console.warn('[task-form] team fetch failed');
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = {
        ...form,
        assigneeId: form.assigneeId || null,
        contactId: form.contactId || null,
        dealId: form.dealId || null,
      };
      const url = isEdit ? `/api/tasks/${taskId}` : '/api/tasks';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(isEdit ? `/dashboard/tasks/${taskId}` : '/dashboard/tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Редагувати задачу' : 'Нова задача'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Назва *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Зателефонувати клієнту"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Опис</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Тип</label>
                <QuickSelect
                  value={form.type}
                  onChange={(id) => setForm({ ...form, type: id })}
                  options={[
                    { id: 'task', name: 'Задача' },
                    { id: 'call', name: 'Дзвінок' },
                    { id: 'email', name: 'Лист' },
                    { id: 'meeting', name: 'Зустріч' },
                    { id: 'follow_up', name: 'Фоллов-ап' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Пріоритет</label>
                <QuickSelect
                  value={form.priority}
                  onChange={(id) => setForm({ ...form, priority: id })}
                  options={[
                    { id: 'low', name: 'Низький' },
                    { id: 'medium', name: 'Середній' },
                    { id: 'high', name: 'Високий' },
                    { id: 'urgent', name: 'Терміново' },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Статус</label>
                <QuickSelect
                  value={form.status}
                  onChange={(id) => setForm({ ...form, status: id })}
                  options={[
                    { id: 'todo', name: 'До виконання' },
                    { id: 'in_progress', name: 'В роботі' },
                    { id: 'done', name: 'Готово' },
                    { id: 'cancelled', name: 'Скасовано' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Відповідальний</label>
                <QuickSelect
                  value={form.assigneeId}
                  onChange={(id) => setForm({ ...form, assigneeId: id })}
                  options={[
                    { id: '', name: 'Не призначено' },
                    ...teamMembers.map((m) => ({ id: m.id, name: m.name || m.email || '?' })),
                  ]}
                  placeholder="Не призначено"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Дедлайн</label>
                <Input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Нагадування</label>
                <Input
                  type="datetime-local"
                  value={form.reminderAt}
                  onChange={(e) => setForm({ ...form, reminderAt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="recurring"
                checked={form.isRecurring}
                onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="recurring" className="text-sm font-medium">
                Повторювана задача
              </label>
            </div>
            {form.isRecurring && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Правило повторення</label>
                <QuickSelect
                  value={form.recurrenceRule}
                  onChange={(id) => setForm({ ...form, recurrenceRule: id })}
                  options={[
                    { id: '', name: 'Оберіть...' },
                    { id: 'daily', name: 'Щодня' },
                    { id: 'weekly', name: 'Щотижня' },
                    { id: 'biweekly', name: 'Кожні 2 тижні' },
                    { id: 'monthly', name: 'Щомісяця' },
                    { id: 'quarterly', name: 'Щокварталу' },
                  ]}
                  placeholder="Оберіть..."
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Збереження...' : isEdit ? 'Зберегти' : 'Створити задачу'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Скасувати
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
