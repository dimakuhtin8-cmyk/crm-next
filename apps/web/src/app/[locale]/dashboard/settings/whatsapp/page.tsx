'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button, Card, CardContent, Input } from '@/components/ui';

interface WhatsAppConfig {
  configured: boolean;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
}

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ apiKey: '', appId: '', phoneNumberId: '', phoneNumber: '', wabaId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    fetch('/api/whatsapp/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ configured: false, phoneNumber: null, phoneNumberId: null, wabaId: null }))
      .finally(() => setLoading(false));
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Помилка налаштування');
        return;
      }

      setSuccess('WhatsApp успішно підключено!');
      setWebhookUrl(data.webhookUrl);
      setConfig({
        configured: true,
        phoneNumber: formData.phoneNumber,
        phoneNumberId: formData.phoneNumberId,
        wabaId: formData.wabaId,
      });
      setFormData({ apiKey: '', appId: '', phoneNumberId: '', phoneNumber: '', wabaId: '' });
    } catch {
      setError('Помилка з\'єднання');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Відключити WhatsApp?')) return;
    setSaving(true);
    try {
      await fetch('/api/whatsapp/config', { method: 'DELETE' });
      setConfig({ configured: false, phoneNumber: null, phoneNumberId: null, wabaId: null });
      setSuccess('WhatsApp відключено');
    } catch {
      setError('Помилка відключення');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto space-y-6"><div className="h-40 bg-muted rounded-lg animate-pulse" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/dashboard/settings" className="text-sm text-foreground-muted hover:text-foreground transition-colors">← Налаштування</Link>
        </div>
        <h1 className="text-2xl font-bold">WhatsApp Business</h1>
        <p className="text-foreground-muted">Підключіть WhatsApp Business API для спілкування з клієнтами</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger-light border border-danger/20 text-danger text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-success-light border border-success/20 text-success text-sm">{success}</div>
      )}

      {config?.configured ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-success-light flex items-center justify-center">
                <svg className="h-6 w-6 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
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
                {webhookUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook`}
              </code>
              <p className="text-xs text-foreground-muted mt-2">
                Встановіть цей URL у налаштуваннях 360dialog як Webhook URL
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
                <div><code className="bg-background px-1.5 py-0.5 rounded text-xs">/start</code> — Головне меню</div>
                <div><code className="bg-background px-1.5 py-0.5 rounded text-xs">/help</code> — Довідка</div>
                <div><code className="bg-background px-1.5 py-0.5 rounded text-xs">/deals</code> — Список угод</div>
                <div><code className="bg-background px-1.5 py-0.5 rounded text-xs">/tasks</code> — Мої задачі</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <svg className="h-6 w-6 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Підключити WhatsApp Business</h3>
                <p className="text-sm text-foreground-muted">Потрібен акаунт 360dialog або WhatsApp Business API провайдер</p>
              </div>
            </div>

            <div className="p-4 bg-secondary/50 rounded-lg mb-6">
              <h4 className="text-sm font-medium mb-2">Інструкція (360dialog):</h4>
              <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
                <li>Зареєструйтесь на <a href="https://360dialog.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">360dialog.com</a></li>
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
                  <label className="block text-sm font-medium mb-1">API Key</label>
                  <Input
                    type="password"
                    placeholder="360dialog API key"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">App ID</label>
                  <Input
                    placeholder="360dialog App ID"
                    value={formData.appId}
                    onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number ID</label>
                <Input
                  placeholder="ID номера телефону з 360dialog"
                  value={formData.phoneNumberId}
                  onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Номер телефону</label>
                  <Input
                    placeholder="+380XXXXXXXXX"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">WABA ID</label>
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
      <Card>
        <CardContent className="p-6">
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
