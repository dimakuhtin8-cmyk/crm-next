'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
  settings: string | null;
  createdAt: string;
  members: Array<{
    id: string;
    role: string;
    user: { id: string; name: string | null; email: string | null; image: string | null };
  }>;
}

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', domain: '' });
  const [error, setError] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    fetchTenant();
  }, [tenantId]);

  const fetchTenant = async () => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}`);
      const data = await response.json();
      setTenant(data.tenant);
      setForm({
        name: data.tenant.name,
        slug: data.tenant.slug,
        domain: data.tenant.domain || '',
      });
    } catch (error) {
      console.error('Failed to fetch tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          domain: form.domain || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTenant((prev) => (prev ? { ...prev, ...data.tenant } : null));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка оновлення');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMember(true);

    try {
      const response = await fetch(`/api/tenants/${tenantId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail, role: 'member' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setNewMemberEmail('');
      fetchTenant(); // Refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка додавання');
    } finally {
      setAddingMember(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Ви впевнені? Це видалить компанію назавжди.')) return;

    try {
      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Помилка видалення');
      router.push('/dashboard/settings/tenants');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка видалення');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Компанію не знайдено</h2>
        <Button onClick={() => router.push('/dashboard/settings/tenants')}>
          Повернутися до списку
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-muted-foreground">/{tenant.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/settings/tenants/${tenantId}/team`)}>
            Команда
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Назад
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Загальні налаштування</CardTitle>
          <CardDescription>Основна інформація про компанію</CardDescription>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Назва</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  required
                  pattern="^[a-z0-9-]+$"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Домен</label>
                <Input
                  value={form.domain}
                  onChange={(e) => setForm((prev) => ({ ...prev, domain: e.target.value }))}
                  placeholder="https://crm.acme.com"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Зберегти</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Скасувати
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Назва:</span>
                <span>{tenant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slug:</span>
                <span>/{tenant.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Домен:</span>
                <span>{tenant.domain || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Створено:</span>
                <span>{new Date(tenant.createdAt).toLocaleDateString('uk')}</span>
              </div>
              <Button variant="outline" onClick={() => setEditing(true)}>
                Редагувати
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Учасники ({tenant.members.length})</CardTitle>
          <CardDescription>Керування доступом до компанії</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddMember} className="flex gap-2">
            <Input
              placeholder="email@example.com"
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={addingMember}>
              {addingMember ? 'Додавання...' : 'Додати'}
            </Button>
          </form>

          <div className="space-y-2">
            {tenant.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">
                    {member.user.name?.charAt(0) || member.user.email?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {member.user.name || member.user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Небезпечна зона</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Видалення компанії призведе до втрати всіх даних. Цю дію неможливо скасувати.
          </p>
          <Button variant="destructive" onClick={handleDelete}>
            Видалити компанію
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
