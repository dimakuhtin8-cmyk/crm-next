'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import {
  Home01Icon,
  UserMultipleIcon,
  ChartBarLineIcon,
  Task01Icon,
  BubbleChatIcon,
  AnalyticsUpIcon,
  Activity04Icon,
  Settings02Icon,
  BoltIcon,
} from '@hugeicons/core-free-icons';

const navigation = [
  { name: 'Огляд', href: '/dashboard', icon: Home01Icon },
  { name: 'Контакти', href: '/dashboard/contacts', icon: UserMultipleIcon },
  { name: 'Угоди', href: '/dashboard/deals', icon: ChartBarLineIcon },
  { name: 'Задачі', href: '/dashboard/tasks', icon: Task01Icon },
  { name: 'Повідомлення', href: '/dashboard/messages', icon: BubbleChatIcon },
  { name: 'Аналітика', href: '/dashboard/analytics', icon: AnalyticsUpIcon },
  { name: 'Воронки', href: '/dashboard/pipelines', icon: Activity04Icon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/25">
          <Icon icon={BoltIcon} size={20} color="white" strokeWidth={2} />
        </div>
        <span className="text-lg font-bold tracking-tight">CRM-Next</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive =
            item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-indigo-500/10 text-indigo-500 shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon
                icon={item.icon}
                size={20}
                className={isActive ? 'text-indigo-500' : ''}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="border-t border-border p-4">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
            pathname.startsWith('/settings')
              ? 'bg-indigo-500/10 text-indigo-500'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          <Icon icon={Settings02Icon} size={20} />
          Налаштування
        </Link>
      </div>
    </aside>
  );
}
