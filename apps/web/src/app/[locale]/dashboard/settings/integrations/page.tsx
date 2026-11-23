'use client';

import { Check, X, Loader2, Key, BarChart3, FileText, MessageCircle, Database } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';

interface ProviderStatus {
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  provider: string;
  maskedKey?: string;
}

export default function IntegrationsSettingsPage() {
  const t = useTranslations('exchange1c');
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('settings');
  const [aiStatus, setAiStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [telegramConfigured, setTelegramConfigured] = useState<boolean | null>(null);
  const [whatsappConfigured, setWhatsappConfigured] = useState<boolean | null>(null);
  const [databaseConfigured, setDatabaseConfigured] = useState<boolean | null>(null);
  const [exchangeToken, setExchangeToken] = useState<{
    hasToken: boolean;
    masked: string | null;
  } | null>(null);
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const [exchangeNewToken, setExchangeNewToken] = useState<string | null>(null);
  const [exchangeMessage, setExchangeMessage] = useState<string | null>(null);
  const [exchangeCopied, setExchangeCopied] = useState(false);

  useEffect(() => {
    // Check AI connection status
    fetch('/api/ai', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setAiStatus({
          status: d.available ? 'connected' : 'not_configured',
          message: d.available ? tSettings('connected') : tCommon('notConfigured'),
          provider: d.provider || 'gemini',
          maskedKey: d.maskedKey,
        });
      })
      .catch(() => {
        setAiStatus({
          status: 'not_configured',
          message: tCommon('notConfigured'),
          provider: 'gemini',
        });
      })
      .finally(() => setLoading(false));

    fetch('/api/telegram/config')
      .then((r) => r.json())
      .then((d) => setTelegramConfigured(!!d?.configured))
      .catch(() => setTelegramConfigured(false));

    fetch('/api/whatsapp/config')
      .then((r) => r.json())
      .then((d) => setWhatsappConfigured(!!d?.configured))
      .catch(() => setWhatsappConfigured(false));

    fetch('/api/tenant/database')
      .then((r) => r.json())
      .then((d) => setDatabaseConfigured(!!d?.data?.hasExternalDb))
      .catch(() => setDatabaseConfigured(false));

    fetch('/api/v1/exchange/token', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setExchangeToken({ hasToken: !!d?.hasToken, masked: d?.masked ?? null }))
      .catch(() => setExchangeToken(null));
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="success">
            <Check className="w-3 h-3" />
            {tSettings('connected')}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="danger">
            <X className="w-3 h-3" />
            {tSettings('keyError')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{tCommon('notConfigured')}</Badge>;
    }
  };

  const connBadge = (value: boolean | null) => {
    if (value === null) return <Badge variant="outline">…</Badge>;
    return value ? statusBadge('connected') : statusBadge('not_configured');
  };

  const handleExchangeAction = async (action: 'generate' | 'revoke') => {
    if (action === 'revoke' && !window.confirm(t('confirmRevoke'))) return;
    setExchangeBusy(true);
    setExchangeMessage(null);
    setExchangeCopied(false);
    try {
      const res = await fetch('/api/v1/exchange/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setExchangeToken({ hasToken: !!data?.hasToken, masked: data?.masked ?? null });
      setExchangeNewToken(action === 'generate' ? (data?.token ?? null) : null);
      setExchangeMessage(t(action === 'generate' ? 'generated' : 'revoked'));
    } catch {
      setExchangeMessage(t('error'));
    } finally {
      setExchangeBusy(false);
    }
  };

  const copyExchangeToken = async () => {
    if (!exchangeNewToken) return;
    try {
      await navigator.clipboard.writeText(exchangeNewToken);
      setExchangeCopied(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← {tCommon('back')}
        </Link>
        <h1 className="text-2xl font-bold">{tSettings('integrations')}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* AI Provider */}
        <Card className="sm:col-span-2 bg-card border-border shadow-sm rounded-xl border-primary/20">
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
                <CardDescription>{tSettings('aiCopilotCardDescription')}</CardDescription>
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
                  <p className="text-sm font-medium">{tSettings('quickApiKeys')}</p>
                  <p className="text-xs text-foreground-muted">{tSettings('quickApiKeysHint')}</p>
                </div>
              </Link>

              <Link
                href="/dashboard/settings/ai-usage"
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/50 transition-all"
              >
                <BarChart3 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{tSettings('quickUsage')}</p>
                  <p className="text-xs text-foreground-muted">{tSettings('quickUsageHint')}</p>
                </div>
              </Link>

              <Link
                href="/dashboard/copilot/logs"
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/50 transition-all"
              >
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{tSettings('quickLogs')}</p>
                  <p className="text-xs text-foreground-muted">{tSettings('quickLogsHint')}</p>
                </div>
              </Link>
            </div>

            {aiStatus?.maskedKey && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/50">
                <Key className="w-4 h-4 text-foreground-muted" />
                <span className="text-sm font-mono text-foreground-muted">
                  {aiStatus.maskedKey}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Telegram */}
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Telegram
              {connBadge(telegramConfigured)}
            </CardTitle>
            <CardDescription>{tSettings('integrationsTelegramDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Link href="/dashboard/settings/telegram">
              <Button variant="outline" size="sm">
                {tSettings('configureBot')}
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              WhatsApp Business
              {connBadge(whatsappConfigured)}
            </CardTitle>
            <CardDescription>{tSettings('integrationsWhatsappDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Link href="/dashboard/settings/whatsapp">
              <Button variant="outline" size="sm">
                {tSettings('configureApi')}
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Database */}
        <Card className="sm:col-span-2 bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              {tSettings('databaseCardTitle')}
              {connBadge(databaseConfigured)}
            </CardTitle>
            <CardDescription>{tSettings('integrationsDatabaseDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Link href="/dashboard/settings/database">
              <Button variant="outline" size="sm">
                {tSettings('configureConnection')}
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 1C Exchange */}
        <Card className="sm:col-span-2 bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              {t('title')}
              {connBadge(exchangeToken?.hasToken ?? null)}
            </CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exchangeToken?.hasToken && exchangeToken.masked && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/50">
                <Key className="w-4 h-4 text-foreground-muted" />
                <span className="text-sm font-mono text-foreground-muted">
                  {exchangeToken.masked}
                </span>
              </div>
            )}

            {exchangeNewToken && (
              <div className="p-3 rounded-xl bg-accent/50 space-y-2">
                <p className="text-xs text-foreground-muted">{t('oneTime')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono break-all">{exchangeNewToken}</span>
                  <Button variant="outline" size="sm" onClick={copyExchangeToken}>
                    {exchangeCopied ? t('copied') : t('copy')}
                  </Button>
                </div>
              </div>
            )}

            {exchangeMessage && <p className="text-sm text-foreground-muted">{exchangeMessage}</p>}

            <div className="flex items-center justify-between gap-3">
              <a
                href="https://github.com/dimakuhtin8-cmyk/crm-next/blob/main/docs/1c-integration.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {t('docs')}
              </a>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExchangeAction('generate')}
                  disabled={exchangeBusy}
                >
                  {t('generate')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExchangeAction('revoke')}
                  disabled={exchangeBusy}
                >
                  {t('revoke')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
