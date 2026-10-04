'use client';

import {
  LayoutDashboard,
  Users,
  TrendingUp,
  CheckSquare,
  Clock,
  MessageSquare,
  BarChart3,
  Zap,
  FileText,
  Bot,
  Settings,
  ChevronDown,
  Plus,
  Database,
  Activity,
  Webhook,
  ListOrdered,
  Gauge,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

import { useNotifications } from '@/components/notifications-provider';
import { useTeam } from '@/components/owner-picker';
import { cn } from '@/lib/utils';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onMobileClose?: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export function Sidebar({ collapsed = false, onMobileClose, onExpandChange }: SidebarProps) {
  const pathname = usePathname();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  // In-app системні сповіщення (автоматизації, інтеграції) — окремий лічильник.
  const { unreadCount: unreadApp } = useNotifications();
  const tenantRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = !collapsed || hovered;

  const openRail = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setHovered(true);
    onExpandChange?.(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setHovered(false);
      onExpandChange?.(false);
    }, 200);
  };

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    fetch('/api/tenants')
      .then((res) => res.json())
      .then((data) => {
        setTenants(data.tenants || []);
        const savedId = localStorage.getItem('tenantId');
        const found = (data.tenants || []).find((t: Tenant) => t.id === savedId);
        if (found) {
          setCurrentTenant(found);
        } else if (data.tenants?.length > 0) {
          setCurrentTenant(data.tenants[0]);
          localStorage.setItem('tenantId', data.tenants[0].id);
        }
      })
      .catch(() => {
        // фоновий список компаній для перемикача: мовчазно
        console.warn('[sidebar] tenants fetch failed');
      });
  }, []);

  // Fetch unread message count
  useEffect(() => {
    const fetchUnread = () => {
      fetch('/api/messages/unread')
        .then((r) => r.json())
        .then((data) => setUnreadMessages(data.count || 0))
        .catch(() => setUnreadMessages(0));
    };
    fetchUnread();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tenantRef.current && !tenantRef.current.contains(e.target as Node)) {
        setTenantOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const switchTenant = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    localStorage.setItem('tenantId', tenant.id);
    setTenantOpen(false);
    window.location.reload();
  };

  const navigationGroups: Array<{
    label: string;
    adminOnly?: boolean;
    items: Array<{
      name: string;
      href: string;
      icon: typeof LayoutDashboard;
      badge?: number;
      accent?: boolean;
    }>;
  }> = [
    {
      label: 'Головне',
      items: [
        { name: 'Дашборд', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Контакти', href: '/dashboard/contacts', icon: Users },
        { name: 'Угоди', href: '/dashboard/deals', icon: TrendingUp },
        { name: 'Задачі', href: '/dashboard/tasks', icon: CheckSquare },
      ],
    },
    {
      label: 'Комунікації',
      items: [
        { name: 'Таймлайн', href: '/dashboard/timeline', icon: Clock },
        {
          name: 'Повідомлення',
          href: '/dashboard/messages',
          icon: MessageSquare,
          badge: unreadMessages,
        },
        { name: 'Сповіщення', href: '/dashboard/notifications', icon: Bell, badge: unreadApp },
        { name: 'Документи', href: '/dashboard/documents', icon: FileText },
      ],
    },
    {
      label: 'Інструменти',
      items: [
        { name: 'Аналітика', href: '/dashboard/analytics', icon: BarChart3 },
        { name: 'Автоматизація', href: '/dashboard/automation', icon: Zap },
        { name: 'AI Co-Pilot', href: '/dashboard/copilot', icon: Bot, accent: true },
      ],
    },
    {
      label: 'Для адміністратора',
      adminOnly: true,
      items: [
        { name: 'Моніторинг кешу', href: '/dashboard/cache', icon: Database },
        { name: 'Черги задач', href: '/dashboard/queues', icon: ListOrdered },
        { name: 'Вебхуки', href: '/dashboard/webhooks', icon: Webhook },
        { name: 'Спостережуваність', href: '/dashboard/observability', icon: Gauge },
        { name: 'Логи', href: '/dashboard/logs', icon: Activity },
      ],
    },
  ];

  // Роль из уже загруженного контекста команды (без новых запросов).
  // Пока роль неизвестна — админ-раздел скрыт (safe default).
  const { currentRole } = useTeam();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const [adminOpen, setAdminOpen] = useState(false);

  const filteredGroups = navigationGroups
    .filter((group) => !group.adminOnly || isAdmin)
    .filter((group) => group.items.length > 0);

  return (
    <aside
      onMouseEnter={openRail}
      onMouseLeave={scheduleClose}
      onFocus={openRail}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
      }}
      className={cn(
        'flex h-full flex-col border-r border-black/40 bg-inverse text-inverse-foreground transition-all duration-300 ease-out',
        collapsed && !hovered ? 'w-[72px]' : 'w-[260px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-inverse-foreground/10 px-5">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary shadow-[0_8px_20px_-8px_rgba(37,99,235,0.7)]"
        >
          <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
        </Link>
        {expanded && (
          <div className="flex-1 min-w-0">
            <span className="text-lg font-bold tracking-tight text-inverse-foreground">
              CRM-Next
            </span>
          </div>
        )}
      </div>

      {/* Tenant switcher */}
      {expanded && currentTenant && (
        <div className="relative border-b border-inverse-foreground/10 px-4 py-3" ref={tenantRef}>
          <button
            onClick={() => setTenantOpen(!tenantOpen)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-200 hover:bg-inverse-foreground/10"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-inverse-accent">
              {currentTenant.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-inverse-foreground">
                {currentTenant.name}
              </p>
              <p className="text-xs text-inverse-foreground/50 truncate">/{currentTenant.slug}</p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-inverse-foreground/50 transition-transform duration-200',
                tenantOpen && 'rotate-180',
              )}
            />
          </button>

          {tenantOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTenantOpen(false)} />
              <div className="absolute left-4 right-4 top-full z-50 mt-1 overflow-hidden rounded-xl border border-inverse-foreground/10 bg-inverse shadow-xl">
                <div className="p-2">
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-inverse-foreground/50">
                    Організації
                  </p>
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => switchTenant(tenant)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150',
                        currentTenant.id === tenant.id
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : 'text-inverse-foreground hover:bg-inverse-foreground/10',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                          currentTenant.id === tenant.id
                            ? 'bg-black/10 text-primary-foreground'
                            : 'bg-inverse-foreground/10 text-inverse-accent',
                        )}
                      >
                        {tenant.name.charAt(0)}
                      </div>
                      <span className="truncate">{tenant.name}</span>
                    </button>
                  ))}
                  <div className="mt-1 border-t border-inverse-foreground/10 pt-1">
                    <Link
                      href="/dashboard/settings/tenants"
                      onClick={() => setTenantOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-inverse-foreground/60 transition-all duration-150 hover:bg-inverse-foreground/10 hover:text-inverse-foreground"
                    >
                      <Plus className="h-4 w-4" />
                      Нова організація
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" data-tour="nav">
        {filteredGroups.map((group) => (
          <div key={group.label}>
            {expanded &&
              (group.adminOnly ? (
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  aria-expanded={adminOpen}
                  className="mb-2 flex w-full items-center justify-between px-3 text-xs font-semibold text-inverse-foreground/40 uppercase tracking-wider hover:text-inverse-foreground/70 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', !adminOpen && '-rotate-90')}
                  />
                </button>
              ) : (
                <h3 className="px-3 mb-2 text-xs font-semibold text-inverse-foreground/40 uppercase tracking-wider">
                  {group.label}
                </h3>
              ))}
            {(!group.adminOnly || adminOpen || !expanded) && (
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onMobileClose}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary font-semibold text-primary-foreground shadow-[0_8px_20px_-10px_rgba(37,99,235,0.8)]'
                          : 'text-inverse-foreground/65 hover:bg-inverse-foreground/10 hover:text-inverse-foreground',
                        item.accent &&
                          !isActive &&
                          'text-inverse-accent/80 hover:text-inverse-accent',
                        !expanded && 'justify-center px-2',
                      )}
                      title={!expanded ? item.name : undefined}
                    >
                      <item.icon
                        className={cn(
                          'h-5 w-5 flex-shrink-0 transition-colors duration-200',
                          isActive
                            ? 'text-primary-foreground'
                            : 'text-inverse-foreground/50 group-hover:text-inverse-foreground',
                          item.accent &&
                            !isActive &&
                            'text-inverse-accent/70 group-hover:text-inverse-accent',
                        )}
                      />
                      {expanded && (
                        <>
                          <span className="flex-1">{item.name}</span>
                          {'badge' in item && item.badge && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-inverse-foreground">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                      {isActive && expanded && (
                        <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-inverse-foreground/10 p-3 space-y-1">
        <Link
          href="/dashboard/settings"
          onClick={onMobileClose}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
            pathname.startsWith('/dashboard/settings')
              ? 'bg-primary font-semibold text-primary-foreground'
              : 'text-inverse-foreground/65 hover:bg-inverse-foreground/10 hover:text-inverse-foreground',
            !expanded && 'justify-center px-2',
          )}
          title={collapsed ? 'Налаштування' : undefined}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {expanded && <span>Налаштування</span>}
        </Link>
      </div>
    </aside>
  );
}
