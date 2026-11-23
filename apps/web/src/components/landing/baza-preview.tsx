'use client';

/**
 * «База і воронка»: приклад картки клієнта — контакти, етап, сума та наступна дія.
 */

import { useTranslations } from 'next-intl';

export function BazaPreview() {
  const t = useTranslations('landing.baza');
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-foreground-muted">
        {t('cardTitle')}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
          {t('monogram')}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{t('person')}</p>
          <p className="truncate text-xs text-foreground-secondary">{t('company')}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
          Instagram
        </span>
        <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
          {t('stage')}
        </span>
      </div>
      <ul className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-foreground-secondary">
        <li className="flex items-center justify-between gap-3">
          <span>{t('dealLabel')}</span>
          <span className="font-semibold tabular-nums text-foreground">{t('dealValue')}</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>{t('nextLabel')}</span>
          <span className="font-semibold text-foreground">{t('nextValue')}</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>{t('historyLabel')}</span>
          <span className="font-semibold text-foreground">{t('historyValue')}</span>
        </li>
      </ul>
    </div>
  );
}
