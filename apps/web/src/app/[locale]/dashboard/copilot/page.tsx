'use client';

import {
  Bot,
  Save,
  ExternalLink,
  Send,
  Paperclip,
  ChevronDown,
  Plus,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

import { QuickSelect } from '@/components/quick-create';
import { useTourAutoStart } from '@/components/tour/tour-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Textarea,
} from '@/components/ui';
import { AI_PROVIDERS, getProvider } from '@/lib/ai/providers';
import { useLocalePath } from '@/lib/use-locale-path';

/** Стартові підказки — питання, що працюють на реальних даних (знімок CRM). */
const STARTER_QUESTIONS = [
  'Як справи з продажами?',
  'Які угоди під ризиком?',
  'Кому подзвонити сьогодні?',
  'Підсумок за тиждень',
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{ id: string; type: string; name: string }>;
}

const THINKING_STEPS = ['Шукаю дані в CRM…', 'Аналізую дані CRM…', 'Формулюю відповідь…'];

/** Живой статус "думаю": ротация этапов + пульсация, чтобы не выглядело зависшим. */
function ThinkingStatus() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % THINKING_STEPS.length), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-xs text-foreground-muted animate-pulse">{THINKING_STEPS[step]}</span>
  );
}

/** Мини-рендер markdown ответов AI: **жирный** + *-списки (без внешних зависимостей). */
function renderRichText(text: string) {
  return text.split('\n').map((line, i) => {
    const bullet = line.match(/^\s*[*-]\s+(.*)$/);
    const body = bullet ? bullet[1] : line;
    const parts = body.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
        <strong key={j} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      ) : (
        <span key={j}>{p}</span>
      ),
    );
    if (bullet) {
      return (
        <div key={i} className="flex gap-2">
          <span className="shrink-0">•</span>
          <span>{parts}</span>
        </div>
      );
    }
    return (
      <div key={i} className="min-h-[1.25em]">
        {parts}
      </div>
    );
  });
}

export default function CopilotPage() {
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'no-key'>('checking');
  const lp = useLocalePath();
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [quickKey, setQuickKey] = useState('');
  const [quickModel, setQuickModel] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useTourAutoStart('copilot', aiStatus === 'ready');
  const [inputValue, setInputValue] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatModel, setSelectedChatModel] = useState('gemini-3-flash-preview');
  const [showModelPicker, setShowModelPicker] = useState(false);
  // Бейдж "підключено" — только один раз сразу после подключения, затем пропадает.
  const [justConnected, setJustConnected] = useState(false);
  // Live model lists per provider (dynamic, 24h cached server-side).
  // Falls back to the static providers.ts list when unavailable.
  const [dynamicModels, setDynamicModels] = useState<
    Record<string, { id: string; name: string }[]>
  >({});
  // Chat sessions (persistent history in DB).
  const [sessions, setSessions] = useState<
    { id: string; title: string | null; createdAt: string; updatedAt: string }[]
  >([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchParams = useSearchParams();
  // Level-1 grounding: entity of the page the chat was opened from.
  const contextContactId = searchParams.get('contactId');
  const contextDealId = searchParams.get('dealId');

  const currentProvider = getProvider(selectedProvider);

  useEffect(() => {
    fetch(`/api/ai/models?provider=${selectedProvider}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.models) && d.models.length > 0 && d.source !== 'static') {
          setDynamicModels((prev) => ({ ...prev, [selectedProvider]: d.models }));
        }
      })
      .catch(() => {
        // фоновий список моделей: мовчазно, fallback — статичний список
        console.warn('[copilot] dynamic models failed');
      });
  }, [selectedProvider]);

  useEffect(() => {
    fetch('/api/ai', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setAiStatus(d.available ? 'ready' : 'no-key'))
      .catch(() => setAiStatus('no-key'));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const loadSessions = async () => {
    try {
      const r = await fetch('/api/ai/sessions', { credentials: 'include' });
      if (!r.ok) return;
      const d = await r.json();
      const list = Array.isArray(d.sessions) ? d.sessions : [];
      setSessions(list);
      return list;
    } catch {
      // список сессий не критичен для чата
    }
    return [];
  };

  useEffect(() => {
    if (aiStatus !== 'ready') return;
    loadSessions().then((list) => {
      if (list && list.length > 0 && !activeSessionId) {
        openSession(list[0].id);
      }
    });
  }, [aiStatus]);

  const openSession = async (id: string) => {
    setActiveSessionId(id);
    try {
      const r = await fetch(`/api/ai/sessions/${id}`, { credentials: 'include' });
      if (!r.ok) return;
      const d = await r.json();
      const msgs: ChatMessage[] = (Array.isArray(d.messages) ? d.messages : []).map(
        (m: {
          id: string;
          role: string;
          content: string;
          groundedOn?: string | null;
          createdAt: string;
        }) => {
          let sources: ChatMessage['sources'];
          if (m.groundedOn) {
            try {
              const parsed = JSON.parse(m.groundedOn);
              if (Array.isArray(parsed)) sources = parsed;
            } catch {
              // битый groundedOn — чипы просто не покажем
            }
          }
          return {
            id: m.id,
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
            timestamp: new Date(m.createdAt),
            sources,
          };
        },
      );
      setMessages(msgs);
    } catch {
      // открытие сессии не критично
    }
  };

  const newSession = async () => {
    try {
      const r = await fetch('/api/ai/sessions', {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) return;
      const d = await r.json();
      setMessages([]);
      setActiveSessionId(d.session.id);
      loadSessions();
    } catch {
      // создание сессии не критично
    }
  };

  const deleteSession = async (id: string) => {
    if (!window.confirm('Видалити цю розмову?')) return;
    try {
      const r = await fetch(`/api/ai/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) return;
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch {
      // удаление не критично
    }
  };

  const handleQuickSetup = async () => {
    if (!quickKey.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch('/api/ai/quick-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: quickKey,
          provider: selectedProvider,
          model: quickModel || undefined,
        }),
      });
      if (res.ok) {
        setAiStatus('ready');
        setQuickKey('');
        if (quickModel) setSelectedChatModel(quickModel);
        setJustConnected(true);
        setTimeout(() => setJustConnected(false), 10000);
      }
    } catch {
      // ошибка сохранения ключа — сообщение уже показано выше
    } finally {
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

    // Session first: history lives in DB, frontend never sends it.
    let sid = activeSessionId;
    if (!sid) {
      try {
        const r = await fetch('/api/ai/sessions', { method: 'POST', credentials: 'include' });
        if (r.ok) {
          const d = await r.json();
          sid = d.session.id;
          setActiveSessionId(sid);
        }
      } catch {
        // без сессии — одноразовый запрос без истории
      }
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'custom',
          data: {
            prompt: text,
            model: selectedChatModel || undefined,
            sessionId: sid || undefined,
            contactId: contextContactId || undefined,
            dealId: contextDealId || undefined,
          },
        }),
      });
      const json = await res.json();
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.ok
          ? json.result || json.response || 'Відповідь отримана'
          : json.error || 'Помилка генерації',
        timestamp: new Date(),
        sources: Array.isArray(json.sources) ? json.sources : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (res.ok && json.sessionId) {
        setActiveSessionId(json.sessionId);
        loadSessions();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Помилка з'єднання з AI. Перевірте підключення.",
          timestamp: new Date(),
        },
      ]);
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

  const currentModelName = (() => {
    for (const p of AI_PROVIDERS) {
      const dyn = (
        dynamicModels[p.id] && dynamicModels[p.id].length > 0 ? dynamicModels[p.id] : p.models
      ).find((m) => m.id === selectedChatModel);
      if (dyn) return dyn.name;
    }
    return selectedChatModel;
  })();

  return (
    <div className="w-full h-[calc(100dvh-112px)] min-h-[480px] flex flex-col gap-4">
      {/* Quick Setup Panel */}
      {aiStatus === 'no-key' && (
        <Card className="shrink-0 border-primary/30 bg-gradient-to-br from-primary/5 to-background overflow-hidden shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10">
                <Bot className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className="font-semibold text-lg">Підключіть AI</h3>
            </div>
            <p className="text-sm text-foreground-muted mb-5 ml-[52px]">
              Оберіть провайдера та введіть API-ключ. Це займає 30 секунд.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
              {AI_PROVIDERS.filter((p) => p.id !== 'custom').map((p) => (
                <Card
                  key={p.id}
                  onClick={() => handleProviderSelect(p.id)}
                  className={`relative cursor-pointer border-2 p-3.5 text-left transition-all duration-200 ${
                    selectedProvider === p.id
                      ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                      : 'border-border/60 hover:border-primary/40 hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img src={p.logo} alt={p.name} className="h-6 w-6 shrink-0 rounded" />
                    <span className="text-xs font-semibold leading-tight text-foreground">
                      {p.name}
                    </span>
                  </div>
                  {selectedProvider === p.id && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </Card>
              ))}
            </div>

            {currentProvider && (
              <div className="p-4 rounded-xl bg-accent/50 border border-border/40 mb-5">
                <p className="text-sm text-foreground-muted">{currentProvider.description}</p>
                <p className="text-xs text-foreground-muted mt-1">
                  <span className="font-medium">Безкоштовний тариф:</span>{' '}
                  {currentProvider.freeQuota}
                </p>
              </div>
            )}

            {currentProvider && currentProvider.models.length > 0 && (
              <div className="mb-4">
                <QuickSelect
                  value={quickModel}
                  onChange={setQuickModel}
                  options={currentProvider.models.map((m) => ({
                    id: m.id,
                    name: `${m.name} — ${m.description}`,
                  }))}
                  label="Модель"
                />
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
                className="bg-indigo-500 px-6 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-600"
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

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <Link
                href={lp('/dashboard/settings/ai-keys')}
                className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground font-medium transition-colors"
              >
                Усі налаштування AI-провайдерів →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {aiStatus === 'ready' && justConnected && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-success">✅ AI підключено</span>
        </div>
      )}

      {/* === CONTENT ROW: sessions + chat (лише з підключеним AI) === */}
      {aiStatus === 'ready' && (
        <div className="flex-1 min-h-0 flex gap-4">
          {/* Sessions aside */}
          {aiStatus === 'ready' && (
            <aside
              className="hidden md:flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
              data-tour="copilot-sessions"
            >
              <div className="shrink-0 p-3 border-b border-border">
                <Button onClick={newSession} className="w-full" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Нова розмова
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
                {sessions.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-foreground-muted">
                    Поки що немає розмов
                  </p>
                )}
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1 rounded-xl px-2 py-2 cursor-pointer transition-colors ${
                      activeSessionId === s.id ? 'bg-primary/10' : 'hover:bg-accent'
                    }`}
                    onClick={() => openSession(s.id)}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-foreground-muted" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{s.title || 'Нова розмова'}</p>
                      <p className="text-[11px] text-foreground-muted">
                        {new Date(s.updatedAt).toLocaleDateString('uk-UA', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Видалити"
                      aria-label="Видалити розмову"
                      className="h-7 w-7 shrink-0 text-foreground-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </aside>
          )}

          {/* === CHAT PANEL (Claude-style, full-page) === */}
          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden shadow-sm">
            <CardContent className="flex-1 min-h-0 flex flex-col p-0">
              {/* Chat messages area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                      <Bot className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">Як я можу допомогти?</h3>
                    <p className="text-sm text-foreground-muted max-w-sm">
                      Задайте питання про ваші контакти, угоди або завдання. Я проаналізую дані та
                      допоможу.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4 justify-center">
                      {STARTER_QUESTIONS.map((q) => (
                        <Button
                          key={q}
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full px-3 font-normal"
                          onClick={() => {
                            setInputValue(q);
                            inputRef.current?.focus();
                          }}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-1'}`}>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <Bot className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <Badge className="border-transparent bg-indigo-500/10 text-indigo-500 shadow-sm shadow-indigo-500/20 hover:bg-indigo-500/10">
                            AI Co-Pilot
                          </Badge>
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-accent/60 text-foreground rounded-bl-md'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">
                          {msg.role === 'assistant' ? renderRichText(msg.content) : msg.content}
                        </div>
                        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                            <span className="text-[11px] text-foreground-muted">На основі:</span>
                            {msg.sources.map((s) => (
                              <span
                                key={`${s.type}-${s.id}`}
                                className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                                title={`${s.type === 'contact' ? 'Контакт' : 'Угода'}: ${s.name}`}
                              >
                                {s.type === 'contact' ? '👤' : '💼'} {s.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                          <Bot className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <Badge className="border-transparent bg-indigo-500/10 text-indigo-500 shadow-sm shadow-indigo-500/20 hover:bg-indigo-500/10">
                          AI Co-Pilot
                        </Badge>
                      </div>
                      <div className="bg-accent/60 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 bg-indigo-500/70 rounded-full animate-bounce"
                              style={{ animationDelay: '0ms' }}
                            />
                            <div
                              className="w-2 h-2 bg-indigo-500/70 rounded-full animate-bounce"
                              style={{ animationDelay: '150ms' }}
                            />
                            <div
                              className="w-2 h-2 bg-indigo-500/70 rounded-full animate-bounce"
                              style={{ animationDelay: '300ms' }}
                            />
                          </div>
                          <ThinkingStatus />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="shrink-0 border-t border-border p-4">
                <div className="relative">
                  <div
                    className="flex items-end gap-2 bg-accent/40 rounded-2xl border border-border focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all px-4 py-3"
                    data-tour="copilot-input"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Прикріпити файл"
                      className="h-8 w-8 shrink-0 rounded-lg text-foreground-muted hover:text-foreground"
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                    <Textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={chatLoading}
                      placeholder={
                        chatLoading ? 'AI відповідає — зачекайте…' : 'Напишіть повідомлення...'
                      }
                      rows={1}
                      className="min-h-[24px] max-h-[120px] flex-1 border-0 bg-transparent px-0 py-0 leading-relaxed placeholder:text-foreground-muted/60 shadow-none focus-visible:ring-0 resize-none"
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                      }}
                    />
                    <Button
                      size="icon"
                      aria-label="Надіслати"
                      onClick={sendMessage}
                      disabled={!inputValue.trim() || chatLoading}
                      className="h-8 w-8 shrink-0 rounded-lg bg-indigo-500 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-600 disabled:opacity-30"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Bottom bar: model picker + disclaimer */}
                  <div className="flex items-center justify-between mt-2 px-1">
                    <p className="text-[11px] text-foreground-muted/60">
                      AI може помилятися. Перевіряйте важливу інформацію.
                    </p>

                    {/* Model picker */}
                    <div className="relative" data-tour="copilot-model">
                      <DropdownMenu open={showModelPicker} onOpenChange={setShowModelPicker}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 px-2 text-xs text-foreground-muted hover:text-foreground"
                          >
                            <span className="font-medium">{currentModelName}</span>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          side="top"
                          className="max-h-[400px] w-80 overflow-y-auto p-2"
                        >
                          {AI_PROVIDERS.filter((p) => p.id !== 'custom').map((p) => {
                            const models =
                              dynamicModels[p.id] && dynamicModels[p.id].length > 0
                                ? dynamicModels[p.id].map((m) => ({
                                    id: m.id,
                                    name: m.name,
                                    description: '',
                                  }))
                                : p.models;
                            return (
                              <div key={p.id}>
                                <DropdownMenuLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                  {p.name}
                                </DropdownMenuLabel>
                                {models.map((m) => (
                                  <DropdownMenuItem
                                    key={m.id}
                                    onClick={() => {
                                      setSelectedChatModel(m.id);
                                      setShowModelPicker(false);
                                    }}
                                    className={`flex-col items-start gap-0.5 px-3 py-2 ${
                                      selectedChatModel === m.id
                                        ? 'bg-indigo-500/10 text-indigo-500 focus:bg-indigo-500/10'
                                        : ''
                                    }`}
                                  >
                                    <span className="font-medium">{m.name}</span>
                                    <span className="text-xs text-foreground-muted mt-0.5">
                                      {m.description}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
