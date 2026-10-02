'use client';

import { Key, Eye, EyeOff, Check, X, Loader2, ExternalLink, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import { DataError } from '@/components/data-error';
import { QuickSelect } from '@/components/quick-create';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Badge,
  Skeleton,
} from '@/components/ui';
import { AI_PROVIDERS, getProvider } from '@/lib/ai/providers';
import { ApiError, apiGet } from '@/lib/client-api';

interface TestResult {
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  provider: string;
  model: string;
  lastChecked: Date;
  latencyMs: number;
}

export default function AiKeysSettingsPage() {
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [fallbackProvider, setFallbackProvider] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Live model list for the selected provider (dynamic, server-cached).
  const [dynamicModels, setDynamicModels] = useState<{ id: string; name: string }[] | null>(null);

  interface SavedKey {
    provider: string;
    hasKey: boolean;
    maskedKey: string;
    updatedAt: string | null;
  }
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [keysLoading, setKeysLoading] = useState(true);

  const refreshSavedKeys = async () => {
    setKeysError(null);
    try {
      const data = await apiGet<{ keys?: SavedKey[] }>('/api/ai/keys');
      setSavedKeys(data.keys || []);
    } catch (err) {
      setSavedKeys([]);
      setKeysError(err instanceof ApiError ? err.message : 'Помилка завантаження ключів');
    } finally {
      setKeysLoading(false);
    }
  };

  const currentProvider = getProvider(selectedProvider);

  useEffect(() => {
    fetch('/api/ai', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.provider) setSelectedProvider(d.provider);
      })
      .catch(() => {
        // фонове визначення провайдера: мовчазно, дефолт gemini
        console.warn('[ai-keys] provider detect failed, using default');
      });

    // Load current settings
    fetch('/api/ai/usage', { credentials: 'include' })
      .then((r) => r.json())
      .then(() => {
        // Usage endpoint doesn't return settings, but we can infer from AI status
      })
      .catch(() => {
        // фонова статистика: не блокує сторінку
        console.warn('[ai-keys] usage stats failed');
      });

    refreshSavedKeys();
  }, []);

  useEffect(() => {
    if (currentProvider && !selectedModel) {
      setSelectedModel(currentProvider.models[0]?.id || '');
    }
  }, [selectedProvider, currentProvider, selectedModel]);

  useEffect(() => {
    setDynamicModels(null);
    fetch(`/api/ai/models?provider=${selectedProvider}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.models) && d.models.length > 0 && d.source !== 'static') {
          setDynamicModels(d.models);
        }
      })
      .catch(() => {
        // фоновий список моделей: мовчазно, fallback — статичний список
        console.warn('[ai-keys] dynamic models failed, using static list');
      });
  }, [selectedProvider]);

  const handleTestKey = async (): Promise<TestResult | null> => {
    if (!apiKey.trim()) return null;
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
      const result = (await res.json()) as TestResult;
      setTestResult(result);
      return result;
    } catch {
      const fallback: TestResult = {
        status: 'error',
        message: "Помилка з'єднання з сервером",
        provider: selectedProvider,
        model: selectedModel || 'unknown',
        lastChecked: new Date(),
        latencyMs: 0,
      };
      setTestResult(fallback);
      return fallback;
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaveError(null);

    // First click tests the key AND continues to save — no dead clicks.
    let result = testResult;
    if (!result) {
      result = await handleTestKey();
      if (!result) return;
    }

    // If test failed, require explicit confirmation
    if (result.status === 'error') {
      if (!window.confirm(`Тест показав помилку: ${result.message}. Зберегти попри помилку?`)) {
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
        refreshSavedKeys();
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error || `Не вдалося зберегти (статус ${res.status})`);
      }
    } catch {
      setSaveError("Помилка з'єднання з сервером");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!window.confirm(`Видалити ключ ${getProvider(provider)?.name || provider}?`)) return;
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) refreshSavedKeys();
      else setSaveError('Не вдалося видалити ключ');
    } catch {
      setSaveError("Помилка з'єднання з сервером");
    }
  };

  const handleActivateKey = async (provider: string) => {
    try {
      const res = await fetch('/api/ai/quick-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        setSelectedProvider(provider);
        setSaved(true);
        refreshSavedKeys();
        setTimeout(() => setSaved(false), 3000);
      } else {
        setSaveError('Не вдалося активувати ключ');
      }
    } catch {
      setSaveError("Помилка з'єднання з сервером");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">API-ключі AI</h1>
      </div>

      {/* Security Notice */}
      <Card className="border-success/20 bg-success/5 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-success mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-success">Безпечне зберігання</p>
              <p className="text-xs text-foreground-muted mt-1">
                API-ключі шифруються AES-256-GCM перед збереженням у базі даних. Ми ніколи не
                повертаємо розшифрований ключ з сервера.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Оберіть провайдера</CardTitle>
          <CardDescription>Активний AI-провайдер для вашого тенанту</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {AI_PROVIDERS.filter((p) => p.id !== 'custom').map((p) => (
              <Card
                key={p.id}
                className={`bg-card relative p-3.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                  selectedProvider === p.id
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border/60 hover:border-primary/40 hover:bg-accent/50 shadow-sm'
                }`}
                onClick={() => {
                  setSelectedProvider(p.id);
                  setSelectedModel(p.models[0]?.id || '');
                  setApiKey('');
                  setTestResult(null);
                }}
              >
                <CardContent className="p-0">
                  <div className="flex items-center gap-2.5">
                    <img src={p.logo} alt={p.name} className="h-6 w-6 shrink-0 rounded" />
                    <span className="text-xs font-semibold leading-tight text-foreground">
                      {p.name}
                    </span>
                  </div>
                </CardContent>
                {selectedProvider === p.id && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </Card>
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
      <Card className="bg-card border-border shadow-sm rounded-xl">
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
          {/* Model selection (dynamic list when available, static fallback otherwise) */}
          {currentProvider && currentProvider.models.length > 0 && (
            <div>
              <QuickSelect
                value={selectedModel}
                onChange={setSelectedModel}
                options={(dynamicModels && dynamicModels.length > 0
                  ? dynamicModels.map((m) => ({ id: m.id, name: m.name, description: '' }))
                  : currentProvider.models
                ).map((m) => ({
                  id: m.id,
                  name: m.description ? `${m.name} — ${m.description}` : m.name,
                }))}
                label="Модель"
              />
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
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestResult(null);
                  }}
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
              className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground shadow-lg shadow-primary/20"
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

          {/* Save error (previously swallowed silently) */}
          {saveError && (
            <div className="p-3 rounded-xl border border-danger/30 bg-danger/5">
              <p className="text-sm font-medium text-danger">Не збережено</p>
              <p className="text-xs text-foreground-muted mt-0.5">{saveError}</p>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border ${
                testResult.status === 'connected'
                  ? 'border-success/30 bg-success/5'
                  : 'border-danger/30 bg-danger/5'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testResult.status === 'connected' ? (
                  <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      testResult.status === 'connected' ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {testResult.status === 'connected' ? 'Підключено' : 'Помилка'}
                  </p>
                  <p className="text-xs text-foreground-muted mt-0.5">{testResult.message}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved keys per provider */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Збережені ключі</CardTitle>
          <CardDescription>
            По одному ключу на провайдера — перемикайтесь без повторного вводу
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keysError ? (
            <DataError message={keysError} onRetry={refreshSavedKeys} />
          ) : keysLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ) : savedKeys.length === 0 ? (
            <p className="text-sm text-foreground-muted">Поки що немає збережених ключів.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedKeys.map((k) => (
                <Card key={k.provider} className="bg-card border-border shadow-sm rounded-xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {getProvider(k.provider)?.logo ? (
                          <img
                            src={getProvider(k.provider)!.logo}
                            alt=""
                            className="h-5 w-5 shrink-0 rounded"
                          />
                        ) : (
                          <Key className="h-4 w-4 shrink-0 text-foreground-muted" />
                        )}
                        <span className="text-sm font-semibold truncate">
                          {getProvider(k.provider)?.name || k.provider}
                        </span>
                      </div>
                      {selectedProvider === k.provider ? (
                        <Badge variant="success">Активний</Badge>
                      ) : (
                        <Badge variant="secondary">Збережено</Badge>
                      )}
                    </div>
                    <code className="block text-xs font-mono text-foreground-muted">
                      {k.maskedKey}
                    </code>
                    <div className="flex justify-end gap-2">
                      {selectedProvider !== k.provider && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivateKey(k.provider)}
                        >
                          Активувати
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteKey(k.provider)}
                        className="text-danger hover:text-danger"
                      >
                        Видалити
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fallback Provider */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Резервний провайдер</CardTitle>
          <CardDescription>
            Автоматичне переключення при помилці основного провайдера
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuickSelect
            value={fallbackProvider}
            onChange={setFallbackProvider}
            options={[
              { id: '', name: 'Не налаштовано' },
              ...AI_PROVIDERS.filter((p) => p.id !== selectedProvider && p.id !== 'custom').map(
                (p) => ({ id: p.id, name: p.name }),
              ),
            ]}
            placeholder="Не налаштовано"
          />
        </CardContent>
      </Card>
    </div>
  );
}
