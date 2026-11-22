'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';

interface SettingsItem {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const GROUPS: Array<{ title: string; items: SettingsItem[] }> = [
  {
    title: 'groupProfileSecurity',
    items: [
      {
        title: 'profile',
        description: 'profileCardDescription',
        href: '/dashboard/settings/profile',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
      {
        title: 'security',
        description: 'securityCardDescription',
        href: '/dashboard/settings/security',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ),
      },
      {
        title: 'twoFactorCardTitle',
        description: 'twoFactorCardDescription',
        href: '/dashboard/settings/two-factor',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
      {
        title: 'notifications',
        description: 'notificationsCardDescription',
        href: '/dashboard/settings/notifications',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'groupCompanyTeam',
    items: [
      {
        title: 'companiesCardTitle',
        description: 'companiesCardDescription',
        href: '/dashboard/settings/tenants',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        title: 'rolesCardTitle',
        description: 'rolesCardDescription',
        href: '/dashboard/settings/roles',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
      {
        title: 'auditCardTitle',
        description: 'auditCardDescription',
        href: '/dashboard/settings/audit',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'groupIntegrationsAi',
    items: [
      {
        title: 'integrations',
        description: 'integrationsCardDescription',
        href: '/dashboard/settings/integrations',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        ),
      },
      {
        title: 'aiKeysCardTitle',
        description: 'aiKeysCardDescription',
        href: '/dashboard/settings/ai-keys',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        ),
      },
      {
        title: 'aiUsageCardTitle',
        description: 'aiUsageCardDescription',
        href: '/dashboard/settings/ai-usage',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
      },
      {
        title: 'telegramBotCardTitle',
        description: 'telegramBotCardDescription',
        href: '/dashboard/settings/telegram',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        title: 'whatsappBusinessCardTitle',
        description: 'whatsappBusinessCardDescription',
        href: '/dashboard/settings/whatsapp',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        ),
      },
      {
        title: 'databaseCardTitle',
        description: 'databaseCardDescription',
        href: '/dashboard/settings/database',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'groupBilling',
    items: [
      {
        title: 'billingCardTitle',
        description: 'billingCardDescription',
        href: '/dashboard/settings/billing',
        icon: (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        ),
      },
    ],
  },
];

export default function SettingsPage() {
  const pathname = usePathname();
  const t = useTranslations('settings');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-foreground-muted">{t('pageDescription')}</p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            {t(group.title)}
          </h2>
          <div className="grid gap-3">
            {group.items.map((section) => {
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
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-foreground-muted',
                        )}
                      >
                        {section.icon}
                      </div>
                      <div>
                        <h3 className="font-medium">{t(section.title)}</h3>
                        <p className="text-sm text-foreground-muted">{t(section.description)}</p>
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
        </section>
      ))}
    </div>
  );
}
