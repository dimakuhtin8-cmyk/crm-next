'use client';

/**
 * «Автоматизація»: вузли правила з послідовним імпульсом виконання —
 * один GSAP-timeline веде крапку між вузлами і підсвічує активний вузол
 * печаткою. Пауза по hover. При reduced-motion — статична схема.
 */

import gsap from 'gsap';
import { Bell, ClipboardList, Flag, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const NODES = [
  { icon: Timer, label: 'Умова: угода 3 дні без активності', meta: 'перевірка щоранку' },
  {
    icon: ClipboardList,
    label: 'Створити завдання менеджеру',
    meta: 'відповідальний — власник угоди',
  },
  { icon: Bell, label: 'Нагадати керівнику', meta: 'сповіщення в CRM і Telegram' },
  { icon: Flag, label: 'Підсвітити угоду у воронці', meta: 'етап стає «під ризиком»' },
];

const DOT_TRAVEL_S = 1.9;
const DOT_FADE_S = 0.3;
const DWELL_S = 1.2;

export function AutomationPreview() {
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'none' } });
      tl.call(() => setActive(0));
      NODES.slice(0, -1).forEach((_, k) => {
        const dot = dotsRef.current[k];
        if (!dot) return;
        tl.fromTo(dot, { y: 0, opacity: 0 }, { opacity: 1, duration: DOT_FADE_S });
        tl.to(dot, { y: 14, duration: DOT_TRAVEL_S });
        tl.to(dot, { opacity: 0, duration: DOT_FADE_S });
        tl.call(() => setActive(k + 1));
      });
      tl.to({}, { duration: DWELL_S });

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
    <div ref={rootRef} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">Правило: угоди під ризиком</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-light px-2.5 py-1 text-xs font-semibold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          увімкнено
        </span>
      </div>

      <ol className="mt-4">
        {NODES.map((node, index) => {
          const Icon = node.icon;
          const isActive = active === index;
          return (
            <li key={node.label}>
              <div
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:border-border-hover ${
                  isActive
                    ? 'border-primary bg-primary-light/50'
                    : 'border-border bg-background-secondary'
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 shrink-0 animate-pulse-subtle items-center justify-center rounded-lg ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary-light text-primary'
                  }`}
                  style={{ animationDelay: `${index * 0.4}s` }}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{node.label}</p>
                  <p className="truncate text-xs text-foreground-secondary">{node.meta}</p>
                </div>
                <span className="ml-auto shrink-0 self-center text-[11px] font-bold tabular-nums text-foreground-muted">
                  {index + 1}/{NODES.length}
                </span>
              </div>
              {index < NODES.length - 1 && (
                <div className="relative mx-auto h-5 w-px bg-border" aria-hidden="true">
                  <span
                    ref={(el) => {
                      dotsRef.current[index] = el;
                    }}
                    className="absolute left-[calc(50%-3px)] top-0 h-1.5 w-1.5 rounded-full bg-primary opacity-0"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 border-t border-border pt-3 font-mono text-xs text-foreground-secondary">
        Правило виконано 12 разів за тиждень · журнал у розділі «Автоматизація»
      </p>
    </div>
  );
}
