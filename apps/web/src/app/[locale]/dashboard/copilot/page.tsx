'use client';

import { useState } from 'react';

import { Button, Card, CardContent, Input } from '@/components/ui';

export default function CopilotPage() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const handleGenerate = async (action: string, data?: Record<string, unknown>) => {
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: data || { prompt } }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult(json.error || 'Помилка');
        setStatus('error');
      } else {
        setResult(json.result);
        setStatus('ok');
      }
    } catch {
      setResult('Помилка з\'єднання з Ollama');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Co-Pilot</h1>
        <p className="text-foreground-muted">Штучний інтелект для генерації КП, повідомлень та аналізу</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleGenerate('custom', { prompt: 'Дай 5 ідей для залучення нових клієнтів у B2B сфері' })}>
          <CardContent className="p-5 text-center">
            <div className="text-3xl mb-2">💡</div>
            <p className="font-medium">Ідеї для продажів</p>
            <p className="text-xs text-foreground-muted mt-1">Згенерувати ідеї для залучення клієнтів</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleGenerate('custom', { prompt: 'Склади шаблон листа для першого контакту з потенційним клієнтом' })}>
          <CardContent className="p-5 text-center">
            <div className="text-3xl mb-2">✉️</div>
            <p className="font-medium">Шаблон листа</p>
            <p className="text-xs text-foreground-muted mt-1">Готовий лист для холодного контакту</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleGenerate('custom', { prompt: 'Як ефективно вести переговори про ціну? Дай 5 порад.' })}>
          <CardContent className="p-5 text-center">
            <div className="text-3xl mb-2">🤝</div>
            <p className="font-medium">Поради з переговорів</p>
            <p className="text-xs text-foreground-muted mt-1">Техніки ведення переговорів</p>
          </CardContent>
        </Card>
      </div>

      {/* Custom prompt */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium mb-3">Свій запит</h3>
          <div className="flex gap-3">
            <Input
              placeholder="Напишіть запит до AI..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && prompt.trim()) handleGenerate('custom'); }}
              className="flex-1"
            />
            <Button onClick={() => handleGenerate('custom')} disabled={loading || !prompt.trim()}>
              {loading ? 'Генерація...' : 'Згенерувати'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Результат</h3>
              {status === 'ok' && (
                <button onClick={() => navigator.clipboard.writeText(result)} className="text-sm text-primary hover:text-primary-hover transition-colors">
                  Копіювати
                </button>
              )}
            </div>
            <div className={`p-4 rounded-lg whitespace-pre-wrap text-sm ${status === 'error' ? 'bg-danger-light text-danger' : 'bg-secondary/50'}`}>
              {result}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ollama info */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium mb-2">Про AI Co-Pilot</h3>
          <p className="text-sm text-foreground-muted">
            AI Co-Pilot використовує Ollama для локальної генерації тексту. Потрібно встановити Ollama та модель (наприклад, llama3.2).
          </p>
          <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
            <code className="text-xs">
              {`# Встановлення Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Завантаження моделі
ollama pull llama3.2

# Перевірка
ollama list`}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
