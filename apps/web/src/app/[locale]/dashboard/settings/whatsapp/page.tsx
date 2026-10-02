'use client';

import { Check, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge, Button, Card, CardContent, Input, SecretInput, Skeleton } from '@/components/ui';

interface WhatsAppConfig {
  configured: boolean;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
}

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    apiKey: '',
    appId: '',
    phoneNumberId: '',
    phoneNumber: '',
    wabaId: '',
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    fetch('/api/whatsapp/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() =>
        setConfig({ configured: false, phoneNumber: null, phoneNumberId: null, wabaId: null }),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error('Не вдалося підключити WhatsApp', {
          description: data.error || 'Помилка налаштування',
        });
        return;
      }

      toast.success('WhatsApp підключено');
      setWebhookUrl(data.webhookUrl);
      setConfig({
        configured: true,
        phoneNumber: formData.phoneNumber,
        phoneNumberId: formData.phoneNumberId,
        wabaId: formData.wabaId,
      });
      setFormData({ apiKey: '', appId: '', phoneNumberId: '', phoneNumber: '', wabaId: '' });
    } catch {
      toast.error("Помилка з'єднання");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Відключити WhatsApp?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setConfig({ configured: false, phoneNumber: null, phoneNumberId: null, wabaId: null });
      toast.success('WhatsApp відключено');
    } catch {
      toast.error('Помилка відключення');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Синхронізація шаблонів повідомлень — демонстраційна:
   * інтеграція з Meta Templates API у проєкті відсутня.
   */
  const handleSyncTemplates = async () => {
    setSyncing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setLastSynced(new Date().toLocaleTimeString('uk'));
      toast.success('Шаблони синхронізовано', {
        description: 'Демонстраційна синхронізація — Meta Templates API не інтегровано',
      });
    } catch {
      toast.error('Не вдалося синхронізувати шаблони');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/dashboard/settings"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            ← Налаштування
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">WhatsApp Business</h1>
          {config?.configured ? (
            <Badge variant="success">Підключено</Badge>
          ) : (
            <Badge variant="secondary">Не налаштовано</Badge>
          )}
        </div>
        <p className="text-foreground-muted">
          Підключіть WhatsApp Business API для спілкування з клієнтами
        </p>
      </div>

      {config?.configured ? (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-success-light flex items-center justify-center">
                <Check className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">WhatsApp підключено</h3>
                <p className="text-sm text-foreground-muted">{config.phoneNumber}</p>
              </div>
              <Button variant="outline" onClick={handleRemove} disabled={saving}>
                Відключити
              </Button>
            </div>

            <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Webhook URL (для 360dialog):</h4>
              <code className="block bg-background px-3 py-2 rounded text-xs break-all">
                {webhookUrl ||
                  `${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook`}
              </code>
              <p className="text-xs text-foreground-muted mt-2">
                Встановіть цей URL у налаштуваннях 360dialog як Webhook URL
              </p>
            </div>

            <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-medium">Шаблони повідомлень</h4>
                  <p className="text-xs text-foreground-muted mt-1">
                    {lastSynced
                      ? `Остання синхронізація: ${lastSynced}`
                      : 'Шаблони ще не синхронізувалися'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncTemplates}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {syncing ? 'Синхронізація...' : 'Синхронізувати шаблони'}
                </Button>
              </div>
              <p className="text-xs text-foreground-muted mt-2">
                Демонстраційна синхронізація — інтеграція з Meta Templates API відсутня
              </p>
            </div>

            <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Як використовувати:</h4>
              <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
                <li>Напишіть вашому номеру WhatsApp</li>
                <li>Надішліть /start для підключення</li>
                <li>Використовуйте /deals для перегляду угод</li>
                <li>Використовуйте /tasks для перегляду задач</li>
                <li>Повідомлення зберігаються як активність контакту</li>
              </ol>
            </div>

            <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Команди:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-foreground-muted">
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/start</code> —
                  Головне меню
                </div>
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/help</code> —
                  Довідка
                </div>
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/deals</code> —
                  Список угод
                </div>
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/tasks</code> — Мої
                  задачі
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-medium">Підключити WhatsApp Business</h3>
                <p className="text-sm text-foreground-muted">
                  Потрібен акаунт 360dialog або WhatsApp Business API провайдер
                </p>
              </div>
            </div>

            <div className="p-4 bg-secondary/50 rounded-lg mb-6">
              <h4 className="text-sm font-medium mb-2">Інструкція (360dialog):</h4>
              <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
                <li>
                  Зареєструйтесь на{' '}
                  <a
                    href="https://360dialog.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    360dialog.com
                  </a>
                </li>
                <li>Створіть WhatsApp Business Account (WABA)</li>
                <li>Отримайте API Key та App ID</li>
                <li>Додайте номер телефону та Phone Number ID</li>
                <li>Введіть дані нижче</li>
                <li>Встановіть Webhook URL у налаштуваннях 360dialog</li>
              </ol>
            </div>

            <form onSubmit={handleSetup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    API Key
                  </label>
                  <SecretInput
                    placeholder="360dialog API key"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    App ID
                  </label>
                  <Input
                    placeholder="360dialog App ID"
                    value={formData.appId}
                    onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  Phone Number ID
                </label>
                <Input
                  placeholder="ID номера телефону з 360dialog"
                  value={formData.phoneNumberId}
                  onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    Номер телефону
                  </label>
                  <Input
                    placeholder="+380XXXXXXXXX"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    WABA ID
                  </label>
                  <Input
                    placeholder="WhatsApp Business Account ID"
                    value={formData.wabaId}
                    onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving || !formData.apiKey}>
                {saving ? 'Налаштування...' : 'Підключити WhatsApp'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-5">
          <h3 className="font-medium mb-3">Можливості</h3>
          <ul className="text-sm text-foreground-muted space-y-2">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" />
              Вхідні повідомлення → створення Activity
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" />
              Привязка WhatsApp до контактів CRM
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              Команди: /start, /help, /deals, /tasks
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              Автоматичні сповіщення про задачі та угоди
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-warning flex-shrink-0" />
              Відправка документів та зображень
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
