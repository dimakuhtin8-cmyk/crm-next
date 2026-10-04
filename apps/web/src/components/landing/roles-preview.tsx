'use client';

/**
 * «Аналітика і доступ»: картка з ролями ( Owner / Admin / Member / Viewer ),
 * бейджами дозволів та живим журналом аудиту — новий запис дописується
 * кожен цикл (подія, не статистика).
 */

import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const ROLES = [
  {
    name: 'Owner',
    tone: 'bg-primary text-primary-foreground',
    permissions: 'Повний доступ, білінг і команда',
  },
  {
    name: 'Admin',
    tone: 'bg-primary-light text-primary',
    permissions: 'Налаштування, інтеграції, ролі',
  },
  {
    name: 'Member',
    tone: 'bg-secondary text-foreground',
    permissions: 'Свої та непризначені завдання',
  },
  {
    name: 'Viewer',
    tone: 'border border-border text-foreground-secondary',
    permissions: 'Лише читання, без експорту',
  },
];

const AUDIT = [
  { time: '10:42', text: 'Олена змінила етап угоди «Альфа»', status: 'записано', ok: true },
  { time: '10:38', text: 'viewer: експорт контактів', status: 'відмовлено', ok: false },
  { time: '09:15', text: 'Власник додав інтеграцію Telegram', status: 'записано', ok: true },
];

const ARRIVAL_POOL = [
  { time: 'щойно', text: 'Марія закрила задачу «Надіслати КП»', status: 'записано', ok: true },
  { time: 'щойно', text: 'Ігор додав нотатку до «Ліга»', status: 'записано', ok: true },
  { time: 'щойно', text: 'Олена змінила відповідального «Вектор»', status: 'записано', ok: true },
];

export function RolesPreview() {
  const [paused, setPaused] = useState(false);
  const [extra, setExtra] = useState<typeof AUDIT>([]);
  const arrivalRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      const index = arrivalRef.current;
      arrivalRef.current += 1;
      setExtra((prev) => [...prev, ARRIVAL_POOL[index % ARRIVAL_POOL.length]].slice(-2));
    }, 4900);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="grid gap-4 sm:grid-cols-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Ролі */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold">Ролі команди</p>
        <ul className="mt-3 space-y-2.5">
          {ROLES.map((role) => (
            <li
              key={role.name}
              className="rounded-xl border border-border bg-background-secondary px-3.5 py-3 transition-colors hover:border-border-hover hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${role.tone}`}>
                  {role.name}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-foreground-secondary">
                {role.permissions}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Журнал аудиту */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-bold">Журнал аудиту</p>
        </div>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background-secondary">
          {AUDIT.map((entry) => (
            <li
              key={entry.time + entry.text}
              className="flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-secondary"
            >
              <span className="shrink-0 pt-0.5 text-[11px] font-bold tabular-nums text-foreground-muted">
                {entry.time}
              </span>
              <span className="min-w-0 flex-1 text-xs leading-5">{entry.text}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  entry.ok ? 'bg-success-light text-success' : 'bg-danger-light text-danger'
                }`}
              >
                {entry.status}
              </span>
            </li>
          ))}
          {extra.map((entry, i) => (
            <motion.li
              key={`${entry.text}-${i}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex items-start gap-3 bg-primary-light/40 px-3.5 py-3 transition-colors hover:bg-secondary"
            >
              <span className="shrink-0 pt-0.5 text-[11px] font-bold tabular-nums text-primary">
                {entry.time}
              </span>
              <span className="min-w-0 flex-1 text-xs leading-5">{entry.text}</span>
              <span className="shrink-0 rounded-full bg-success-light px-2 py-0.5 text-[11px] font-bold text-success">
                {entry.status}
              </span>
            </motion.li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-2 text-xs text-foreground-secondary">
          <span
            className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-primary"
            aria-hidden="true"
          />
          Кожна дія з даними фіксується з часом і автором
        </p>
      </div>
    </div>
  );
}
