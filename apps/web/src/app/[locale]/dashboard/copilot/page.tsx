'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, Save, ExternalLink, Search, Send, Paperclip, ChevronDown } from 'lucide-react';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { AI_PROVIDERS, getProvider } from '@/lib/ai/providers';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function CopilotPage() {
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'no-key'>('checking');
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [quickKey, setQuickKey] = useState('');
  const [quickModel, setQuickModel] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatModel, setSelectedChatModel] = useState('gemini-2.5-flash');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentProvider = getProvider(selectedProvider);

  useEffect(() => {
    fetch('/api/ai', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAiStatus(d.available ? 'ready' : 'no-key'))
      .catch(() => setAiStatus('no-key'));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleQuickSetup = async () => {
    if (!quickKey.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch('/api/ai/quick-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: quickKey, provider: selectedProvider, model: quickModel || undefined }),
      });
      if (res.ok) {
        setAiStatus('ready');
        setQuickKey('');
        if (quickModel) setSelectedChatModel(quickModel);
      }
    } catch {} finally {
      setSavingKey(false);
    }
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    const p = getProvider(providerId);
    setQuickModel(p?.models[0]?.id || '');
    setQuickKey('');
  };

  const sendMessage = async () => {
    const text = inputValue.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'custom',
          data: { prompt: text },
        }),
      });
      const json = await res.json();
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.ok ? (json.result || json.response || 'Відповідь отримана') : (json.error || 'Помилка генерації'),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Помилка з\'єднання з AI. Перевірте підключення.',
        timestamp: new Date(),
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getAllModels = () => {
    const all: { provider: string; providerName: string; modelId: string; name: string; description: string }[] = [];
    AI_PROVIDERS.forEach(p => {
      p.models.forEach(m => {
        all.push({
          provider: p.id,
          providerName: p.name,
          modelId: m.id,
          name: m.name,
          description: m.description,
        });
      });
    });
    return all;
  };

  const currentModelName = (() => {
    for (const p of AI_PROVIDERS) {
      const m = p.models.find(m => m.id === selectedChatModel);
      if (m) return m.name;
    }
    return selectedChatModel;
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">AI Co-Pilot</h1>
        <p className="text-foreground-muted">Штучний інтелект для генерації, аналізу та пошуку</p>
      </div>

      {/* Quick Setup Panel */}
      {aiStatus === 'no-key' && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Підключіть AI</h3>
            </div>
            <p className="text-sm text-foreground-muted mb-5 ml-[52px]">
              Оберіть провайдера та введіть API-ключ. Це займає 30 секунд.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              {AI_PROVIDERS.filter(p => p.id !== 'custom').map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p.id)}
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
              <div className="p-4 rounded-xl bg-accent/50 border border-border/40 mb-5">
                <p className="text-sm text-foreground-muted">{currentProvider.description}</p>
                <p className="text-xs text-foreground-muted mt-1">
                  <span className="font-medium">Безкоштовний тариф:</span> {currentProvider.freeQuota}
                </p>
              </div>
            )}

            {currentProvider && currentProvider.models.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground-muted mb-1.5">Модель</label>
                <select
                  value={quickModel}
                  onChange={(e) => setQuickModel(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                >
                  {currentProvider.models.map(m => (
                    <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2.5">
              <Input
                type="password"
                placeholder={currentProvider?.keyPlaceholder || 'API-ключ'}
                value={quickKey}
                onChange={(e) => setQuickKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickSetup()}
                className="flex-1 font-mono text-sm"
              />
              <Button
                onClick={handleQuickSetup}
                disabled={savingKey || !quickKey.trim()}
                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-700 text-white shadow-lg shadow-primary/20 px-6"
              >
                {savingKey ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Зберегти
                  </span>
                )}
              </Button>
            </div>

            {currentProvider?.keyUrl && (
              <a
                href={currentProvider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:text-primary-hover font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Отримати API-ключ {currentProvider.name}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {aiStatus === 'ready' && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-green-600">✅ AI підключено</span>
        </div>
      )}

      {/* === CHAT PANEL (Claude-style) === */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Chat messages area */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Як я можу допомогти?</h3>
                <p className="text-sm text-foreground-muted max-w-sm">
                  Задайте питання про ваші контакти, угоди або завдання. Я проаналізую дані та допоможу.
                </p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {['Покажи топ угод', 'Згенеруй КП', 'План на сьогодні', 'Аналіз контактів'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInputValue(q); inputRef.current?.focus(); }}
                      className="px-3 py-1.5 text-xs rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-1'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-foreground-muted">AI Co-Pilot</span>
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-accent/60 text-foreground rounded-bl-md'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-foreground-muted">AI Co-Pilot</span>
                  </div>
                  <div className="bg-accent/60 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-foreground-muted/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-foreground-muted/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-foreground-muted/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-4">
            <div className="relative">
              <div className="flex items-end gap-2 bg-accent/40 rounded-2xl border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all px-4 py-3">
                <button className="shrink-0 p-1 rounded-lg hover:bg-accent transition-colors text-foreground-muted hover:text-foreground">
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Напишіть повідомлення..."
                  rows={1}
                  className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-foreground placeholder:text-foreground-muted/60 min-h-[24px] max-h-[120px] leading-relaxed"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || chatLoading}
                  className="shrink-0 p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom bar: model picker + disclaimer */}
              <div className="flex items-center justify-between mt-2 px-1">
                <p className="text-[11px] text-foreground-muted/60">
                  AI може помилятися. Перевіряйте важливу інформацію.
                </p>

                {/* Model picker */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent"
                  >
                    <span className="font-medium">{currentModelName}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showModelPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
                      <div className="absolute bottom-full right-0 mb-2 w-80 max-h-[400px] overflow-y-auto bg-background border border-border rounded-xl shadow-xl z-50 p-2">
                        {AI_PROVIDERS.filter(p => p.id !== 'custom').map(p => (
                          <div key={p.id}>
                            <div className="px-3 py-1.5 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                              {p.name}
                            </div>
                            {p.models.map(m => (
                              <button
                                key={m.id}
                                onClick={() => { setSelectedChatModel(m.id); setShowModelPicker(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                  selectedChatModel === m.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-accent text-foreground'
                                }`}
                              >
                                <div className="font-medium">{m.name}</div>
                                <div className="text-xs text-foreground-muted mt-0.5">{m.description}</div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
