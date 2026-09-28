'use client';

import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  title: string;
  message: string;
  link: string | null;
  type: string;
}

type ToastPosition = 'bottom-left' | 'bottom-right' | 'top-right';

interface NotificationsContextValue {
  unreadCount: number;
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  refresh: () => {},
});

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}

const SEEN_KEY = 'notif-seen-ids';

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    // битый localStorage — начинаем с пустого
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    // localStorage недоступен — seen живёт только в памяти
  }
}

const positionClasses: Record<ToastPosition, string> = {
  'bottom-left': 'left-4 bottom-4 items-start',
  'bottom-right': 'right-4 bottom-4 items-end',
  'top-right': 'right-4 top-4 items-end',
};

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [position, setPosition] = useState<ToastPosition>('bottom-left');
  const [enabled, setEnabled] = useState(true);
  const seenRef = useRef<Set<string> | null>(null);

  const loadPrefs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.toast?.enabled === 'boolean') setEnabled(data.toast.enabled);
      if (typeof data?.toast?.position === 'string') setPosition(data.toast.position);
    } catch {
      // фоновые преференсы тостов: мовчазно, дефолты уже стоят
      console.warn('[notifications] prefs load failed');
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.notifications || []) as Array<{
        id: string;
        title: string;
        message: string;
        link: string | null;
        type: string;
      }>;
      setUnreadCount(data.unreadCount || 0);

      if (!seenRef.current) seenRef.current = loadSeen();
      const fresh = list.filter((n) => !seenRef.current!.has(n.id));
      if (fresh.length > 0) {
        for (const n of fresh) seenRef.current!.add(n.id);
        saveSeen(seenRef.current!);
        setToasts((prev) => {
          const ids = new Set(prev.map((t) => t.id));
          const next = fresh.filter((n) => !ids.has(n.id)).map((n) => ({ ...n }));
          return [...next, ...prev].slice(0, 5);
        });
      }
    } catch {
      // фоновый опрос уведомлений: мовчазно, следующий тик через 30с
      console.warn('[notifications] refresh failed');
    }
  }, []);

  useEffect(() => {
    loadPrefs();
    refresh();
    const interval = setInterval(refresh, 30000);
    const onFocus = () => refresh();
    const onPrefs = () => loadPrefs();
    window.addEventListener('focus', onFocus);
    window.addEventListener('notif-prefs-changed', onPrefs);
    window.addEventListener('notif-read', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('notif-prefs-changed', onPrefs);
      window.removeEventListener('notif-read', onFocus);
    };
  }, [loadPrefs, refresh]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const openToast = useCallback(
    async (t: Toast) => {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [t.id] }),
        });
      } catch {
        // пометка прочитанным best-effort: тост всё равно закрываем
        console.warn('[notifications] mark-read failed');
      }
      dismiss(t.id);
      refresh();
      if (t.link) router.push(t.link);
      else router.push('/dashboard/notifications');
    },
    [dismiss, refresh, router],
  );

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 6000);
    return () => clearTimeout(timer);
  }, [toasts]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refresh }}>
      {children}
      {enabled && toasts.length > 0 && (
        <div
          className={cn(
            'fixed z-[100] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]',
            positionClasses[position],
          )}
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-border bg-card p-3.5 shadow-xl cursor-pointer hover:border-[#111214] transition-colors"
              onClick={() => openToast(t)}
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111214]">
                  <Bell className="h-4 w-4 text-[#FFC700]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{t.title}</p>
                  <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">{t.message}</p>
                  {t.link ? (
                    <span className="text-xs font-semibold text-[#111214] underline-offset-4 hover:underline">
                      Відкрити →
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(t.id);
                  }}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-foreground-muted hover:text-foreground"
                  aria-label="Закрити"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </NotificationsContext.Provider>
  );
}
