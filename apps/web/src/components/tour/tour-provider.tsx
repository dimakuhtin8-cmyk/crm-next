'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { TOURS, tourDoneKey, type TourKey } from './tour-config';

interface TourState {
  tour: TourKey | null;
  stepIndex: number;
  startTour: (key: TourKey) => void;
}

const TourContext = createContext<TourState>({
  tour: null,
  stepIndex: 0,
  startTour: () => {},
});

export function useTour(): TourState {
  return useContext(TourContext);
}

function isDone(key: TourKey): boolean {
  try {
    return localStorage.getItem(tourDoneKey(key)) === '1';
  } catch {
    return true;
  }
}

function markDone(key: TourKey): void {
  try {
    localStorage.setItem(tourDoneKey(key), '1');
  } catch {
    // localStorage недоступен — тур просто не запомнится
  }
}

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Overlay({
  tourKey,
  stepIndex,
  onNext,
  onBack,
  onClose,
}: {
  tourKey: TourKey;
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const steps = TOURS[tourKey];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const locate = useCallback(() => {
    const el = document.querySelector(step.target);
    if (!el) return false;
    el.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
    // Замер после прокрутки
    window.requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setRect(new DOMRect(r.x, r.y, r.width, r.height));
    });
    return true;
  }, [step.target]);

  useEffect(() => {
    setRect(null);
    if (!locate()) {
      // Якоря нет (пустое состояние) — пропускаем шаг
      onNext();
      return;
    }
    const onMove = () => {
      const el = document.querySelector(step.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect(new DOMRect(r.x, r.y, r.width, r.height));
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [stepIndex, tourKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Позиция подсказки: снизу от цели, иначе сверху, иначе dock снизу экрана
  let tipStyle: React.CSSProperties = { left: 16, right: 16, top: 16 };
  if (rect && typeof window !== 'undefined') {
    const w = Math.min(340, window.innerWidth - 32);
    const below = rect.bottom + 12;
    const above = rect.top - 12;
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - w - 16));
    const fitsBelow = below + 220 < window.innerHeight;
    const fitsAbove = above - 220 > 16;
    tipStyle = fitsBelow
      ? { left, top: below, width: w }
      : fitsAbove
        ? { left, top: above - 220, width: w }
        : { left: 16, right: 16, bottom: 16 };
  }

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-label={step.title}>
      {rect && typeof window !== 'undefined' ? (
        <>
          {/* Затемнение из 4 полос вокруг отверстия: цель остаётся резкой */}
          <div
            className="absolute left-0 right-0 top-0 bg-black/60 backdrop-blur-[2px]"
            style={{ height: Math.max(0, rect.top - 6) }}
            onClick={onClose}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/60 backdrop-blur-[2px]"
            style={{ top: rect.bottom + 6 }}
            onClick={onClose}
          />
          <div
            className="absolute bg-black/60 backdrop-blur-[2px]"
            style={{
              top: Math.max(0, rect.top - 6),
              height: rect.height + 12,
              left: 0,
              width: Math.max(0, rect.left - 6),
            }}
            onClick={onClose}
          />
          <div
            className="absolute bg-black/60 backdrop-blur-[2px]"
            style={{
              top: Math.max(0, rect.top - 6),
              height: rect.height + 12,
              left: rect.right + 6,
              right: 0,
            }}
            onClick={onClose}
          />
          {/* Невидимый блокировщик кликов по самому отверстию */}
          <div
            className="absolute"
            style={{
              left: rect.left - 6,
              top: rect.top - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
          />
          <div
            className="absolute rounded-xl border-2 border-primary shadow-[0_0_0_4px_rgba(79,70,229,0.25)] transition-all duration-200 pointer-events-none"
            style={{
              left: rect.left - 6,
              top: rect.top - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      )}
      <div
        ref={tipRef}
        className="absolute rounded-2xl border border-border bg-card p-4 shadow-xl"
        style={tipStyle}
      >
        <p className="text-xs font-semibold text-foreground-muted">
          Крок {stepIndex + 1} з {steps.length}
        </p>
        <h3 className="mt-1 font-bold">{step.title}</h3>
        <p className="mt-1 text-sm leading-6 text-foreground-secondary">{step.text}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            Пропустити
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={onBack}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-secondary transition-colors"
              >
                Назад
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              {isLast ? 'Готово' : 'Далі'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<TourKey | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const close = useCallback(() => {
    if (tour) markDone(tour);
    setTour(null);
    setStepIndex(0);
  }, [tour]);

  const next = useCallback(() => {
    if (!tour) return;
    if (stepIndex + 1 >= TOURS[tour].length) {
      markDone(tour);
      setTour(null);
      setStepIndex(0);
    } else {
      setStepIndex(stepIndex + 1);
    }
  }, [tour, stepIndex]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const startTour = useCallback((key: TourKey) => {
    setStepIndex(0);
    setTour(key);
  }, []);

  return (
    <TourContext.Provider value={{ tour, stepIndex, startTour }}>
      {children}
      {tour && (
        <Overlay tourKey={tour} stepIndex={stepIndex} onNext={next} onBack={back} onClose={close} />
      )}
    </TourContext.Provider>
  );
}

/** Автозапуск тура при первом визите на страницу (флаг в localStorage). */
export function useTourAutoStart(key: TourKey, enabled = true): void {
  const { startTour } = useTour();
  useEffect(() => {
    if (!enabled || isDone(key)) return;
    const t = window.setTimeout(() => {
      // Стартуем, только если есть хоть один якорь тура
      const anyTarget = TOURS[key].some((s) => document.querySelector(s.target));
      if (anyTarget) startTour(key);
      else markDone(key);
    }, 600);
    return () => window.clearTimeout(t);
  }, [key, enabled]);
}

/** Сбросить флаг прохождения (кнопка «Пройти тур»). */
export function resetTour(key: TourKey): void {
  try {
    localStorage.removeItem(tourDoneKey(key));
  } catch {
    // ignore
  }
}
