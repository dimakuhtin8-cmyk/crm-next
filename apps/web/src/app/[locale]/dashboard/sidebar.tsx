'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';

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

  const navigation = [
    { name: t('navigation.dashboard'), href: '/dashboard', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg> },
    { name: t('navigation.contacts'), href: '/dashboard/contacts', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
    { name: t('navigation.deals'), href: '/dashboard/deals', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> },
    { name: t('navigation.tasks'), href: '/dashboard/tasks', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> },
    { name: t('navigation.timeline'), href: '/dashboard/timeline', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
    { name: t('navigation.messages'), href: '/dashboard/messages', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>, badge: 3 },
    { name: t('navigation.analytics'), href: '/dashboard/analytics', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg> },
    { name: t('navigation.automation'), href: '/dashboard/automation', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> },
    { name: t('navigation.copilot'), href: '/dashboard/copilot', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg> },
    { name: t('navigation.documents'), href: '/dashboard/documents', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
  ];

  const filteredNav = navigation.filter(
    (item) => !search || item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const user = session?.user;

  return (
    <aside className={cn('flex h-full flex-col border-r border-border bg-card transition-all duration-200', collapsed ? 'w-[72px]' : 'w-64')}>
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <Link href="/dashboard" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-glow">
          <svg className="h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </Link>
        {!collapsed && <span className="text-base font-bold tracking-tight">CRM-Next</span>}
      </div>

      {!collapsed && currentTenant && (
        <div className="relative border-b border-border px-3 py-2" ref={tenantRef}>
          <button onClick={() => setTenantOpen(!tenantOpen)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-secondary transition-colors">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">{currentTenant.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentTenant.name}</p>
              <p className="text-xs text-foreground-muted truncate">/{currentTenant.slug}</p>
            </div>
            <svg className={cn('h-4 w-4 text-foreground-muted transition-transform', tenantOpen && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {tenantOpen && (
            <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg">
              <div className="p-1.5">
                <p className="px-2 py-1 text-xs font-medium text-foreground-muted">{t('tenants.title')}</p>
                {tenants.map((tenant) => (
                  <button key={tenant.id} onClick={() => switchTenant(tenant)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors', currentTenant.id === tenant.id ? 'bg-primary-light text-primary' : 'hover:bg-secondary')}>
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{tenant.name.charAt(0)}</div>
                    <span className="truncate">{tenant.name}</span>
                  </button>
                ))}
                <div className="border-t border-border mt-1 pt-1">
                  <Link href="/dashboard/settings/tenants/new" onClick={() => setTenantOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground-muted hover:bg-secondary transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    {t('tenants.add')}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <input type="search" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 pl-9 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors" />
            <svg className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={onMobileClose} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive ? 'bg-primary-light text-primary' : 'text-foreground-muted hover:bg-secondary hover:text-foreground', collapsed && 'justify-center px-2')} title={collapsed ? item.name : undefined}>
              <span className={cn('flex-shrink-0 relative', isActive ? 'text-primary' : '')}>
                {item.icon}
                {'badge' in item && item.badge && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">{item.badge}</span>}
              </span>
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-1">
        <Link href="/dashboard/settings" onClick={onMobileClose} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', pathname.startsWith('/dashboard/settings') ? 'bg-primary-light text-primary' : 'text-foreground-muted hover:bg-secondary hover:text-foreground', collapsed && 'justify-center px-2')} title={collapsed ? t('navigation.settings') : undefined}>
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          {!collapsed && <span>{t('navigation.settings')}</span>}
        </Link>

        <button onClick={onToggle} className={cn('hidden lg:flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition-all hover:bg-secondary hover:text-foreground', collapsed && 'justify-center px-2')} title={collapsed ? t('common.next') : t('common.back')}>
          <svg className={cn('h-5 w-5 flex-shrink-0 transition-transform', collapsed && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
          {!collapsed && <span>{t('common.back')}</span>}
        </button>

        {!collapsed && user && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2">
            <Avatar name={user.name || user.email || '?'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || 'User'}</p>
              <p className="text-xs text-foreground-muted truncate">{user.email}</p>
            </div>
            <button onClick={() => signOut({ callbackUrl: '/auth/login' })} className="rounded p-1 text-foreground-muted hover:text-danger transition-colors" title={t('auth.logout')}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
