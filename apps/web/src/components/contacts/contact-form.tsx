'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { QuickSelect } from '@/components/quick-create';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface ContactFormProps {
  contactId?: string;
  initialData?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    position: string;
    notes: string;
    source: string;
    status: string;
    tagIds: string[];
  };
}

export function ContactForm({ contactId, initialData }: ContactFormProps) {
  const router = useRouter();
  const isEdit = !!contactId;

  const [form, setForm] = useState(
    initialData || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      position: '',
      notes: '',
      source: '',
      status: 'active',
      tagIds: [] as string[],
    },
  );
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsError, setTagsError] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      const data = await res.json();
      setTags(data.tags || []);
    } catch {
      // теги — необов'язкове доповнення форми, працює і без них
      setTagsError(true);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      const data = await res.json();
      if (data.tag) {
        setTags([...tags, data.tag]);
        setForm({ ...form, tagIds: [...form.tagIds, data.tag.id] });
        setNewTagName('');
      }
    } catch {
      setTagsError(true);
    }
  };

  const toggleTag = (tagId: string) => {
    setForm({
      ...form,
      tagIds: form.tagIds.includes(tagId)
        ? form.tagIds.filter((id) => id !== tagId)
        : [...form.tagIds, tagId],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEdit ? `/api/contacts/${contactId}` : '/api/contacts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(isEdit ? `/dashboard/contacts/${contactId}` : '/dashboard/contacts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Редагувати контакт' : 'Новий контакт'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Ім'я *</label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                  placeholder="Олександр"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Прізвище</label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Петренко"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Телефон</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+380 XX XXX XX XX"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Компанія</label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Назва компанії"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Посада</label>
                <Input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="Менеджер з продажу"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Статус</label>
                <QuickSelect
                  value={form.status}
                  onChange={(id) => setForm({ ...form, status: id })}
                  options={[
                    { id: 'active', name: 'Активний' },
                    { id: 'lead', name: 'Лід' },
                    { id: 'client', name: 'Клієнт' },
                    { id: 'inactive', name: 'Неактивний' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Джерело</label>
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="Сайт, рекомендація, тощо"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Теги</label>
              {tagsError && (
                <p className="text-xs text-destructive">
                  Не вдалося завантажити теги — контакт можна зберегти без них
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm border transition-colors',
                      form.tagIds.includes(tag.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-secondary',
                    )}
                    style={
                      !form.tagIds.includes(tag.id) && tag.color
                        ? { borderColor: tag.color, color: tag.color }
                        : undefined
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Новий тег"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleCreateTag}>
                  Додати тег
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Нотатки</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Додаткова інформація про контакт..."
                rows={4}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Збереження...' : isEdit ? 'Зберегти зміни' : 'Створити контакт'}
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
