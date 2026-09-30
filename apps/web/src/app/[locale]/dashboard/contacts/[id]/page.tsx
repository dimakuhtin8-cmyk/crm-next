'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DataError } from '@/components/data-error';
import { InlineEdit } from '@/components/inline-edit';
import { OwnerPicker, useTeam } from '@/components/owner-picker';
import { QuickSelect } from '@/components/quick-create';
import { Button, Input, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface Owner {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  notes: string | null;
  source: string | null;
  status: string;
  ownerId: string | null;
  owner?: Owner | null;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ tag: { id: string; name: string; color: string | null } }>;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  date: string;
  createdAt: string;
}

const activityIcons: Record<string, string> = {
  call: '📞',
  email: '✉️',
  meeting: '🤝',
  task: '✅',
  note: '📝',
  sms: '💬',
};

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'note', title: '', body: '' });
  const [activityLoading, setActivityLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const { currentRole } = useTeam();
  const canManageOwner = currentRole === 'owner' || currentRole === 'admin';

  useEffect(() => {
    fetchData();
  }, [contactId]);

  const fetchData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [contactRes, activitiesRes] = await Promise.all([
        fetch(`/api/contacts/${contactId}`),
        fetch(`/api/contacts/${contactId}/activities`),
      ]);
      if (!contactRes.ok) throw new Error(`Контакт: помилка ${contactRes.status}`);
      if (!activitiesRes.ok) throw new Error(`Активності: помилка ${activitiesRes.status}`);

      const contactData = await contactRes.json();
      const activitiesData = await activitiesRes.json();

      setContact(contactData.contact);
      setActivities(activitiesData.activities || []);
    } catch (err) {
      setContact(null);
      setLoadError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivityLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/contacts/${contactId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityForm),
      });
      if (!res.ok) throw new Error(`Помилка ${res.status}`);

      setActivityForm({ type: 'note', title: '', body: '' });
      setShowActivityForm(false);
      fetchData();
    } catch {
      setFormError('Не вдалося додати активність. Спробуйте ще раз.');
    } finally {
      setActivityLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Видалити цей контакт?')) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      router.push('/dashboard/contacts');
    } catch {
      setFormError('Не вдалося видалити контакт. Спробуйте ще раз.');
    }
  };

  const handleInlineSave = async (field: string, value: string) => {
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    });
    if (res.ok) {
      setContact((prev) => (prev ? { ...prev, [field]: value || null } : prev));
    }
  };

  const handleOwnerSave = async (ownerId: string | null) => {
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    });
    if (res.ok) fetchData();
  };

  const handleAnalyze = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', data: { contactId } }),
      });
      const json = await res.json();
      if (res.ok) setAiAnalysis(json.result);
      else setFormError(json.error || 'AI-аналіз не вдався');
    } catch {
      setFormError('AI-аналіз не вдався. Спробуйте ще раз.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        {loadError ? (
          <DataError message={loadError} onRetry={fetchData} />
        ) : (
          <>
            <h2 className="text-xl font-bold mb-2">Контакт не знайдено</h2>
            <Link href="/dashboard/contacts">
              <Button>Повернутися до списку</Button>
            </Link>
          </>
        )}
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName || ''}`.trim();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
            {contact.firstName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{fullName}</h1>
            {contact.position && contact.company && (
              <p className="text-foreground-muted">
                {contact.position} · {contact.company}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/copilot?contactId=${contactId}`}>
            <Button variant="outline">🤖 Запитати AI</Button>
          </Link>
          <Link href={`/dashboard/contacts/${contactId}/edit`}>
            <Button variant="outline">Редагувати</Button>
          </Link>
          <Button variant="outline" onClick={() => router.back()}>
            Назад
          </Button>
        </div>
      </div>

      {/* Main info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InlineEdit
                  label="Ім'я"
                  value={contact.firstName}
                  onSave={(v) => handleInlineSave('firstName', v)}
                />
                <InlineEdit
                  label="Прізвище"
                  value={contact.lastName}
                  onSave={(v) => handleInlineSave('lastName', v)}
                  emptyText="—"
                />
                <InlineEdit
                  label="Email"
                  value={contact.email}
                  onSave={(v) => handleInlineSave('email', v)}
                  type="email"
                  emptyText="—"
                />
                <InlineEdit
                  label="Телефон"
                  value={contact.phone}
                  onSave={(v) => handleInlineSave('phone', v)}
                  type="phone"
                  emptyText="—"
                />
                <InlineEdit
                  label="Компанія"
                  value={contact.company}
                  onSave={(v) => handleInlineSave('company', v)}
                  emptyText="—"
                />
                <InlineEdit
                  label="Посада"
                  value={contact.position}
                  onSave={(v) => handleInlineSave('position', v)}
                  emptyText="—"
                />
                <div>
                  <p className="text-xs text-foreground-muted mb-1">Статус</p>
                  <div className="w-44">
                    <QuickSelect
                      value={contact.status}
                      onChange={(v) => handleInlineSave('status', v)}
                      options={[
                        { id: 'active', name: 'Активний' },
                        { id: 'inactive', name: 'Неактивний' },
                        { id: 'lead', name: 'Лід' },
                        { id: 'client', name: 'Клієнт' },
                      ]}
                    />
                  </div>
                </div>
                <InlineEdit
                  label="Джерело"
                  value={contact.source}
                  onSave={(v) => handleInlineSave('source', v)}
                  emptyText="—"
                />
                <OwnerPicker
                  value={contact.ownerId}
                  onChange={handleOwnerSave}
                  canManage={canManageOwner}
                />
              </div>

              <div className="pt-4 border-t border-border">
                <InlineEdit
                  label="Нотатки"
                  value={contact.notes}
                  onSave={(v) => handleInlineSave('notes', v)}
                  type="textarea"
                  emptyText="Додати нотатки..."
                />
              </div>

              <div className="pt-4 border-t border-border flex gap-4 text-xs text-foreground-muted">
                <span>Створено: {new Date(contact.createdAt).toLocaleDateString('uk')}</span>
                <span>Оновлено: {new Date(contact.updatedAt).toLocaleDateString('uk')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Теги</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {contact.tags.map((ct) => (
                    <Badge
                      key={ct.tag.id}
                      variant="outline"
                      style={
                        ct.tag.color
                          ? { borderColor: ct.tag.color, color: ct.tag.color }
                          : undefined
                      }
                    >
                      {ct.tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">🤖 AI-аналіз</CardTitle>
              <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={aiLoading}>
                {aiLoading ? 'Аналіз...' : 'Проаналізувати'}
              </Button>
            </CardHeader>
            <CardContent>
              {aiAnalysis ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
                  {aiAnalysis}
                </div>
              ) : (
                <p className="text-sm text-foreground-muted">
                  AI проаналізує активності, угоди та історію контакту і запропонує рекомендації.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Активність</CardTitle>
              <Button size="sm" onClick={() => setShowActivityForm(!showActivityForm)}>
                {showActivityForm ? 'Скасувати' : '+ Додати'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {formError && (
                <div className="p-2.5 bg-destructive/10 text-destructive rounded-lg text-sm">
                  {formError}
                </div>
              )}
              {showActivityForm && (
                <form
                  onSubmit={handleAddActivity}
                  className="space-y-3 p-3 bg-secondary/50 rounded-lg"
                >
                  <QuickSelect
                    value={activityForm.type}
                    onChange={(v) => setActivityForm({ ...activityForm, type: v })}
                    options={[
                      { id: 'note', name: 'Нотатка' },
                      { id: 'call', name: 'Дзвінок' },
                      { id: 'email', name: 'Лист' },
                      { id: 'meeting', name: 'Зустріч' },
                      { id: 'task', name: 'Задача' },
                      { id: 'sms', name: 'SMS' },
                    ]}
                  />
                  <Input
                    placeholder="Заголовок"
                    value={activityForm.title}
                    onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                    required
                  />
                  <textarea
                    placeholder="Деталі (необов'язково)"
                    value={activityForm.body}
                    onChange={(e) => setActivityForm({ ...activityForm, body: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
                  />
                  <Button type="submit" size="sm" disabled={activityLoading}>
                    {activityLoading ? 'Збереження...' : 'Зберегти'}
                  </Button>
                </form>
              )}

              {activities.length === 0 ? (
                <p className="text-sm text-foreground-muted text-center py-4">Немає активностей</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 p-3 bg-secondary/30 rounded-lg">
                      <div className="text-lg flex-shrink-0">
                        {activityIcons[activity.type] || '📌'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{activity.title}</p>
                        {activity.body && (
                          <p className="text-xs text-foreground-muted mt-1 line-clamp-2">
                            {activity.body}
                          </p>
                        )}
                        <p className="text-xs text-foreground-muted mt-1">
                          {new Date(activity.date).toLocaleDateString('uk', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <Button variant="destructive" className="w-full" onClick={handleDelete}>
                Видалити контакт
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
