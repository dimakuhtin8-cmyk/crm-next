'use client';

/**
 * Auth-зона шапки лендинга: при активній сесії показує шлях у CRM
 * замість кнопок входу. Захищено від миготіння: поки статус невідомий,
 * рендериться гостьовий варіант (як у SSR).
 */

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

export function HeaderDesktopAuth({ locale }: { locale: string }) {
  const t = useTranslations('landing');
  const { data: session, status } = useSession();

  if (status === 'authenticated' && session?.user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden max-w-40 truncate text-sm font-medium text-inverse-muted sm:inline">
          {session.user.name ?? session.user.email}
        </span>
        <Link
          href={`/${locale}/dashboard`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-inverse px-5 text-sm font-bold text-inverse-foreground shadow-[0_10px_24px_-12px_rgba(74,60,40,0.45)] transition-colors hover:bg-[#3A352F]"
        >
          {t('cta.openCrm')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href={`/${locale}/auth/login`}
        className="hidden text-sm font-semibold text-inverse-foreground underline-offset-4 hover:underline sm:inline"
      >
        {t('cta.login')}
      </Link>
      <Link
        href={`/${locale}/auth/register`}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-inverse px-5 text-sm font-bold text-inverse-foreground shadow-[0_10px_24px_-12px_rgba(74,60,40,0.45)] transition-colors hover:bg-[#3A352F]"
      >
        {t('cta.tryFree')}
      </Link>
    </div>
  );
}

export function HeaderMobileAuth({ locale }: { locale: string }) {
  const t = useTranslations('landing');
  const { status } = useSession();
  const itemClass = 'block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary';

  if (status === 'authenticated') {
    return (
      <Link href={`/${locale}/dashboard`} className={itemClass}>
        {t('cta.openCrm')}
      </Link>
    );
  }

  return (
    <>
      <Link href={`/${locale}/auth/login`} className={itemClass}>
        {t('cta.login')}
      </Link>
      <Link href={`/${locale}/auth/register`} className={itemClass}>
        {t('cta.tryFree')}
      </Link>
    </>
  );
}
