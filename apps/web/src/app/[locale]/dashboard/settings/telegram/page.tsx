'use client';

import { Check, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge, Button, Card, CardContent, Input, Skeleton } from '@/components/ui';

interface BotConfig {
  configured: boolean;
  botUsername: string | null;
  webhookSet: boolean;
}

export default function TelegramSettingsPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/telegram/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ configured: false, botUsername: null, webhookSet: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Помилка налаштування');
        return;
      }

      setSuccess(`Бот @${data.botUsername} успішно підключено!`);
      setToken('');
      setConfig({ configured: true, botUsername: data.botUsername, webhookSet: data.webhookSet });
    } catch {
      setError("Помилка з'єднання");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Відключити бота?')) return;
    setSaving(true);
    try {
      await fetch('/api/telegram/config', { method: 'DELETE' });
      setConfig({ configured: false, botUsername: null, webhookSet: false });
      setSuccess('Бот відключено');
    } catch {
      setError('Помилка відключення');
    } finally {
      setSaving(false);
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
          <h1 className="text-2xl font-bold">Telegram-бот</h1>
          {config?.configured ? (
            <Badge variant="success">Підключено</Badge>
          ) : (
            <Badge variant="secondary">Не налаштовано</Badge>
          )}
        </div>
        <p className="text-foreground-muted">
          Підключіть Telegram-бота для отримання повідомлень та керування CRM
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger-light border border-danger/20 text-danger text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-success-light border border-success/20 text-success text-sm">
          {success}
        </div>
      )}

      {/* Status */}
      {config?.configured ? (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-success-light flex items-center justify-center">
                <Check className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Бот підключено</h3>
                <p className="text-sm text-foreground-muted">@{config.botUsername}</p>
              </div>
              <Button variant="outline" onClick={handleRemove} disabled={saving}>
                Відключити
              </Button>
            </div>

            <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Як використовувати:</h4>
              <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
                <li>Відкрийте бота @{config.botUsername} в Telegram</li>
                <li>Надішліть /start для підключення</li>
                <li>Використовуйте /deals для перегляду угод</li>
                <li>Використовуйте /tasks для перегляду задач</li>
                <li>Надішліть повідомлення — воно збережеться як активність</li>
              </ol>
            </div>

            <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Команди бота:</h4>
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
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/status</code> —
                  Статус бота
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-primary-light flex items-center justify-center">
                <Send className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Підключити Telegram-бота</h3>
                <p className="text-sm text-foreground-muted">
                  Створіть бота через BotFather та введіть токен
                </p>
              </div>
            </div>

            <div className="p-4 bg-secondary/50 rounded-lg mb-6">
              <h4 className="text-sm font-medium mb-2">Інструкція:</h4>
              <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
                <li>
                  Відкрийте{' '}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    @BotFather
                  </a>{' '}
                  в Telegram
                </li>
                <li>
                  Надішліть{' '}
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/newbot</code>
                </li>
                <li>Введіть ім&apos;я та username бота</li>
                <li>Скопіюйте отриманий токен</li>
                <li>Вставте токен нижче</li>
              </ol>
            </div>

            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  Токен бота
                </label>
                <Input
                  type="password"
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={saving || !token}>
                {saving ? 'Налаштування...' : 'Підключити бота'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notifications info */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-5">
          <h3 className="font-medium mb-3">Сповіщення</h3>
          <p className="text-sm text-foreground-muted mb-4">
            Бот автоматично надсилає сповіщення при:
          </p>
          <ul className="text-sm text-foreground-muted space-y-2">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              Створенні нової задачі
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              Призначенні задачі на співробітника
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-warning flex-shrink-0" />
              Наближенні до дедлайну
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-danger flex-shrink-0" />
              Протермінуванні задачі
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" />
              Зміні статусу угоди (виграна/втрачена)
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
