'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button, Input, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

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

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' }> = {
  active: { label: 'Активний', variant: 'success' },
  inactive: { label: 'Неактивний', variant: 'secondary' },
  lead: { label: 'Лід', variant: 'default' },
  client: { label: 'Клієнт', variant: 'outline' },
};

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
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'note', title: '', body: '' });
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [contactId]);

  const fetchData = async () => {
    try {
      const [contactRes, activitiesRes] = await Promise.all([
        fetch(`/api/contacts/${contactId}`),
        fetch(`/api/contacts/${contactId}/activities`),
      ]);

      const contactData = await contactRes.json();
      const activitiesData = await activitiesRes.json();

      setContact(contactData.contact);
      setActivities(activitiesData.activities || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivityLoading(true);

    try {
      await fetch(`/api/contacts/${contactId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityForm),
      });

      setActivityForm({ type: 'note', title: '', body: '' });
      setShowActivityForm(false);
      fetchData();
    } catch {
    } finally {
      setActivityLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Видалити цей контакт?')) return;
    try {
      await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      router.push('/dashboard/contacts');
    } catch {}
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
        <h2 className="text-xl font-bold mb-2">Контакт не знайдено</h2>
        <Link href="/dashboard/contacts">
          <Button>Повернутися до списку</Button>
        </Link>
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
              <p className="text-foreground-muted">{contact.position} · {contact.company}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/contacts/${contactId}/edit`}>
            <Button variant="outline">Редагувати</Button>
          </Link>
          <Button variant="outline" onClick={() => router.back()}>Назад</Button>
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
                <div>
                  <p className="text-sm text-foreground-muted">Ім'я</p>
                  <p className="font-medium">{contact.firstName}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Прізвище</p>
                  <p className="font-medium">{contact.lastName || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Email</p>
                  <p className="font-medium">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
                    ) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Телефон</p>
                  <p className="font-medium">
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} className="text-primary hover:underline">{contact.phone}</a>
                    ) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Компанія</p>
                  <p className="font-medium">{contact.company || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Посада</p>
                  <p className="font-medium">{contact.position || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Статус</p>
                  <Badge variant={statusConfig[contact.status]?.variant || 'outline'}>
                    {statusConfig[contact.status]?.label || contact.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Джерело</p>
                  <p className="font-medium">{contact.source || '—'}</p>
                </div>
              </div>

              {contact.notes && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-foreground-muted mb-1">Нотатки</p>
                  <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                </div>
              )}

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
                      style={ct.tag.color ? { borderColor: ct.tag.color, color: ct.tag.color } : undefined}
                    >
                      {ct.tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
              {showActivityForm && (
                <form onSubmit={handleAddActivity} className="space-y-3 p-3 bg-secondary/50 rounded-lg">
                  <select
                    value={activityForm.type}
                    onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="note">Нотатка</option>
                    <option value="call">Дзвінок</option>
                    <option value="email">Лист</option>
                    <option value="meeting">Зустріч</option>
                    <option value="task">Задача</option>
                    <option value="sms">SMS</option>
                  </select>
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
                      <div className="text-lg flex-shrink-0">{activityIcons[activity.type] || '📌'}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{activity.title}</p>
                        {activity.body && (
                          <p className="text-xs text-foreground-muted mt-1 line-clamp-2">{activity.body}</p>
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
