import Link from 'next/link';

import type { ReactNode } from 'react';

import { LegalNav } from '@/components/legal/legal-nav';
import { siteOwnerLine, SITE_OWNER } from '@/lib/legal/company';

export default async function LegalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2"
            aria-label="CRM-Next — на головну"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <span className="text-base font-bold tracking-tight">CRM-Next</span>
          </Link>
          <LegalNav locale={locale} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-8 text-sm text-foreground-secondary sm:px-6">
          <p>Власник сайту та адміністратор персональних даних — {siteOwnerLine}</p>
          <p>
            Email для зв&apos;язку:{' '}
            <a
              href={`mailto:${SITE_OWNER.email}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {SITE_OWNER.email}
            </a>
          </p>
          <p className="text-xs">
            © {new Date().getFullYear()} CRM-Next. Правова документація:{' '}
            <Link
              href={`/${locale}/legal/oferta`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Публічна оферта
            </Link>{' '}
            ·{' '}
            <Link
              href={`/${locale}/legal/privacy`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Політика конфіденційності
            </Link>{' '}
            ·{' '}
            <Link
              href={`/${locale}/legal/dpa`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Договір обробки даних (DPA)
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
