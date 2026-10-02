'use client';

import {
  Search,
  Plus,
  Bell,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  Command,
  TrendingUp,
  Users,
  CheckSquare,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  Repeat,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';

import { useNotifications } from '@/components/notifications-provider';
import {
  QuickCreatePopover,
  QuickContactForm,
  QuickDealForm,
  QuickTaskForm,
} from '@/components/quick-create';
import { useTheme } from '@/components/theme-provider';
import { Avatar } from '@/components/ui';
import { currentLocaleFromPath } from '@/lib/use-locale-path';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
}

interface ReminderTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueDate: string | null;
  reminderAt: string | null;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Терміново', color: 'text-danger' },
  high: { label: 'Високий', color: 'text-warning' },
  medium: { label: 'Середній', color: 'text-info' },
  low: { label: 'Низький', color: 'text-foreground-muted' },
};

const typeIcons: Record<string, React.ReactNode> = {
  task: <CheckSquare className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  follow_up: <Repeat className="h-4 w-4" />,
};

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [overdueReminders, setOverdueReminders] = useState<ReminderTask[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderTask[]>([]);
  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    contacts: { id: string; name: string; subtitle: string }[];
    deals: { id: string; name: string; subtitle: string }[];
    tasks: { id: string; name: string; subtitle: string }[];
  } | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const unreadCount = overdueReminders.length + upcomingReminders.length;
  // + in-app системні сповіщення (автоматизації, інтеграції)
  const { unreadCount: appUnread } = useNotifications();
  const totalUnread = unreadCount + appUnread;

  // Keyboard shortcut for search (Ctrl+K / Cmd+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsProfileOpen(false);
        setIsNotifOpen(false);
        setIsQuickOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    } else {
      setSearch('');
      setSearchResults(null);
    }
  }, [isSearchOpen]);

  // Debounced global search (250ms) — real /api/search, tenant-scoped.
  useEffect(() => {
    const q = search.trim();
    if (!isSearchOpen || q.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setSearchResults(d))
        .catch(() => setSearchResults(null))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search, isSearchOpen]);

  const goSearchResult = (href: string) => {
    setIsSearchOpen(false);
    router.push(href);
  };

  // Fetch reminders
  useEffect(() => {
    fetch('/api/tasks/reminders?hours=24')
      .then((r) => r.json())
      .then((data) => {
        setOverdueReminders(data.overdue || []);
        setUpcomingReminders(data.upcoming || []);
      })
      .catch(() => {
        // фоновий бейдж нагадувань: мовчазно, лічильник лишається 0
        console.warn('[header] reminders fetch failed');
      });
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setIsNotifOpen(false);
      if (quickRef.current && !quickRef.current.contains(target)) setIsQuickOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const user = session?.user;

  const quickActions = [
    {
      label: 'Новий контакт',
      type: 'contact' as const,
      href: null as string | null,
      icon: Users,
      color: 'text-foreground',
    },
    {
      label: 'Нова угода',
      type: 'deal' as const,
      href: null as string | null,
      icon: TrendingUp,
      color: 'text-foreground',
    },
    {
      label: 'Нова задача',
      type: 'task' as const,
      href: null as string | null,
      icon: CheckSquare,
      color: 'text-foreground',
    },
    {
      label: 'Повідомлення',
      type: null,
      href: '/dashboard/messages',
      icon: MessageSquare,
      color: 'text-foreground',
    },
  ];

  // Quick-create popover anchored to the clicked dropdown item
  const [headerQuick, setHeaderQuick] = useState<{
    type: 'contact' | 'deal' | 'task';
    anchor: HTMLElement | null;
  } | null>(null);

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6">
        {/* Left side */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            className="rounded-xl p-2.5 text-foreground-muted hover:bg-secondary hover:text-foreground lg:hidden transition-colors duration-200"
            onClick={onMobileMenuToggle}
            aria-label="Відкрити меню"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Search bar with Cmd+K shortcut */}
          <button
            onClick={() => setIsSearchOpen(true)}
            data-tour="search"
            className="hidden sm:flex items-center gap-3 h-9 w-80 rounded-md border border-border bg-background-secondary px-4 text-sm text-foreground-muted hover:border-border-hover hover:bg-background-tertiary transition-all duration-200"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Пошук...</span>
            <div className="flex items-center gap-1 text-xs text-foreground-muted/60">
              <Command className="h-3 w-3" />
              <span>K</span>
            </div>
          </button>
          {/* Mobile search icon (same modal) */}
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Пошук"
            className="sm:hidden rounded-xl p-2.5 text-foreground-muted hover:bg-secondary hover:text-foreground transition-all duration-200"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          {/* Quick Actions */}
          <div className="relative" ref={quickRef} data-tour="quick-create">
            <button
              onClick={() => {
                setIsQuickOpen(!isQuickOpen);
                setIsNotifOpen(false);
                setIsProfileOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-all duration-200 hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Створити</span>
            </button>

            {isQuickOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsQuickOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
                  <div className="p-2">
                    <p className="px-3 py-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                      Швидкі дії
                    </p>
                    {quickActions.map((action) =>
                      action.type ? (
                        <button
                          key={action.label}
                          onClick={(e) => {
                            setIsQuickOpen(false);
                            setHeaderQuick({ type: action.type, anchor: e.currentTarget });
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary transition-all duration-150"
                        >
                          <div className={cn('p-1.5 rounded-lg bg-secondary', action.color)}>
                            <action.icon className="h-4 w-4" />
                          </div>
                          <span>{action.label}</span>
                        </button>
                      ) : (
                        <Link
                          key={action.label}
                          href={action.href || '/dashboard'}
                          onClick={() => setIsQuickOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary transition-all duration-150"
                        >
                          <div className={cn('p-1.5 rounded-lg bg-secondary', action.color)}>
                            <action.icon className="h-4 w-4" />
                          </div>
                          <span>{action.label}</span>
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="rounded-xl p-2.5 text-foreground-muted hover:bg-secondary hover:text-foreground transition-all duration-200"
            title={resolvedTheme === 'dark' ? 'Світла тема' : 'Темна тема'}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Language Switcher — П7: скрыт, пока нет реальных переводов
              (интерфейс захардкожен на украинском, переключатель без результата
              вводить в заблуждение). Словари en/ru.json не удалены. */}
          {/* <LanguageSwitcher /> */}

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsQuickOpen(false);
                setIsProfileOpen(false);
              }}
              className="relative rounded-xl p-2.5 text-foreground-muted hover:bg-secondary hover:text-foreground transition-all duration-200"
              title="Сповіщення"
            >
              <Bell className="h-5 w-5" />
              {totalUnread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white animate-pulse-subtle">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold">Нагадування</h3>
                    <Link
                      href="/dashboard/timeline"
                      onClick={() => setIsNotifOpen(false)}
                      className="text-xs font-semibold text-foreground underline-offset-4 transition-colors hover:underline"
                    >
                      Таймлайн →
                    </Link>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {overdueReminders.length === 0 && upcomingReminders.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-light mb-3">
                          <CheckSquare className="h-6 w-6 text-success" />
                        </div>
                        <p className="text-sm font-medium text-foreground-muted">
                          Немає нагадувань
                        </p>
                        <p className="text-xs text-foreground-muted/70 mt-1">Все під контролем!</p>
                      </div>
                    ) : (
                      <>
                        {overdueReminders.length > 0 && (
                          <div>
                            <div className="px-4 py-2 bg-danger/5 border-b border-border">
                              <p className="text-xs font-semibold text-danger">
                                Протерміновано ({overdueReminders.length})
                              </p>
                            </div>
                            {overdueReminders.map((task) => (
                              <Link
                                key={task.id}
                                href={`/dashboard/tasks/${task.id}`}
                                onClick={() => setIsNotifOpen(false)}
                                className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-secondary/50 transition-colors"
                              >
                                <div className="p-1.5 rounded-lg bg-danger-light text-danger">
                                  {typeIcons[task.type] || <CheckSquare className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{task.title}</p>
                                  <p className="text-xs text-danger">
                                    {task.reminderAt &&
                                      new Date(task.reminderAt).toLocaleString('uk', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    'text-xs font-medium',
                                    priorityConfig[task.priority]?.color,
                                  )}
                                >
                                  {priorityConfig[task.priority]?.label}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                        {upcomingReminders.length > 0 && (
                          <div>
                            <div className="px-4 py-2 bg-primary/10 border-b border-border">
                              <p className="text-xs font-semibold text-foreground">
                                Найближчі ({upcomingReminders.length})
                              </p>
                            </div>
                            {upcomingReminders.map((task) => (
                              <Link
                                key={task.id}
                                href={`/dashboard/tasks/${task.id}`}
                                onClick={() => setIsNotifOpen(false)}
                                className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-secondary/50 transition-colors"
                              >
                                <div className="p-1.5 rounded-lg bg-foreground text-background">
                                  {typeIcons[task.type] || <CheckSquare className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{task.title}</p>
                                  <p className="text-xs text-foreground-muted">
                                    {task.reminderAt &&
                                      new Date(task.reminderAt).toLocaleString('uk', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    'text-xs font-medium',
                                    priorityConfig[task.priority]?.color,
                                  )}
                                >
                                  {priorityConfig[task.priority]?.label}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="border-t border-border px-4 py-2.5 space-y-1">
                    <Link
                      href="/dashboard/notifications"
                      onClick={() => setIsNotifOpen(false)}
                      className="block rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                    >
                      Відкрити всі сповіщення →
                    </Link>
                    <Link
                      href="/dashboard/tasks"
                      onClick={() => setIsNotifOpen(false)}
                      className="block text-center text-xs font-semibold text-foreground underline-offset-4 transition-colors hover:underline"
                    >
                      Всі задачі →
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotifOpen(false);
                setIsQuickOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-secondary transition-all duration-200"
            >
              <Avatar name={user?.name || user?.email || '?'} size="sm" />
            </button>

            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-secondary/30">
                    <p className="text-sm font-semibold">{user?.name || 'Користувач'}</p>
                    <p className="text-xs text-foreground-muted mt-0.5">{user?.email}</p>
                  </div>
                  <div className="p-2">
                    <Link
                      href="/dashboard/settings/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary transition-all duration-150"
                    >
                      <User className="h-4 w-4 text-foreground-muted" />
                      Профіль
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary transition-all duration-150"
                    >
                      <Settings className="h-4 w-4 text-foreground-muted" />
                      Налаштування
                    </Link>
                  </div>
                  <div className="border-t border-border p-2">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        signOut({ callbackUrl: `/${currentLocaleFromPath()}/auth/login` });
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger-light transition-all duration-150"
                    >
                      <LogOut className="h-4 w-4" />
                      Вийти
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Full-screen search modal (Cmd+K) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div
            className="fixed inset-0 bg-foreground-inverse/50 backdrop-blur-sm"
            onClick={() => setIsSearchOpen(false)}
          />
          <div className="relative w-full max-w-2xl mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in-scale">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <Search className="h-5 w-5 text-foreground-muted" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Пошук контактів, угод, задач..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-lg text-foreground placeholder:text-foreground-muted"
              />
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-foreground-muted bg-secondary rounded-lg border border-border">
                Esc
              </kbd>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {search.trim().length < 2 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-foreground-muted">Почніть вводити для пошуку...</p>
                </div>
              ) : searchLoading && !searchResults ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-foreground-muted animate-pulse">Шукаю...</p>
                </div>
              ) : searchResults &&
                (searchResults.contacts.length > 0 ||
                  searchResults.deals.length > 0 ||
                  searchResults.tasks.length > 0) ? (
                <div className="space-y-1">
                  {searchResults.contacts.length > 0 && (
                    <>
                      <p className="px-3 py-1.5 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                        Контакти
                      </p>
                      {searchResults.contacts.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => goSearchResult(`/dashboard/contacts/${c.id}`)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-secondary transition-colors"
                        >
                          <Users className="h-4 w-4 shrink-0 text-foreground-muted" />
                          <span className="flex-1 truncate font-medium">{c.name}</span>
                          {c.subtitle && (
                            <span className="truncate text-xs text-foreground-muted">
                              {c.subtitle}
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {searchResults.deals.length > 0 && (
                    <>
                      <p className="px-3 py-1.5 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                        Угоди
                      </p>
                      {searchResults.deals.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => goSearchResult(`/dashboard/deals/${d.id}`)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-secondary transition-colors"
                        >
                          <TrendingUp className="h-4 w-4 shrink-0 text-foreground-muted" />
                          <span className="flex-1 truncate font-medium">{d.name}</span>
                          {d.subtitle && (
                            <span className="truncate text-xs text-foreground-muted">
                              {d.subtitle}
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {searchResults.tasks.length > 0 && (
                    <>
                      <p className="px-3 py-1.5 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                        Задачі
                      </p>
                      {searchResults.tasks.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => goSearchResult(`/dashboard/tasks/${t.id}`)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-secondary transition-colors"
                        >
                          <CheckSquare className="h-4 w-4 shrink-0 text-foreground-muted" />
                          <span className="flex-1 truncate font-medium">{t.name}</span>
                          {t.subtitle && (
                            <span className="truncate text-xs text-foreground-muted">
                              {t.subtitle}
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-foreground-muted">Нічого не знайдено</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick-create popover (anchored to the clicked menu item) */}
      <QuickCreatePopover
        anchorEl={headerQuick?.anchor || null}
        open={headerQuick !== null}
        onClose={() => setHeaderQuick(null)}
        title={
          headerQuick?.type === 'contact'
            ? 'Новий контакт'
            : headerQuick?.type === 'deal'
              ? 'Нова угода'
              : 'Нова задача'
        }
      >
        {headerQuick?.type === 'contact' && (
          <QuickContactForm onCreated={() => setHeaderQuick(null)} />
        )}
        {headerQuick?.type === 'deal' && <QuickDealForm onCreated={() => setHeaderQuick(null)} />}
        {headerQuick?.type === 'task' && <QuickTaskForm onCreated={() => setHeaderQuick(null)} />}
      </QuickCreatePopover>
    </>
  );
}
