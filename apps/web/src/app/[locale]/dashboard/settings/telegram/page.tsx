'use client';

import { Check, Loader2, Send, Zap } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge, Button, Card, CardContent, SecretInput, Skeleton } from '@/components/ui';

interface BotConfig {
  configured: boolean;
  botUsername: string | null;
  webhookSet: boolean;
}

/** Клієнтська перевірка формату токена Telegram Bot API */
const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

export default function TelegramSettingsPage() {
  const t = useTranslations('telegram');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/telegram/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ configured: false, botUsername: null, webhookSet: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = token.trim();
    if (!TOKEN_RE.test(trimmed)) {
      toast.error(t('invalidTokenFormat'), {
        description: t('tokenFormatExpected', { example: '123456789:ABCdef...' }),
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(t('connectError'), {
          description: data.error || tCommon('setupError'),
        });
        return;
      }

      toast.success(t('botConnected'), { description: `@${data.botUsername}` });
      setToken('');
      setConfig({ configured: true, botUsername: data.botUsername, webhookSet: data.webhookSet });
    } catch {
      toast.error(tCommon('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  /** Тест введеного токена через Telegram getMe (без збереження) */
  const handleTestToken = async () => {
    const trimmed = token.trim();
    if (!TOKEN_RE.test(trimmed)) {
      toast.error(t('invalidTokenFormat'), {
        description: t('tokenFormatExpected', { example: '123456789:ABCdef...' }),
      });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/telegram/config?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('tokenValid'), {
          description: t('tokenValidDescription', { username: data.botUsername }),
        });
      } else {
        toast.error(tCommon('testFailed'), { description: data.error });
      }
    } catch {
      toast.error(tCommon('serverConnectionError'));
    } finally {
      setTesting(false);
    }
  };

  /** Тест збереженого підключення: реальний виклик getMe до Telegram */
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/telegram/config?action=test');
      const data = await res.json();
      if (res.ok) {
        setConfig((prev) =>
          prev ? { ...prev, botUsername: data.botUsername, webhookSet: data.webhookSet } : prev,
        );
        toast.success(t('botResponding'), {
          description: `@${data.botUsername} · webhook: ${data.webhookSet ? t('webhookSet') : t('webhookNotSet')}`,
        });
      } else {
        toast.error(tCommon('testFailed'), { description: data.error });
      }
    } catch {
      toast.error(tCommon('serverConnectionError'));
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(t('disconnectBotConfirm'))) return;
    setSaving(true);
    try {
      const res = await fetch('/api/telegram/config', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setConfig({ configured: false, botUsername: null, webhookSet: false });
      toast.success(t('botDisconnected'));
    } catch {
      toast.error(tCommon('disconnectError'));
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
            ← {tSettings('title')}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{tSettings('telegramBotCardTitle')}</h1>
          {config?.configured ? (
            <Badge variant="success">{t('connected')}</Badge>
          ) : (
            <Badge variant="secondary">{tCommon('notConfigured')}</Badge>
          )}
        </div>
        <p className="text-foreground-muted">{t('subtitle')}</p>
      </div>

      {/* Status */}
      {config?.configured ? (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-success-light flex items-center justify-center">
                <Check className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{t('botConnected')}</h3>
                <p className="text-sm text-foreground-muted">@{config.botUsername}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  {tCommon('testConnection')}
                </Button>
                <Button variant="outline" onClick={handleRemove} disabled={saving}>
                  {tCommon('disconnect')}
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-secondary/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">{tCommon('howToUse')}</h4>
              <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
                <li>{t('howToOpenBot', { username: String(config.botUsername) })}</li>
                <li>{tCommon('howToUseStart')}</li>
                <li>{tCommon('howToUseDeals')}</li>
                <li>{tCommon('howToUseTasks')}</li>
                <li>{t('howToMessage')}</li>
              </ol>
            </div>

            <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">{t('commands')}:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-foreground-muted">
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/start</code> —{' '}
                  {tCommon('cmdStart')}
                </div>
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/help</code> —{' '}
                  {tCommon('cmdHelp')}
                </div>
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/deals</code> —{' '}
                  {tCommon('cmdDeals')}
                </div>
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/tasks</code> —{' '}
                  {tCommon('cmdTasks')}
                </div>
                <div>
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/status</code> —{' '}
                  {t('cmdStatus')}
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
                <h3 className="font-medium">{t('connectTitle')}</h3>
                <p className="text-sm text-foreground-muted">{t('connectDescription')}</p>
              </div>
            </div>

            <div className="p-4 bg-secondary/50 rounded-lg mb-6">
              <h4 className="text-sm font-medium mb-2">{t('instructions')}</h4>
              <ol className="text-sm text-foreground-muted space-y-1 list-decimal list-inside">
                <li>
                  {t('openWord')}{' '}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    @BotFather
                  </a>{' '}
                  {t('inTelegram')}
                </li>
                <li>
                  {t('sendWord')}{' '}
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs">/newbot</code>
                </li>
                <li>{t('enterNameUsername')}</li>
                <li>{t('copyToken')}</li>
                <li>{t('pasteTokenBelow')}</li>
              </ol>
            </div>

            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  {t('botToken')}
                </label>
                <SecretInput
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !token}>
                  {saving ? tCommon('configuring') : t('connectBot')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestToken}
                  disabled={testing || !token}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  {t('testToken')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notifications info */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-5">
          <h3 className="font-medium mb-3">{tSettings('notifications')}</h3>
          <p className="text-sm text-foreground-muted mb-4">{t('notificationsIntro')}</p>
          <ul className="text-sm text-foreground-muted space-y-2">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              {t('notifyNewTask')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              {t('notifyTaskAssigned')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-warning flex-shrink-0" />
              {t('notifyDeadlineSoon')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-danger flex-shrink-0" />
              {t('notifyTaskOverdue')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" />
              {t('notifyDealStatus')}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
