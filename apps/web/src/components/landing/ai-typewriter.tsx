'use client';

import { motion, MotionConfig } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * «AI Co-Pilot»: анімований рядок пошуку — запит друкується, думка збирається
 * з трьох чорнильних крапок («Аналізую дані CRM…»), відповідь стрімиться
 * послівно з кареткою, як жива. При prefers-reduced-motion — статичний приклад.
 */

const DEMOS = [
  {
    q: 'Які угоди під ризиком?',
    a: '3 угоди без активності більше 5 днів: ТОВ «Орбіта», ФОП «Коло», «Гама». Раджу почати з «Орбіта» — ₴140 тис.',
  },
  {
    q: 'Кому подзвонити сьогодні?',
    a: '4 контакти з простроченими задачами: Марія Коваль, Ігор Савчук, «Ліга», Анна Петренко.',
  },
  {
    q: 'Підсумок продажів за тиждень',
    a: '7 угод на ₴410 тис. Найкраще джерело — заявки з сайту: 4 з 7 угод.',
  },
];

const STREAM_MS = 70;
const THINK_MS = 1500;
const HOLD_MS = 3000;

type Phase = 'typing' | 'thinking' | 'answer';

export function AiTypewriter() {
  const [demo, setDemo] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const [typed, setTyped] = useState('');
  const [streamed, setStreamed] = useState(0);

  const words = DEMOS[demo].a.split(' ');
  const streaming = phase === 'answer' && streamed < words.length;

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setTyped(DEMOS[0].q);
      setStreamed(DEMOS[0].a.split(' ').length);
      setPhase('answer');
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      const timer = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(timer);
    };

    const runAnswer = (index: number) => {
      setStreamed(0);
      setPhase('answer');
      const total = DEMOS[index].a.split(' ').length;
      for (let w = 1; w <= total; w += 1) {
        later(() => setStreamed(w), w * STREAM_MS);
      }
      later(() => runTyping((index + 1) % DEMOS.length), total * STREAM_MS + HOLD_MS);
    };

    const runTyping = (index: number) => {
      if (cancelled) return;
      setDemo(index);
      setPhase('typing');
      setTyped('');
      const text = DEMOS[index].q;
      let char = 0;

      const typeChar = () => {
        if (cancelled) return;
        char += 1;
        setTyped(text.slice(0, char));
        if (char < text.length) {
          later(typeChar, 55);
        } else {
          later(() => {
            setPhase('thinking');
            later(() => runAnswer(index), THINK_MS);
          }, 400);
        }
      };
      typeChar();
    };

    runTyping(0);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <span className="inline-flex items-center gap-2 text-sm font-bold">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            AI Co-Pilot
          </span>
          <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
            запит природною мовою
          </span>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3">
            <Search className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden="true" />
            <p className="min-h-[1.25rem] flex-1 truncate text-sm">
              {typed}
              <span
                className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle"
                aria-hidden="true"
              />
            </p>
          </div>

          <div className="mt-3 min-h-[96px]">
            {phase === 'thinking' && (
              <p className="flex items-center gap-2.5 text-sm text-foreground-secondary">
                <span className="flex items-center gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-foreground"
                      animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
                      transition={{
                        duration: 1.26,
                        repeat: Infinity,
                        delay: i * 0.17,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </span>
                Аналізую дані CRM…
              </p>
            )}
            {phase === 'answer' && (
              <div className="rounded-xl bg-primary-light px-4 py-3">
                <p className="text-sm leading-6">
                  {words.slice(0, streamed).join(' ')}
                  {streaming && (
                    <span
                      className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle"
                      aria-hidden="true"
                    />
                  )}
                </p>
                {!streaming && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="mt-2 flex flex-wrap gap-2"
                  >
                    <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground-secondary">
                      джерело: угоди · задачі
                    </span>
                    <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground-secondary">
                      лише ваші дані
                    </span>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3.5">
          {['Які угоди під ризиком?', 'Кому подзвонити сьогодні?', 'Підсумок за тиждень'].map(
            (hint) => (
              <span
                key={hint}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground-secondary"
              >
                {hint}
              </span>
            ),
          )}
        </div>
      </div>
    </MotionConfig>
  );
}
