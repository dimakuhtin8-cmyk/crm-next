'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { Avatar, Badge } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
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

const typeIcons: Record<string, string> = {
  task: '📋', call: '📞', email: '✉️', meeting: '🤝', follow_up: '🔄',
};

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [overdueReminders, setOverdueReminders] = useState<ReminderTask[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderTask[]>([]);
  const [search, setSearch] = useState('');

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);

  const unreadCount = overdueReminders.length + upcomingReminders.length;

  // Fetch reminders
  useEffect(() => {
    fetch('/api/tasks/reminders?hours=24')
      .then((r) => r.json())
      .then((data) => {
        setOverdueReminders(data.overdue || []);
        setUpcomingReminders(data.upcoming || []);
      })
      .catch(() => {});
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
    { label: 'Новий контакт', href: '/dashboard/contacts/new', icon: '👤' },
    { label: 'Нова угода', href: '/dashboard/deals/new', icon: '💼' },
    { label: 'Нова задача', href: '/dashboard/tasks/new', icon: '✅' },
    { label: 'Написати повідомлення', href: '/dashboard/messages/new', icon: '💬' },
  ];

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 sm:px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          className="rounded-lg p-2 text-foreground-muted hover:bg-secondary hover:text-foreground lg:hidden"
          onClick={onMobileMenuToggle}
          aria-label="Відкрити меню"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Search */}
        <div className="relative hidden sm:block">
          <input
            type="search"
            placeholder="Пошук контактів, угод, задач..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-80 rounded-lg border border-border bg-background px-4 pl-10 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:w-96 transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-secondary"
            >
              <svg className="h-3.5 w-3.5 text-foreground-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        {/* Quick Actions */}
        <div className="relative" ref={quickRef}>
          <button
            onClick={() => {
              setIsQuickOpen(!isQuickOpen);
              setIsNotifOpen(false);
              setIsProfileOpen(false);
            }}
            className="relative rounded-lg p-2 text-foreground-muted hover:bg-secondary hover:text-foreground transition-colors"
            title="Швидкі дії"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {isQuickOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsQuickOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                <p className="px-2 py-1 text-xs font-medium text-foreground-muted">Швидкі дії</p>
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    onClick={() => setIsQuickOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary transition-colors"
                  >
                    <span className="text-base">{action.icon}</span>
                    <span>{action.label}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsQuickOpen(false);
              setIsProfileOpen(false);
            }}
            className="relative rounded-lg p-2 text-foreground-muted hover:bg-secondary hover:text-foreground transition-colors"
            title="Сповіщення"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold">Нагадування</h3>
                  <Link href="/dashboard/timeline" onClick={() => setIsNotifOpen(false)} className="text-xs text-primary hover:text-primary-hover transition-colors">
                    Таймлайн →
                  </Link>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {overdueReminders.length === 0 && upcomingReminders.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-foreground-muted">
                      Немає нагадувань
                    </div>
                  ) : (
                    <>
                      {overdueReminders.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-danger/5 border-b border-border">
                            <p className="text-xs font-medium text-danger">Протерміновано ({overdueReminders.length})</p>
                          </div>
                          {overdueReminders.map((task) => (
                            <Link
                              key={task.id}
                              href={`/dashboard/tasks/${task.id}`}
                              onClick={() => setIsNotifOpen(false)}
                              className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-secondary/50 transition-colors"
                            >
                              <span className="text-base">{typeIcons[task.type] || '📋'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{task.title}</p>
                                <p className="text-xs text-danger">
                                  {task.reminderAt && new Date(task.reminderAt).toLocaleString('uk', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <span className={cn('text-xs font-medium', priorityConfig[task.priority]?.color)}>
                                {priorityConfig[task.priority]?.label}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {upcomingReminders.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-primary/5 border-b border-border">
                            <p className="text-xs font-medium text-primary">Найближчі ({upcomingReminders.length})</p>
                          </div>
                          {upcomingReminders.map((task) => (
                            <Link
                              key={task.id}
                              href={`/dashboard/tasks/${task.id}`}
                              onClick={() => setIsNotifOpen(false)}
                              className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-secondary/50 transition-colors"
                            >
                              <span className="text-base">{typeIcons[task.type] || '📋'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{task.title}</p>
                                <p className="text-xs text-foreground-muted">
                                  {task.reminderAt && new Date(task.reminderAt).toLocaleString('uk', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <span className={cn('text-xs font-medium', priorityConfig[task.priority]?.color)}>
                                {priorityConfig[task.priority]?.label}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="border-t border-border px-4 py-2">
                  <Link
                    href="/dashboard/tasks"
                    onClick={() => setIsNotifOpen(false)}
                    className="block text-center text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                  >
                    Всі задачі
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
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary transition-colors"
          >
            <Avatar name={user?.name || user?.email || '?'} size="sm" />
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium leading-tight">{user?.name || 'Користувач'}</p>
              <p className="text-xs text-foreground-muted">{user?.email}</p>
            </div>
            <svg
              className="hidden sm:block h-4 w-4 text-foreground-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isProfileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-sm font-medium">{user?.name || 'Користувач'}</p>
                  <p className="text-xs text-foreground-muted">{user?.email}</p>
                </div>
                <Link
                  href="/dashboard/settings/profile"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  <svg className="h-4 w-4 text-foreground-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Профіль
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  <svg className="h-4 w-4 text-foreground-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Налаштування
                </Link>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    import('next-auth/react').then(({ signOut }) => signOut({ callbackUrl: '/auth/login' }));
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-light transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Вийти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
