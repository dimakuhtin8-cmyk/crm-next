'use client';

import { Search, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * «AI Co-Pilot»: анімований рядок пошуку з ефектом друку — запити природною
 * мовою до даних CRM, потім «Аналізую дані CRM…» і відповідь. Без таймерів
 * при prefers-reduced-motion (показується статичний приклад).
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

type Phase = 'typing' | 'thinking' | 'answer';

export function AiTypewriter() {
  const [demo, setDemo] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setTyped(DEMOS[0].q);
      setPhase('answer');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

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
          timer = setTimeout(typeChar, 55);
        } else {
          timer = setTimeout(() => {
            if (cancelled) return;
            setPhase('thinking');
            timer = setTimeout(() => {
              if (cancelled) return;
              setPhase('answer');
              timer = setTimeout(() => runTyping((index + 1) % DEMOS.length), 3400);
            }, 900);
          }, 400);
        }
      };
      typeChar();
    };

    runTyping(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
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
            <p className="flex items-center gap-2 text-sm text-foreground-secondary">
              <span
                className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-primary"
                aria-hidden="true"
              />
              Аналізую дані CRM…
            </p>
          )}
          {phase === 'answer' && (
            <div className="rounded-xl bg-primary-light px-4 py-3">
              <p className="text-sm leading-6">{DEMOS[demo].a}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground-secondary">
                  джерело: угоди · задачі
                </span>
                <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground-secondary">
                  лише ваші дані
                </span>
              </div>
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
  );
}
