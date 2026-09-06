'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';
import { Check, X, Loader2, ExternalLink, Key, BarChart3, FileText } from 'lucide-react';

interface ProviderStatus {
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  provider: string;
  maskedKey?: string;
}

export default function IntegrationsSettingsPage() {
  const [aiStatus, setAiStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check AI connection status
    fetch('/api/ai', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setAiStatus({
          status: d.available ? 'connected' : 'not_configured',
          message: d.available ? 'Підключено' : 'Не налаштовано',
          provider: d.provider || 'gemini',
          maskedKey: d.maskedKey,
        });
      })
      .catch(() => {
        setAiStatus({
          status: 'not_configured',
          message: 'Не налаштовано',
          provider: 'gemini',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-300">
            <Check className="w-3 h-3" />
            Підключено
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-700 dark:text-red-300">
            <X className="w-3 h-3" />
            Помилка ключа
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400">
            Не налаштовано
          </span>
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">← Назад</Link>
        <h1 className="text-2xl font-bold">Інтеграції</h1>
      </div>

      {/* AI Provider */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                AI Co-Pilot
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
                ) : (
                  statusBadge(aiStatus?.status || 'not_configured')
                )}
              </CardTitle>
              <CardDescription>
                AI для аналізу контактів, прогнозування угод та автоматичного генерування контенту
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/dashboard/settings/ai-keys"
              className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/50 transition-all"
            >
              <Key className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">API-ключі</p>
                <p className="text-xs text-foreground-muted">Налаштувати провайдера</p>
              </div>
            </Link>

            <Link
              href="/dashboard/settings/ai-usage"
              className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/50 transition-all"
            >
              <BarChart3 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Використання</p>
                <p className="text-xs text-foreground-muted">Ліміти та статистика</p>
              </div>
            </Link>

            <Link
              href="/dashboard/copilot/logs"
              className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/50 transition-all"
            >
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Логи</p>
                <p className="text-xs text-foreground-muted">Історія запитів</p>
              </div>
            </Link>
          </div>

          {aiStatus?.maskedKey && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/50">
              <Key className="w-4 h-4 text-foreground-muted" />
              <span className="text-sm font-mono text-foreground-muted">{aiStatus.maskedKey}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <CardDescription>Бот для сповіщень та керування CRM через Telegram</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/settings/telegram" className="text-primary hover:underline text-sm">
            Налаштувати бота →
          </Link>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Business</CardTitle>
          <CardDescription>API для спілкування з клієнтами через WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/settings/whatsapp" className="text-primary hover:underline text-sm">
            Налаштувати API →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
