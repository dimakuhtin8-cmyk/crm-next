'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Search,
  Send,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { LucideIcon } from 'lucide-react';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Separator,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';
import { ApiError, apiGet, apiSend } from '@/lib/client-api';
import { cn } from '@/lib/utils';

// ============ Types ============

type Channel = 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | 'SMS';
type ChannelFilter = 'ALL' | Channel;
type SenderType = 'CUSTOMER' | 'USER' | 'AI_AGENT';
type MessageStatus = 'DELIVERED' | 'READ' | 'FAILED';

interface ChatContact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
}

interface ChatPreview {
  id: string;
  content: string;
  senderType: SenderType;
  status: MessageStatus;
  createdAt: string;
}

interface ChatItem {
  id: string;
  channel: Channel;
  unreadCount: number;
  lastMessageAt: string;
  externalChatId: string;
  contact: ChatContact | null;
  lastMessage: ChatPreview | null;
}

interface MessageItem {
  id: string;
  senderType: SenderType;
  content: string;
  status: MessageStatus;
  mediaUrl?: string | null;
  createdAt: string;
}

const CHANNEL_META: Record<Channel, { label: string; icon: LucideIcon }> = {
  TELEGRAM: { label: 'Telegram', icon: Send },
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle },
  EMAIL: { label: 'Email', icon: Mail },
  SMS: { label: 'SMS', icon: Smartphone },
};

const POLL_INTERVAL_MS = 5000;

// ============ Helpers ============

function chatTitle(chat: ChatItem): string {
  if (!chat.contact) return 'Без контакту';
  return [chat.contact.firstName, chat.contact.lastName].filter(Boolean).join(' ');
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function previewText(chat: ChatItem): string {
  if (!chat.lastMessage) return 'Немає повідомлень';
  const prefix =
    chat.lastMessage.senderType === 'USER'
      ? 'Ви: '
      : chat.lastMessage.senderType === 'AI_AGENT'
        ? 'AI: '
        : '';
  return prefix + chat.lastMessage.content;
}

// ============ Message bubble ============

function MessageBubble({ message }: { message: MessageItem }) {
  const isMine = message.senderType === 'USER';

  return (
    <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2',
          isMine ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
        )}
      >
        {message.senderType === 'AI_AGENT' && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-foreground-muted">
            <Sparkles className="h-4 w-4" />
            AI
          </div>
        )}
        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-xs',
            isMine ? 'text-primary-foreground/70' : 'text-foreground-muted',
          )}
        >
          {isMine && message.status === 'FAILED' && (
            <span className="flex items-center gap-1 text-danger">
              <AlertCircle className="h-4 w-4" />
              Не надіслано
            </span>
          )}
          {isMine && message.status === 'DELIVERED' && <Check className="h-4 w-4" />}
          {isMine && message.status === 'READ' && <CheckCheck className="h-4 w-4" />}
          <span>{formatTime(message.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ============ Page ============

export default function MessagesPage() {
  // Legacy: позначаємо старі Telegram/WhatsApp чати прочитаними при відвідуванні
  // (бейдж у навігації оновиться наступним тиком).
  useEffect(() => {
    fetch('/api/messages/read', { method: 'POST' }).catch(() => {
      console.warn('[messages] mark-read failed');
    });
  }, []);

  // --- Chats list ---
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // --- Selected chat ---
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // --- Composer / AI ---
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHintVisible, setAiHintVisible] = useState(false);

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const selectedChatIdRef = useRef<string | null>(null);

  // Debounce пошуку (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    selectedChatIdRef.current = selectedChat?.id ?? null;
  }, [selectedChat]);

  const loadChats = useCallback(async () => {
    const params = new URLSearchParams({ limit: '50' });
    if (channelFilter !== 'ALL') params.set('channel', channelFilter);
    if (search) params.set('search', search);

    try {
      const data = await apiGet<{ chats: ChatItem[] }>(`/api/chats?${params.toString()}`);
      setChats(data.chats);
      setChatsError(null);

      // Відкритий чат: фоново скидаємо непрочитані, якщо прийшли нові
      const openChatId = selectedChatIdRef.current;
      if (openChatId) {
        const openChat = data.chats.find((c) => c.id === openChatId);
        if (openChat && openChat.unreadCount > 0) {
          apiSend(`/api/chats/${openChatId}/read`, 'PATCH').catch(() => {});
        }
      }
    } catch (err) {
      setChatsError(err instanceof ApiError ? err.message : 'Не вдалося завантажити чати');
    } finally {
      setChatsLoaded(true);
    }
  }, [channelFilter, search]);

  // Завантаження + автополінг списку чатів (5с, пауза у фоні)
  useEffect(() => {
    loadChats();
    const timer = setInterval(() => {
      if (!document.hidden) loadChats();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadChats]);

  const loadMessages = useCallback(async (chatId: string, silent: boolean) => {
    if (!silent) setMessagesLoading(true);
    try {
      const data = await apiGet<{ messages: MessageItem[] }>(
        `/api/chats/${chatId}/messages?limit=50`,
      );
      setMessages(data.messages);
      setMessagesError(null);
    } catch (err) {
      if (!silent) {
        setMessagesError(
          err instanceof ApiError ? err.message : 'Не вдалося завантажити повідомлення',
        );
      }
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  // Автополінг історії відкритого чату (5с, пауза у фоні)
  useEffect(() => {
    if (!selectedChat) return;
    const chatId = selectedChat.id;

    setMessages([]);
    setMessagesError(null);
    stickToBottomRef.current = true;
    loadMessages(chatId, false);

    const timer = setInterval(() => {
      if (!document.hidden) loadMessages(chatId, true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [selectedChat, loadMessages]);

  // Тримаємо стрічку біля низу (якщо користувач не скролив вгору)
  useEffect(() => {
    const el = timelineRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, messagesLoading]);

  const handleTimelineScroll = () => {
    const el = timelineRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const handleSelect = (chat: ChatItem) => {
    setSelectedChat(chat);
    setDraft('');
    setAiHintVisible(false);
    setMessages([]);
    setMessagesError(null);
    stickToBottomRef.current = true;
    selectedChatIdRef.current = chat.id;

    if (chat.unreadCount > 0) {
      apiSend(`/api/chats/${chat.id}/read`, 'PATCH').catch(() => {});
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)));
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !selectedChat || sending) return;

    setSending(true);
    try {
      const res = await apiSend<{ message: MessageItem }>(
        `/api/chats/${selectedChat.id}/messages`,
        'POST',
        { content },
      );
      stickToBottomRef.current = true;
      setMessages((prev) => [res.message, ...prev]);
      setDraft('');
      setAiHintVisible(false);
      loadChats();
    } catch (err) {
      if (err instanceof ApiError) {
        // 502: повідомлення збережене зі статусом FAILED — показуємо у стрічці
        const body = err.body as { message?: MessageItem } | undefined;
        if (err.status === 502 && body?.message) {
          setMessages((prev) => [body.message as MessageItem, ...prev]);
        }
        toast.error(err.message);
        loadChats();
      } else {
        toast.error('Не вдалося надіслати повідомлення');
      }
    } finally {
      setSending(false);
    }
  };

  const handleAiDraft = async () => {
    if (!selectedChat || aiLoading) return;

    const customerName = chatTitle(selectedChat);
    const ordered = [...messages].reverse();
    const context = ordered
      .slice(-8)
      .map((m) => `${m.senderType === 'USER' ? 'Менеджер' : customerName}: ${m.content}`)
      .join('\n');

    const prompt = [
      'Ти — менеджер CRM. Сформуй коротку відповідь клієнту українською мовою (1-3 речення, лаконічно).',
      `Клієнт: ${customerName}. Канал: ${CHANNEL_META[selectedChat.channel].label}.`,
      context
        ? `Останні повідомлення в чаті:\n${context}`
        : 'Чат порожній — привітайся та запропонуй допомогу.',
    ].join('\n\n');

    setAiLoading(true);
    try {
      const res = await apiSend<{ result: unknown }>('/api/ai', 'POST', {
        action: 'custom',
        data: { prompt },
      });
      const text = typeof res.result === 'string' ? res.result.trim() : '';
      if (!text) {
        toast.error('AI повернув порожню відповідь');
        return;
      }
      setDraft(text);
      setAiHintVisible(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не вдалося згенерувати AI-чернетку');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDraftKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasChatsFilter = channelFilter !== 'ALL' || search.length > 0;
  const orderedMessages = [...messages].reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Повідомлення</h1>
          <p className="text-foreground-muted">Спілкування з клієнтами</p>
        </div>
      </div>

      <div className="grid h-[calc(100vh-15rem)] min-h-[540px] grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* ===== Ліва панель: список чатів ===== */}
        <Card
          className={cn('flex min-h-0 flex-col overflow-hidden', selectedChat && 'hidden lg:flex')}
        >
          <div className="space-y-3 border-b p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Пошук за ім'ям…"
                className="pl-9"
                aria-label="Пошук чатів"
              />
            </div>

            <Tabs
              value={channelFilter}
              onValueChange={(value) => setChannelFilter(value as ChannelFilter)}
            >
              <TabsList className="h-auto w-full flex-wrap justify-start bg-transparent p-0">
                <TabsTrigger value="ALL">Усі</TabsTrigger>
                <TabsTrigger value="TELEGRAM">Telegram</TabsTrigger>
                <TabsTrigger value="WHATSAPP">WhatsApp</TabsTrigger>
                <TabsTrigger value="EMAIL">Email</TabsTrigger>
                <TabsTrigger value="SMS">SMS</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {!chatsLoaded ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chatsError ? (
              <div className="space-y-3 p-4 text-center">
                <p className="text-sm text-danger">{chatsError}</p>
                <Button variant="outline" size="sm" onClick={loadChats}>
                  Повторити
                </Button>
              </div>
            ) : chats.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8" />}
                title={hasChatsFilter ? 'Нічого не знайдено' : 'Чатів поки немає'}
                description={
                  hasChatsFilter
                    ? 'Спробуйте змінити пошуковий запит або фільтр каналу.'
                    : "Тут з'являться ваші розмови з клієнтами через Telegram та WhatsApp після підключення месенджерів."
                }
                className="py-10"
              />
            ) : (
              <ul className="space-y-1">
                {chats.map((chat) => {
                  const title = chatTitle(chat);
                  const ChannelIcon = CHANNEL_META[chat.channel].icon;
                  const isSelected = selectedChat?.id === chat.id;

                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(chat)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-secondary',
                          isSelected && 'bg-secondary ring-1 ring-ring',
                        )}
                        aria-current={isSelected}
                      >
                        <Avatar name={title} size="default" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{title}</span>
                            <ChannelIcon
                              className="h-4 w-4 shrink-0 text-foreground-muted"
                              aria-label={CHANNEL_META[chat.channel].label}
                            />
                            <span className="ml-auto shrink-0 text-xs text-foreground-muted">
                              {formatTime(chat.lastMessageAt)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <p className="truncate text-sm text-foreground-muted">
                              {previewText(chat)}
                            </p>
                            {chat.unreadCount > 0 && (
                              <Badge className="ml-auto shrink-0 px-1.5 py-0.5 text-[11px]">
                                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* ===== Права панель: розмова ===== */}
        <Card
          className={cn('flex min-h-0 flex-col overflow-hidden', !selectedChat && 'hidden lg:flex')}
        >
          {!selectedChat ? (
            <EmptyState
              icon={<MessageSquare className="h-8 w-8" />}
              title="Оберіть чат"
              description="Ліворуч список розмов з клієнтами — натисніть, щоб побачити історію та відповісти."
              className="my-auto"
            />
          ) : (
            <>
              {/* Шапка розмови */}
              <div className="flex items-center gap-3 border-b p-4">
                <button
                  type="button"
                  onClick={() => setSelectedChat(null)}
                  className="rounded-md p-1 hover:bg-secondary lg:hidden"
                  aria-label="Назад до списку"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar name={chatTitle(selectedChat)} size="default" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{chatTitle(selectedChat)}</span>
                    <Badge variant="secondary" className="gap-1">
                      {(() => {
                        const Icon = CHANNEL_META[selectedChat.channel].icon;
                        return <Icon className="h-4 w-4" />;
                      })()}
                      {CHANNEL_META[selectedChat.channel].label}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-foreground-muted">
                    {selectedChat.contact?.phone ||
                      selectedChat.contact?.email ||
                      CHANNEL_META[selectedChat.channel].label}
                  </p>
                </div>
              </div>

              {/* Стрічка повідомлень */}
              <div
                ref={timelineRef}
                onScroll={handleTimelineScroll}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              >
                {messagesLoading && messages.length === 0 ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={cn('flex', i % 2 === 1 && 'justify-end')}>
                        <Skeleton className="h-14 w-2/3 rounded-2xl" />
                      </div>
                    ))}
                  </div>
                ) : messagesError ? (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-danger">{messagesError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadMessages(selectedChat.id, false)}
                    >
                      Повторити
                    </Button>
                  </div>
                ) : orderedMessages.length === 0 ? (
                  <EmptyState
                    icon={<MessageSquare className="h-8 w-8" />}
                    title="Повідомлень ще немає"
                    description="Напишіть перше повідомлення клієнту або зачекайте на його відповідь."
                    className="py-10"
                  />
                ) : (
                  orderedMessages.map((message, index) => {
                    const prev = orderedMessages[index - 1];
                    const showDate =
                      !prev ||
                      new Date(prev.createdAt).toDateString() !==
                        new Date(message.createdAt).toDateString();

                    return (
                      <Fragment key={message.id}>
                        {showDate && (
                          <div className="flex items-center gap-3 text-xs text-foreground-muted">
                            <Separator className="flex-1" />
                            {formatDate(message.createdAt)}
                            <Separator className="flex-1" />
                          </div>
                        )}
                        <MessageBubble message={message} />
                      </Fragment>
                    );
                  })
                )}
              </div>

              {/* AI hint box + композер */}
              <div className="space-y-2 border-t p-3">
                {aiHintVisible && (
                  <div className="flex items-start gap-2 rounded-lg border border-info/40 bg-info-light p-2 text-xs text-info">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="flex-1">
                      AI-чернетку вставлено у вікно введення — відредагуйте перед відправленням.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAiHintVisible(false)}
                      aria-label="Закрити підказку"
                      className="rounded p-0.5 hover:bg-info/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder="Написати повідомлення… (Enter — надіслати, Shift+Enter — новий рядок)"
                  rows={2}
                  className="min-h-[44px] resize-none"
                  aria-label="Текст повідомлення"
                />

                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAiDraft}
                    disabled={aiLoading || sending}
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    AI-чернетка
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSend}
                    disabled={sending || draft.trim().length === 0}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Надіслати
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
