'use client';

/**
 * «Автоматизація»: конструктор правила — умова й дія зі списків,
 * кнопка «Перевірити» ганяє імпульс крізь міні-превʼю до печатки
 * «спрацює». Інтерактивне демо замість вітрини. Жодних циклів.
 */

import gsap from 'gsap';
import { FlaskConical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const CONDITIONS = ['угода мовчить 3 дні', 'лід без відповіді 2 дні', 'угода в етапі 7+ днів'];
const ACTIONS = ['створити задачу', 'написати в Telegram', 'підсвітити у воронці'];

const PREVIEW = ['Умова', 'Дія', 'Результат'];

export function RuleBuilder() {
  const [cond, setCond] = useState(0);
  const [act, setAct] = useState(0);
  const [tested, setTested] = useState(false);
  const [running, setRunning] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const stepsRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!running) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setTested(true);
      setRunning(false);
      return;
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        onComplete: () => {
          setTested(true);
          setRunning(false);
        },
      });
      dotsRef.current.forEach((dot, k) => {
        if (!dot) return;
        tl.fromTo(dot, { y: 0, opacity: 0 }, { opacity: 1, duration: 0.2 }, k * 0.55);
        tl.to(dot, { y: 14, duration: 0.6 });
        tl.to(dot, { opacity: 0, duration: 0.2 });
        tl.call(() => {
          const el = stepsRef.current[k + 1];
          el?.classList.add('border-primary', 'bg-primary-light/50');
        });
      });
    }, scopeRef);
    return () => ctx.revert();
  }, [running]);

  const test = () => {
    if (running) return;
    setTested(false);
    stepsRef.current.forEach((el) => el?.classList.remove('border-primary', 'bg-primary-light/50'));
    setRunning(true);
  };

  return (
    <div ref={scopeRef} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <p className="text-sm font-bold">
        Якщо {CONDITIONS[cond]}, то {ACTIONS[act]}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-foreground-secondary">Умова</span>
          <select
            value={cond}
            onChange={(e) => {
              setCond(Number(e.target.value));
              setTested(false);
            }}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium"
          >
            {CONDITIONS.map((c, i) => (
              <option key={c} value={i}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-foreground-secondary">Дія</span>
          <select
            value={act}
            onChange={(e) => {
              setAct(Number(e.target.value));
              setTested(false);
            }}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium"
          >
            {ACTIONS.map((a, i) => (
              <option key={a} value={i}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={test}
        disabled={running}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-inverse px-5 text-sm font-bold text-inverse-foreground transition-colors hover:bg-[#3A352F] disabled:opacity-50"
      >
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
        {running ? 'Перевіряю…' : 'Перевірити'}
      </button>

      <div className="mt-4 flex items-start gap-2" aria-hidden={!tested && !running}>
        {PREVIEW.map((label, index) => (
          <div key={label} className="flex flex-1 items-start gap-2 last:flex-none">
            <div
              ref={(el) => {
                stepsRef.current[index] = el;
              }}
              className="flex-1 rounded-xl border border-border bg-background-secondary px-3 py-2.5 text-center text-xs font-bold transition-colors"
            >
              {label}
            </div>
            {index < PREVIEW.length - 1 && (
              <div className="relative mx-0.5 h-[42px] w-px self-stretch bg-border">
                <span
                  ref={(el) => {
                    dotsRef.current[index] = el;
                  }}
                  className="absolute left-[calc(50%-3px)] top-0 h-1.5 w-1.5 rounded-full bg-primary opacity-0"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {tested && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1.5 text-xs font-bold text-success">
          Перевірка пройдена: правило спрацює
        </p>
      )}
      <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-foreground-secondary">
        Правила створює адміністратор · журнал — у розділі «Автоматизація»
      </p>
    </div>
  );
}
