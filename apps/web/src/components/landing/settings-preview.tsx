/**
 * «AI & Розширенні налаштування»: рядки налаштувань — API-ключі,
 * вебхуки, інтеграції та журнал AI-запитів.
 */

'use client';

import { motion } from 'framer-motion';
import { KeyRound, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function SettingsPreview() {
  const t = useTranslations('landing.settings');

  const ROWS = [
    {
      icon: KeyRound,
      label: t('keysLabel'),
      value: 'sk-••••••••••4f2a',
      badge: { text: t('connected'), tone: 'bg-success-light text-success' },
    },
    {
      icon: Webhook,
      label: t('webhooksLabel'),
      value: 'https://api…/hooks/crm',
      badge: { text: t('webhooksActive'), tone: 'bg-primary-light text-primary' },
    },
  ] as const;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">{t('title')}</p>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground-secondary">
          {t('badge')}
        </span>
      </div>

      <motion.ul
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
        viewport={{ once: true, margin: '-48px' }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background-secondary"
      >
        {ROWS.map((row) => {
          const Icon = row.icon;
          return (
            <li
              key={row.label}
              className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-secondary"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground-secondary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.label}</p>
                <p className="truncate font-mono text-xs text-foreground-secondary">{row.value}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${row.badge.tone}`}
              >
                {row.badge.text}
              </span>
            </li>
          );
        })}
        <li className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-secondary">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary text-sm font-bold">
            AI
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t('aiLogTitle')}</p>
            <p className="truncate text-xs text-foreground-secondary">{t('aiLogDesc')}</p>
          </div>
          <span className="shrink-0 text-xs font-bold text-primary">{t('open')}</span>
        </li>
      </motion.ul>

      <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-foreground-secondary">
        {t('note')}
      </p>
    </div>
  );
}
