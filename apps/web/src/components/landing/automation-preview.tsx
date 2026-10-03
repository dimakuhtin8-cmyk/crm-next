'use client';

/**
 * «Автоматизація»: вузли правила з послідовним імпульсом виконання —
 * крапка біжить між вузлами (Framer Motion), іконки вузлів пульсують із зсувом.
 */

import { motion, MotionConfig } from 'framer-motion';
import { Bell, ClipboardList, Flag, Timer } from 'lucide-react';

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

export function AutomationPreview() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
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
            return (
              <li key={node.label}>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-background-secondary px-3.5 py-3 transition-colors hover:border-border-hover">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 animate-pulse-subtle items-center justify-center rounded-lg bg-primary-light text-primary"
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
                    <motion.span
                      className="absolute left-1/2 top-0 h-1.5 w-1.5 rounded-full bg-primary"
                      initial={{ x: '-50%', y: 0, opacity: 0 }}
                      animate={{ x: '-50%', y: [0, 14], opacity: [0, 1, 1, 0] }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        delay: index * 0.55,
                        ease: 'linear',
                      }}
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
    </MotionConfig>
  );
}
