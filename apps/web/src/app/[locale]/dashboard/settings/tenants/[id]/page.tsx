'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { QuickSelect } from '@/components/quick-create';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Skeleton,
} from '@/components/ui';
import { AI_PROVIDERS, getProvider } from '@/lib/ai/providers';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
  settings: string | null;
  geminiApiKey: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  aiApiKey: string | null;
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
  const [form, setForm] = useState({
    name: '',
    slug: '',
    domain: '',
    geminiApiKey: '',
    aiProvider: 'gemini',
    aiModel: '',
    aiApiKey: '',
  });
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
        geminiApiKey: data.tenant.geminiApiKey || '',
        aiProvider: data.tenant.aiProvider || 'gemini',
        aiModel: data.tenant.aiModel || '',
        aiApiKey: data.tenant.aiApiKey || '',
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
          geminiApiKey: form.geminiApiKey || null,
          aiProvider: form.aiProvider || 'gemini',
          aiModel: form.aiModel || null,
          aiApiKey: form.aiApiKey || null,
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
      <div className="max-w-4xl mx-auto p-5 space-y-4">
        <Skeleton className="h-8 w-1/3 rounded" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="max-w-4xl mx-auto p-5 text-center">
        <h2 className="text-xl font-bold mb-2">Компанію не знайдено</h2>
        <Button onClick={() => router.push('/dashboard/settings/tenants')}>
          Повернутися до списку
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-foreground-muted">/{tenant.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/settings/tenants/${tenantId}/team`)}
          >
            Команда
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Назад
          </Button>
        </div>
      </div>

      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

      {/* General Settings */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Загальні налаштування</CardTitle>
          <CardDescription>Основна інформація про компанію</CardDescription>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-foreground-muted">Назва</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-foreground-muted">Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  required
                  pattern="^[a-z0-9-]+$"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-foreground-muted">Домен</Label>
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
            <div>
              <div className="flex justify-between py-2">
                <span className="text-foreground-muted">Назва:</span>
                <span>{tenant.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between py-2">
                <span className="text-foreground-muted">Slug:</span>
                <span>/{tenant.slug}</span>
              </div>
              <Separator />
              <div className="flex justify-between py-2">
                <span className="text-foreground-muted">Домен:</span>
                <span>{tenant.domain || '—'}</span>
              </div>
              <Separator />
              <div className="flex justify-between py-2">
                <span className="text-foreground-muted">Створено:</span>
                <span>{new Date(tenant.createdAt).toLocaleDateString('uk')}</span>
              </div>
              <Button variant="outline" className="mt-3" onClick={() => setEditing(true)}>
                Редагувати
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>AI-налаштування</CardTitle>
          <CardDescription>
            Оберіть AI-провайдера та введіть API-ключ для AI-функцій CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <>
              {/* Provider selector */}
              <div className="space-y-2">
                <Label className="text-xs text-foreground-muted">AI-провайдер</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AI_PROVIDERS.filter((p) => p.id !== 'custom').map((provider) => (
                    <Card
                      key={provider.id}
                      className={`bg-card cursor-pointer transition-all ${
                        form.aiProvider === provider.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
                          : 'hover:border-primary/50 shadow-sm'
                      }`}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          aiProvider: provider.id,
                          aiModel: provider.models[0]?.id || '',
                        }))
                      }
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={provider.logo}
                            alt={provider.name}
                            className="h-5 w-5 shrink-0"
                          />
                          <span className="text-xs font-medium leading-tight">{provider.name}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Selected provider info */}
              {(() => {
                const selectedProvider = getProvider(form.aiProvider);
                if (!selectedProvider) return null;
                return (
                  <div className="p-3 bg-secondary/50 rounded-lg text-xs text-foreground-muted">
                    {selectedProvider.description}
                    <br />
                    Безкоштовний тариф: {selectedProvider.freeQuota}
                  </div>
                );
              })()}

              {/* Model selector */}
              {(() => {
                const selectedProvider = getProvider(form.aiProvider);
                if (!selectedProvider || selectedProvider.models.length <= 1) return null;
                return (
                  <div className="space-y-2">
                    <Label className="text-xs text-foreground-muted">Модель</Label>
                    <QuickSelect
                      value={form.aiModel}
                      onChange={(id) => setForm((prev) => ({ ...prev, aiModel: id }))}
                      options={selectedProvider.models.map((model) => ({
                        id: model.id,
                        name: `${model.name} — ${model.description}`,
                      }))}
                    />
                  </div>
                );
              })()}

              {/* API Key input */}
              <div className="space-y-2">
                <Label className="text-xs text-foreground-muted">API-ключ</Label>
                <Input
                  type="password"
                  value={form.aiApiKey || form.geminiApiKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (form.aiProvider === 'gemini') {
                      setForm((prev) => ({ ...prev, geminiApiKey: val, aiApiKey: val }));
                    } else {
                      setForm((prev) => ({ ...prev, aiApiKey: val, geminiApiKey: val }));
                    }
                  }}
                  placeholder={getProvider(form.aiProvider)?.keyPlaceholder || 'your-api-key'}
                />
                <p className="text-xs text-foreground-muted">
                  Ваш ключ зберігається тільки у вашій компанії. Він не передається третім особам.
                </p>
              </div>

              {/* Get key link */}
              {getProvider(form.aiProvider)?.keyUrl && (
                <a
                  href={getProvider(form.aiProvider)!.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Отримати API-ключ {getProvider(form.aiProvider)!.name} →
                </a>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {getProvider(tenant.aiProvider || 'gemini')?.logo ? (
                    <img
                      src={getProvider(tenant.aiProvider || 'gemini')!.logo}
                      alt=""
                      className="h-5 w-5"
                    />
                  ) : (
                    <span className="text-lg">🔷</span>
                  )}
                  <span className="font-medium">
                    {getProvider(tenant.aiProvider || 'gemini')?.name || 'Gemini'}
                  </span>
                </div>
                {tenant.aiApiKey || tenant.geminiApiKey ? (
                  <Badge variant="success">Підключено</Badge>
                ) : (
                  <Badge variant="warning">Не налаштовано</Badge>
                )}
              </div>
              {(tenant.aiApiKey || tenant.geminiApiKey) && (
                <p className="text-xs text-foreground-muted">
                  Ключ: ••••{(tenant.aiApiKey || tenant.geminiApiKey || '').slice(-4)}
                </p>
              )}
              <Button variant="outline" onClick={() => setEditing(true)}>
                Налаштувати
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
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
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={member.user.image ?? undefined}
                    name={member.user.name || member.user.email || '?'}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-medium">{member.user.name || member.user.email}</p>
                    <p className="text-xs text-foreground-muted">{member.user.email}</p>
                  </div>
                </div>
                <Badge variant={member.role === 'owner' ? 'default' : 'outline'}>
                  {member.role === 'owner'
                    ? 'Власник'
                    : member.role === 'admin'
                      ? 'Адміністратор'
                      : 'Учасник'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-danger/50 bg-card shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-danger">Небезпечна зона</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground-muted mb-4">
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
