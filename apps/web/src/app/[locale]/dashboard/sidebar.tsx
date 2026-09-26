'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
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
  Search,
  ChevronDown,
  Plus,
  LogOut,
  ChevronLeft,
  Briefcase,
  Target,
  Phone,
  Mail,
  Calendar,
  Database,
  Activity,
  Webhook,
  ListOrdered,
  Gauge,
  Bell,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
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
}

export function Sidebar({ collapsed = false, onToggle, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const t = useTranslations();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const tenantRef = useRef<HTMLDivElement>(null);

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
      .catch(() => {});
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
        { name: 'Повідомлення', href: '/dashboard/messages', icon: MessageSquare, badge: unreadMessages },
        { name: 'Сповіщення', href: '/dashboard/notifications', icon: Bell, badge: unreadMessages },
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
      label: 'Система',
      items: [
        { name: 'Моніторинг кешу', href: '/dashboard/cache', icon: Database },
        { name: 'Черги задач', href: '/dashboard/queues', icon: ListOrdered },
        { name: 'Вебхуки', href: '/dashboard/webhooks', icon: Webhook },
        { name: 'Спостережуваність', href: '/dashboard/observability', icon: Gauge },
        { name: 'Логи', href: '/dashboard/logs', icon: Activity },
      ],
    },
  ];

  const filteredGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !search || item.name.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const user = session?.user;

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-black bg-[#0C0C0D] text-white transition-all duration-300 ease-out',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <Link href="/dashboard" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFC700] shadow-[0_8px_20px_-8px_rgba(255,199,0,0.7)]">
          <Zap className="h-5 w-5 text-[#111214]" strokeWidth={2.5} />
        </Link>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-lg font-bold tracking-tight text-white">CRM-Next</span>
          </div>
        )}
      </div>

      {/* Tenant switcher */}
      {!collapsed && currentTenant && (
        <div className="relative border-b border-white/10 px-4 py-3" ref={tenantRef}>
          <button
            onClick={() => setTenantOpen(!tenantOpen)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-200 hover:bg-white/10"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFC700]/15 text-sm font-bold text-[#FFC700]">
              {currentTenant.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{currentTenant.name}</p>
              <p className="text-xs text-white/50 truncate">/{currentTenant.slug}</p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-white/50 transition-transform duration-200',
                tenantOpen && 'rotate-180'
              )}
            />
          </button>

          {tenantOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTenantOpen(false)} />
              <div className="absolute left-4 right-4 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#141416] shadow-xl">
                <div className="p-2">
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                    Організації
                  </p>
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => switchTenant(tenant)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150',
                        currentTenant.id === tenant.id
                          ? 'bg-[#FFC700] font-semibold text-[#111214]'
                          : 'text-white hover:bg-white/10'
                      )}
                    >
                      <div className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                        currentTenant.id === tenant.id ? 'bg-black/10 text-[#111214]' : 'bg-white/10 text-[#FFC700]'
                      )}>
                        {tenant.name.charAt(0)}
                      </div>
                      <span className="truncate">{tenant.name}</span>
                    </button>
                  ))}
                  <div className="mt-1 border-t border-white/10 pt-1">
                    <Link
                      href="/dashboard/settings/tenants/new"
                      onClick={() => setTenantOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white"
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

      {/* Search */}
      {!collapsed && (
        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              placeholder="Пошук..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white transition-all duration-200 placeholder:text-white/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {filteredGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
                {group.label}
              </h3>
            )}
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
                        ? 'bg-[#FFC700] font-semibold text-[#111214] shadow-[0_8px_20px_-10px_rgba(255,199,0,0.8)]'
                        : 'text-white/65 hover:bg-white/10 hover:text-white',
                      item.accent && !isActive && 'text-[#FFC700]/80 hover:text-[#FFC700]',
                      collapsed && 'justify-center px-2'
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon
                      className={cn(
                        'h-5 w-5 flex-shrink-0 transition-colors duration-200',
                        isActive
                          ? 'text-[#111214]'
                          : 'text-white/50 group-hover:text-white',
                        item.accent && !isActive && 'text-[#FFC700]/70 group-hover:text-[#FFC700]'
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.name}</span>
                        {'badge' in item && item.badge && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {isActive && !collapsed && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#111214]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          href="/dashboard/settings"
          onClick={onMobileClose}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
            pathname.startsWith('/dashboard/settings')
              ? 'bg-[#FFC700] font-semibold text-[#111214]'
              : 'text-white/65 hover:bg-white/10 hover:text-white',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Налаштування' : undefined}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Налаштування</span>}
        </Link>

        <button
          onClick={onToggle}
          className={cn(
            'hidden lg:flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 transition-all duration-200 hover:bg-white/10 hover:text-white',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Розгорнути' : 'Згорнути'}
        >
          <ChevronLeft
            className={cn(
              'h-5 w-5 flex-shrink-0 transition-transform duration-300',
              collapsed && 'rotate-180'
            )}
          />
          {!collapsed && <span>Згорнути</span>}
        </button>

        {!collapsed && user && (
          <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 mt-2">
            <Avatar name={user.name || user.email || '?'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{user.name || 'User'}</p>
              <p className="text-xs text-white/50 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="rounded-lg p-1.5 text-white/50 transition-all duration-200 hover:bg-danger/20 hover:text-danger"
              title="Вийти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
