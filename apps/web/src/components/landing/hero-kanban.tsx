'use client';

import { motion, MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Hero: анімований міні-канбан воронки — активна картка рухається етапами
 * «Нові звернення → Кваліфікація → Угода» (Framer Motion layoutId).
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

export function HeroKanban() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % COLUMNS.length), 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-rise overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
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

        <div className="grid grid-cols-3 px-5 py-4">
          {COLUMNS.map((column, index) => (
            <div key={column.name} className="pe-3">
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
                        ? 'border-success bg-success-light'
                        : 'border-primary bg-primary-light'
                    }`}
                  >
                    <p className="truncate text-xs font-bold text-foreground">
                      {MOVING_CARD.title}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-foreground-secondary">
                      {MOVING_CARD.sum}
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
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm">
          <span className="font-semibold">Прогноз закриття</span>
          <span className="font-bold tabular-nums">₴730 тис.</span>
        </div>
      </div>
    </MotionConfig>
  );
}
