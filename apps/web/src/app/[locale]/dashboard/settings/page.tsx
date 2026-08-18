'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';

const settingsSections = [
  {
    title: 'Профіль',
    description: 'Ваші персональні дані та налаштування облікового запису',
    href: '/dashboard/settings/profile',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    title: 'Компанії',
    description: 'Керування компаніями, командами та ролями',
    href: '/dashboard/settings/tenants',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Безпека',
    description: 'Пароль, двофакторна автопериферія, сесії',
    href: '/dashboard/settings/security',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: 'Сповіщення',
    description: 'Налаштування сповіщень та розсилок',
    href: '/dashboard/settings/notifications',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    title: 'Інтеграції',
    description: 'Підключення зовнішніх сервісів та API ключі',
    href: '/dashboard/settings/integrations',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    title: 'Telegram-бот',
    description: 'Підключення Telegram-бота для сповіщень та керування',
    href: '/dashboard/settings/telegram',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: 'WhatsApp Business',
    description: 'Підключення WhatsApp Business API для спілкування з клієнтами',
    href: '/dashboard/settings/whatsapp',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const pathname = usePathname();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Налаштування</h1>
        <p className="text-foreground-muted">Керуйте налаштуваннями вашого облікового запису та компанії</p>
      </div>

      <div className="grid gap-3">
        {settingsSections.map((section) => {
          const isActive = pathname === section.href || pathname.startsWith(section.href + '/');
          return (
            <Link key={section.href} href={section.href}>
              <Card
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  isActive && 'border-primary ring-1 ring-primary/20',
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground-muted',
                    )}
                  >
                    {section.icon}
                  </div>
                  <div>
                    <h3 className="font-medium">{section.title}</h3>
                    <p className="text-sm text-foreground-muted">{section.description}</p>
                  </div>
                  <svg
                    className="ml-auto h-5 w-5 text-foreground-muted"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
