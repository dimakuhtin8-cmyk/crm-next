'use client';

/**
 * «База»: імпорт → дедублікація. Три картки-джерела зливаються в одну
 * (layout-анімація), печатка «3 → 1». Один прогін + кнопка повтору,
 * ніяких нескінченних циклів. При reduced-motion — одразу результат.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

const STEP_MS = 1200;

export function MergeDemo() {
  const t = useTranslations('landing.merge');
  const [phase, setPhase] = useState(0);
  const [runId, setRunId] = useState(0);
  const pausedRef = useRef(false);

  const SOURCES = [
    { source: 'Instagram', name: t('nameMaria'), field: '@maria_k' },
    { source: t('sourceSite'), name: t('nameMariaShort'), field: 'maria.koval@gmail.com' },
    { source: 'Excel', name: t('nameMaria'), field: '+380 ·· ··· 67' },
  ];

  useEffect(() => {
    if (phase >= 3) return;
    const timer = setInterval(() => {
      if (!pausedRef.current) setPhase((p) => Math.min(p + 1, 3));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [phase, runId]);

  const merged = phase >= 3;

  return (
    <div
      className="rounded-xl border border-border bg-background-secondary p-4"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
          {t('title')}
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase(0);
            setRunId((n) => n + 1);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold transition-colors hover:border-border-hover hover:bg-secondary"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('again')}
        </button>
      </div>

      <div key={runId} className="mt-3">
        <AnimatePresence mode="popLayout">
          {!merged &&
            SOURCES.map((card, index) => (
              <motion.div
                key={card.source}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, delay: index * 0.12, ease: 'easeOut' }}
                layoutId={`merge-${card.source}`}
                className={`mb-2 rounded-lg border bg-card p-3 last:mb-0 ${
                  phase >= 1 && index > 0 ? 'border-primary' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-bold">
                    {card.name} <span className="font-medium text-foreground-muted">·</span>{' '}
                    <span className="font-medium text-foreground-secondary">{card.field}</span>
                  </p>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-foreground-secondary">
                    {card.source}
                  </span>
                </div>
                {phase >= 1 && index > 0 && (
                  <p className="mt-1 text-[11px] font-bold text-primary">{t('duplicate')}</p>
                )}
              </motion.div>
            ))}
        </AnimatePresence>

        {merged && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-lg border-2 border-success bg-card p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold">{t('nameMaria')}</p>
              <span className="shrink-0 rounded-full bg-success px-2.5 py-1 text-[11px] font-bold text-white">
                3 → 1
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {['@maria_k', 'maria.koval@gmail.com', '+380 ·· ··· 67'].map((field) => (
                <li
                  key={field}
                  className="flex items-center gap-1.5 text-xs text-foreground-secondary"
                >
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  {field}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}
