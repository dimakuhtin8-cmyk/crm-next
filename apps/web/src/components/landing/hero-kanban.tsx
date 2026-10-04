'use client';

import { motion, MotionConfig, useInView } from 'framer-motion';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';

/**
 * Hero: анімований міні-канбан воронки — активна картка рухається етапами
 * «Нові звернення → Кваліфікація → Угода» (Framer Motion layoutId).
 * Кожен другий візит в «Угоду» — штамп прострочки (подія, не статистика).
 */

const COLUMNS = [
  {
    name: 'Нові звернення',
    count: 48,
    cards: [
      { title: 'Заявка з сайту', sum: '₴45 тис.' },
      { title: 'Лід Instagram', sum: '₴28 тис.' },
    ],
  },
  {
    name: 'Кваліфікація',
    count: 31,
    cards: [
      { title: 'ФОП «Коло»', sum: '₴86 тис.' },
      { title: 'ТОВ «Ліга»', sum: '₴210 тис.' },
    ],
  },
  {
    name: 'Угода',
    count: 6,
    cards: [
      { title: 'ТОВ «Альфа»', sum: '₴120 тис.' },
      { title: 'ФОП «Колос»', sum: '₴96 тис.' },
    ],
  },
];

const MOVING_CARD = { title: 'ТОВ «Орбіта»', sum: '₴140 тис.' };
const STALE_TEXT = 'прострочено · 3 дні без активності';

const FORECAST_SUM = 585;

/** Прогноз закриття: count-up 0 → сума при першому вході у вʼюпорт. */
function ForecastCount() {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-48px' });
  const [text, setText] = useState(`₴${FORECAST_SUM} тис.`);

  useEffect(() => {
    if (!inView) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const counter = { value: 0 };
    const tween = gsap.to(counter, {
      value: FORECAST_SUM,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => setText(`₴${Math.round(counter.value)} тис.`),
    });
    return () => {
      tween.kill();
    };
  }, [inView]);

  return (
    <span ref={ref} className="font-bold tabular-nums">
      {text}
    </span>
  );
}

export function HeroKanban() {
  const [step, setStep] = useState(0);
  const [stale, setStale] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current) setStep((s) => (s + 1) % COLUMNS.length);
    }, 4900);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (step === 2) setStale((v) => !v);
  }, [step]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="landing-rise overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <p className="text-sm font-bold">Воронка продажу</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground-secondary">
            <span
              className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-success"
              aria-hidden="true"
            />
            Оновлено щойно
          </span>
        </div>

        <div className="flex snap-x gap-3 overflow-x-auto px-5 py-4 sm:grid sm:grid-cols-3 sm:gap-0 sm:overflow-visible">
          {COLUMNS.map((column, index) => (
            <motion.div
              key={column.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-48px' }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="min-w-[220px] snap-start pe-3 sm:min-w-0"
            >
              <div className="flex items-baseline justify-between gap-2 text-xs font-bold">
                <span className="truncate">{column.name}</span>
                <span className="tabular-nums text-foreground-muted">{column.count}</span>
              </div>
              <div className="mt-2.5 space-y-2.5">
                {step === index && (
                  <motion.div
                    layoutId="hero-moving-card"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    className={`rounded-lg border px-3 py-2.5 shadow-lg ${
                      index === 2
                        ? stale
                          ? 'border-danger bg-danger-light'
                          : 'border-success bg-success-light'
                        : 'border-primary bg-primary-light'
                    }`}
                  >
                    <p className="truncate text-xs font-bold text-foreground">
                      {MOVING_CARD.title}
                    </p>
                    <p
                      className={`mt-0.5 text-[11px] tabular-nums ${
                        index === 2 && stale ? 'font-bold text-danger' : 'text-foreground-secondary'
                      }`}
                    >
                      {index === 2 && stale ? STALE_TEXT : MOVING_CARD.sum}
                    </p>
                  </motion.div>
                )}
                {column.cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-lg border border-border bg-background px-3 py-2.5"
                  >
                    <p className="truncate text-xs font-semibold">{card.title}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-foreground-secondary">
                      {card.sum}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm">
          <span className="font-semibold">Прогноз закриття</span>
          <ForecastCount />
        </div>
      </div>
    </MotionConfig>
  );
}
