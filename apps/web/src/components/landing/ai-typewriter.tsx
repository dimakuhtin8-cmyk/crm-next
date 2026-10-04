'use client';

import { motion, MotionConfig } from 'framer-motion';
import gsap from 'gsap';
import { Search, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * «AI Co-Pilot»: демо-цикл одним GSAP-timeline — запит друкується, думка
 * збирається з трьох чорнильних крапок («Аналізую дані CRM…»), відповідь
 * стрімиться послівно з кареткою. Timeline дає паузу/продовження з коробки.
 * Хінти — кнопки: клік перезапускає демо з вибраного запиту.
 * При prefers-reduced-motion — статичний приклад.
 */

const DEMOS = [
  {
    q: 'Які угоди під ризиком?',
    a: '3 угоди без активності більше 5 днів: ТОВ «Орбіта», ФОП «Коло», «Гама». Раджу почати з «Орбіта» — ₴140 тис.',
  },
  {
    q: 'Кому написати сьогодні?',
    a: '4 контакти з простроченими задачами: Марія Коваль, Ігор Савчук, «Ліга», Анна Петренко.',
  },
  {
    q: 'Підсумок продажів за тиждень',
    a: '7 угод на ₴410 тис. Найкраще джерело — заявки з сайту: 4 з 7 угод.',
  },
];

const HINTS = [
  { label: 'Які угоди під ризиком?', demo: 0 },
  { label: 'Кому написати сьогодні?', demo: 1 },
  { label: 'Підсумок за тиждень', demo: 2 },
];

const TYPE_MS = 0.055;
const THINK_S = 1.5;
const STREAM_S = 0.07;
const HOLD_S = 3;

type Phase = 'typing' | 'thinking' | 'answer';

export function AiTypewriter() {
  const [demo, setDemo] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const [typed, setTyped] = useState('');
  const [streamed, setStreamed] = useState(0);
  const [cycle, setCycle] = useState({ index: 0, nonce: 0 });
  const scopeRef = useRef<HTMLDivElement>(null);

  const words = DEMOS[demo].a.split(' ');
  const streaming = phase === 'answer' && streamed < words.length;

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setTyped(DEMOS[cycle.index].q);
      setDemo(cycle.index);
      setStreamed(DEMOS[cycle.index].a.split(' ').length);
      setPhase('answer');
      return;
    }

    const ctx = gsap.context(() => {
      const build = (index: number) => {
        const text = DEMOS[index].q;
        const total = DEMOS[index].a.split(' ').length;
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          onComplete: () => build((index + 1) % DEMOS.length),
        });
        tl.call(() => {
          setDemo(index);
          setPhase('typing');
          setTyped('');
        });
        for (let c = 1; c <= text.length; c += 1) {
          const n = c;
          tl.call(() => setTyped(text.slice(0, n)), undefined, n * TYPE_MS);
        }
        tl.call(() => setPhase('thinking'), undefined, '+=0.4');
        tl.call(
          () => {
            setStreamed(0);
            setPhase('answer');
          },
          undefined,
          `+=${THINK_S}`,
        );
        for (let w = 1; w <= total; w += 1) {
          const n = w;
          tl.call(() => setStreamed(n), undefined, `+=${STREAM_S}`);
        }
        tl.to({}, { duration: HOLD_S });
        return tl;
      };

      const master = build(cycle.index);
      const root = scopeRef.current;
      const pause = () => master.pause();
      const play = () => master.play();
      root?.addEventListener('mouseenter', pause);
      root?.addEventListener('mouseleave', play);
      return () => {
        root?.removeEventListener('mouseenter', pause);
        root?.removeEventListener('mouseleave', play);
      };
    }, scopeRef);

    return () => ctx.revert();
  }, [cycle]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={scopeRef}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
      >
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
                {!streaming && (
                  <span className="sr-only" role="status">
                    Відповідь готова
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3.5">
          {HINTS.map((hint) => (
            <button
              key={hint.label}
              type="button"
              onClick={() => setCycle((c) => ({ index: hint.demo, nonce: c.nonce + 1 }))}
              aria-label={`Показати приклад: ${hint.label}`}
              className={`inline-flex min-h-[44px] items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                demo === hint.demo
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border bg-background text-foreground-secondary hover:border-border-hover hover:text-foreground'
              }`}
            >
              {hint.label}
            </button>
          ))}
        </div>
      </div>
    </MotionConfig>
  );
}
