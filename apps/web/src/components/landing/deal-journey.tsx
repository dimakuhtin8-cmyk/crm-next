'use client';

/**
 * Hero: шлях однієї угоди — чекпоінти етапів з часом, поточний світиться,
 * імпульс пробігає треком по колу. Жодних компаній і сум: тільки механіка.
 */

import gsap from 'gsap';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

export function DealJourney() {
  const t = useTranslations('landing.dealJourney');
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  const STAGES = [
    { name: t('stages.new.name'), time: t('stages.new.time'), state: 'done' as const },
    {
      name: t('stages.qualification.name'),
      time: t('stages.qualification.time'),
      state: 'done' as const,
    },
    { name: t('stages.deal.name'), time: t('stages.deal.time'), state: 'current' as const },
    { name: t('stages.payment.name'), time: t('stages.payment.time'), state: 'next' as const },
  ];

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power1.inOut' } });
      tl.fromTo(
        fillRef.current,
        { scaleY: 0, opacity: 1 },
        { scaleY: 1, duration: 3, transformOrigin: 'top' },
      );
      tl.to(fillRef.current, { opacity: 0, duration: 0.4 });
      tl.to({}, { duration: 0.8 });

      const root = rootRef.current;
      const pause = () => tl.pause();
      const play = () => tl.play();
      root?.addEventListener('mouseenter', pause);
      root?.addEventListener('mouseleave', play);
      return () => {
        root?.removeEventListener('mouseenter', pause);
        root?.removeEventListener('mouseleave', play);
      };
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <p className="text-sm font-bold">{t('title')}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground-secondary">
          <span
            className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-success"
            aria-hidden="true"
          />
          {t('moving')}
        </span>
      </div>

      <ol className="relative space-y-1 px-5 py-5">
        <div
          className="pointer-events-none absolute bottom-6 left-[27px] top-6 w-px bg-border"
          aria-hidden="true"
        />
        <div
          ref={fillRef}
          className="pointer-events-none absolute bottom-6 left-[27px] top-6 w-px bg-success"
          aria-hidden="true"
        />
        {STAGES.map((stage) => (
          <li key={stage.name} className="relative flex items-start gap-4 py-2.5">
            <span
              className={`relative z-10 mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
                stage.state === 'done'
                  ? 'border-success bg-success'
                  : stage.state === 'current'
                    ? 'border-primary bg-primary-light'
                    : 'border-border bg-background-secondary'
              }`}
              aria-hidden="true"
            >
              {stage.state === 'current' && (
                <span className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-primary" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-bold ${
                  stage.state === 'next' ? 'text-foreground-muted' : ''
                }`}
              >
                {stage.name}
              </p>
              <p className="text-xs text-foreground-secondary">{stage.time}</p>
            </div>
            {stage.state === 'current' && (
              <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary">
                {t('hereNow')}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm">
        <span className="font-semibold">{t('slogan')}</span>
        <span className="font-bold tabular-nums text-success">{t('onTrack')}</span>
      </div>
    </div>
  );
}
