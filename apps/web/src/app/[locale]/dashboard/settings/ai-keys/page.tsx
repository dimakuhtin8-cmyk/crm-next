'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key, Eye, EyeOff, Check, X, Loader2, ExternalLink,
  Shield, AlertTriangle, ChevronDown, Zap,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Badge } from '@/components/ui';
import { AI_PROVIDERS, getProvider } from '@/lib/ai/providers';

interface TestResult {
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  provider: string;
  model: string;
  lastChecked: Date;
  latencyMs: number;
}

interface TenantSettings {
  provider: string;
  model: string;
  hasKey: boolean;
  maskedKey: string;
  fallbackProvider: string;
}

export default function AiKeysSettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [fallbackProvider, setFallbackProvider] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(false);

  const currentProvider = getProvider(selectedProvider);

  useEffect(() => {
    fetch('/api/ai', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.provider) setSelectedProvider(d.provider);
      })
      .catch(() => {});

    // Load current settings
    fetch('/api/ai/usage', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        // Usage endpoint doesn't return settings, but we can infer from AI status
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (currentProvider && !selectedModel) {
      setSelectedModel(currentProvider.models[0]?.id || '');
    }
  }, [selectedProvider, currentProvider, selectedModel]);

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          provider: selectedProvider,
          model: selectedModel || undefined,
        }),
      });
      const result = await res.json();
      setTestResult(result);
    } catch {
      setTestResult({
        status: 'error',
        message: 'Помилка з\'єднання з сервером',
        provider: selectedProvider,
        model: selectedModel || 'unknown',
        lastChecked: new Date(),
        latencyMs: 0,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;

    // If not tested yet, require test first
    if (!testResult) {
      await handleTestKey();
      return;
    }

    // If test failed, require explicit confirmation
    if (testResult.status === 'error') {
      if (!window.confirm('Тест показав помилку. Зберегти попри помилку?')) {
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/ai/quick-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          provider: selectedProvider,
          model: selectedModel || undefined,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setApiKey('');
        setShowKey(false);
        setTestResult(null);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  const maskKey = (key: string): string => {
    if (!key || key.length < 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">API-ключі AI</h1>
      </div>

      {/* Security Notice */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Безпечне зберігання
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                API-ключі шифруються AES-256-GCM перед збереженням у базі даних.
                Ми ніколи не повертаємо розшифрований ключ з сервера.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Оберіть провайдера</CardTitle>
          <CardDescription>Активний AI-провайдер для вашого тенанту</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {AI_PROVIDERS.filter(p => p.id !== 'custom').map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedProvider(p.id);
                  setSelectedModel(p.models[0]?.id || '');
                  setApiKey('');
                  setTestResult(null);
                }}
                className={`group relative p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                  selectedProvider === p.id
                    ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                    : 'border-border/60 hover:border-primary/40 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img src={p.logo} alt={p.name} className="h-6 w-6 shrink-0 rounded" />
                  <span className="text-xs font-semibold leading-tight text-foreground">{p.name}</span>
                </div>
                {selectedProvider === p.id && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {currentProvider && (
            <div className="p-4 rounded-xl bg-accent/50 border border-border/40">
              <p className="text-sm text-foreground-muted">{currentProvider.description}</p>
              <p className="text-xs text-foreground-muted mt-1">
                <span className="font-medium">Безкоштовний тариф:</span> {currentProvider.freeQuota}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Key Input */}
      <Card>
        <CardHeader>
          <CardTitle>API-ключ</CardTitle>
          <CardDescription>
            {currentProvider?.keyUrl && (
              <a
                href={currentProvider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Отримати ключ {currentProvider.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model selection */}
          {currentProvider && currentProvider.models.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">Модель</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              >
                {currentProvider.models.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
                ))}
              </select>
            </div>
          )}

          {/* API Key input */}
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1.5">
              API-ключ {currentProvider?.keyPlaceholder && `(${currentProvider.keyPlaceholder})`}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={currentProvider?.keyPlaceholder || 'Введіть API-ключ'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Test & Save buttons */}
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={handleTestKey}
              disabled={!apiKey.trim() || testing}
              className="flex-1"
            >
              {testing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Тестування...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Перевірити з'єднання
                </span>
              )}
            </Button>

            <Button
              onClick={handleSave}
              disabled={!apiKey.trim() || saving}
              className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-700 text-white shadow-lg shadow-primary/20"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
              ) : saved ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Збережено
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Зберегти ключ
                </span>
              )}
            </Button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-xl border ${
              testResult.status === 'connected'
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5'
            }`}>
              <div className="flex items-start gap-2.5">
                {testResult.status === 'connected' ? (
                  <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    testResult.status === 'connected' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                  }`}>
                    {testResult.status === 'connected' ? 'Підключено' : 'Помилка'}
                  </p>
                  <p className="text-xs text-foreground-muted mt-0.5">{testResult.message}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fallback Provider */}
      <Card>
        <CardHeader>
          <CardTitle>Резервний провайдер</CardTitle>
          <CardDescription>
            Автоматичне переключення при помилці основного провайдера
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={fallbackProvider}
            onChange={(e) => setFallbackProvider(e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          >
            <option value="">Не налаштовано</option>
            {AI_PROVIDERS.filter(p => p.id !== selectedProvider && p.id !== 'custom').map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </CardContent>
      </Card>
    </div>
  );
}
