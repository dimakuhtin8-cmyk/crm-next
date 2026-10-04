'use client';

/**
 * «Можливості»: sticky-навігація ліворуч (активна печатка синхронізується
 * IntersectionObserver, Framer Motion — плавний індикатор) і п'ять томів
 * праворуч, що розкриваються каскадом по скролу. Akari world: плоский папір,
 * печатка-статус, чорнило ручки. Жодних вкладених карток.
 * Motion: одна пружина 320/30 на всі layout-переїзди, цикли на спільному
 * каденсі, входи — expo-out із видимого стану.
 */

import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { AutomationPreview } from '@/components/landing/automation-preview';
import { BazaPreview } from '@/components/landing/baza-preview';
import { CommsPreview } from '@/components/landing/comms-preview';
import { RolesPreview } from '@/components/landing/roles-preview';
import { SectionLink } from '@/components/landing/section-link';
import { SettingsPreview } from '@/components/landing/settings-preview';

const MOVE_SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const;
const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const HEARTBEAT_MS = 4900;

const features = [
  { id: 'baza', label: 'База і воронка' },
  { id: 'chat', label: 'Комунікація' },
  { id: 'auto', label: 'Автоматизація' },
  { id: 'audit', label: 'Аналітика і доступ' },
  { id: 'ai', label: 'AI & Налаштування' },
];

const CHANNEL_NOTES = [
  {
    name: 'Telegram',
    text: 'Листування, нотатки й нагадування залишаються в картці клієнта.',
    tone: 'bg-info-light text-info',
  },
  {
    name: 'WhatsApp',
    text: 'Повідомлення клієнтів прив’язуються до контактів та угод.',
    tone: 'bg-success-light text-success',
  },
  {
    name: 'Email',
    text: 'Листи й заявки прив’язуються до контактів та угод.',
    tone: 'bg-primary-light text-primary',
  },
];

const BAZA_CHECKLIST = [
  'Імпорт бази та дедублікація контактів',
  'Картка клієнта: комунікація, файли, завдання',
  'Канбан воронки з drag-and-drop',
];

/** Том розділу: розкривається clip-розгорткою по входу у вʼюпорт, один раз. */
function Volume({ id, index, children }: { id: string; index: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div id={id} className="scroll-mt-28 border-t-2 border-border-hover pt-10">
        {children}
      </div>
    );
  }
  return (
    <motion.div
      id={id}
      initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0.35 }}
      whileInView={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
      viewport={{ once: true, margin: '-64px' }}
      transition={{ duration: 0.8, delay: Math.min(index * 0.07, 0.35), ease: EXPO_OUT }}
      className="scroll-mt-28 border-t-2 border-border-hover pt-10"
    >
      {children}
    </motion.div>
  );
}

const KANBAN_COLS = [
  {
    label: 'Нові (2)',
    static: 'ТОВ «Альфа» — 140k',
    moverStep: 0,
    moverFirst: false,
    moverTone: 'border-primary bg-primary-light text-primary',
  },
  {
    label: 'Кваліфікація',
    static: 'ФОП «Колос» — 89k',
    moverStep: 1,
    moverFirst: true,
    moverTone: 'border-success bg-success-light text-success',
  },
  {
    label: 'Угода',
    static: 'ТОВ «Вектор» — 520k',
    moverStep: -1,
    moverFirst: false,
    moverTone: '',
  },
];

/** Міні-канбан «База»: картка-печатка переїжджає між етапами (layoutId). */
function KanbanPreview() {
  const [step, setStep] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current) setStep((s) => (s + 1) % 2);
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div
        className="flex snap-x gap-3 overflow-x-auto rounded-xl border border-border bg-background-secondary p-4 sm:grid sm:grid-cols-3"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
      >
        {KANBAN_COLS.map((col, index) => (
          <motion.div
            key={col.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-48px' }}
            transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-[200px] snap-start space-y-2 sm:min-w-0"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
              {col.label}
            </span>
            {col.moverFirst && step === col.moverStep && (
              <motion.div
                layoutId="moving-card"
                transition={MOVE_SPRING}
                className={`rounded-lg border-2 p-3 text-xs font-bold shadow-sm ${col.moverTone}`}
              >
                LTD Instagram — 82k
              </motion.div>
            )}
            <div className="rounded-lg border border-border bg-card p-3 text-xs text-foreground">
              {col.static}
            </div>
            {!col.moverFirst && step === col.moverStep && (
              <motion.div
                layoutId="moving-card"
                transition={MOVE_SPRING}
                className={`rounded-lg border-2 p-3 text-xs font-bold shadow-sm ${col.moverTone}`}
              >
                LTD Instagram — 82k
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
      <motion.p
        key={step}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mt-3 text-xs text-foreground-secondary"
      >
        {step === 0 ? 'LTD Instagram — новий лід у воронці' : 'LTD Instagram — лід у кваліфікації'}
      </motion.p>
    </>
  );
}

export function StickyFeatures() {
  const [activeTab, setActiveTab] = useState('baza');
  // Скоуп піддерева: у видачі Next лежить прихований prerender-дублікат
  // (div#S:0), тому document.getElementById брав би невидимі копії.
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = rootRef.current ?? document;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          setActiveTab(visible.target.id.replace('section-', ''));
        }
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75] },
    );

    features.forEach((feature) => {
      const element = scope.querySelector(`#section-${feature.id}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const handleNav = (id: string) => {
    setActiveTab(id);
    rootRef.current
      ?.querySelector(`#section-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Sticky-навігація: плоский папір, активна — печатка */}
          <div className="z-10 flex gap-2 overflow-x-auto rounded-xl border border-border bg-background-secondary p-3 lg:sticky lg:top-28 lg:col-span-4 lg:block lg:space-y-1 lg:overflow-visible">
            <h3 className="hidden px-4 pb-2 pt-2 text-xl font-bold lg:block">Можливості</h3>
            {features.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => handleNav(feature.id)}
                className={`relative w-auto shrink-0 whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors duration-200 lg:w-full lg:whitespace-normal ${
                  activeTab === feature.id
                    ? 'text-primary-foreground'
                    : 'text-foreground-secondary hover:bg-secondary hover:text-foreground'
                }`}
              >
                {activeTab === feature.id && (
                  <motion.span
                    layoutId="active-feature-tab"
                    className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                    transition={MOVE_SPRING}
                  />
                )}
                <span className="relative">{feature.label}</span>
              </button>
            ))}
            <SectionLink
              href="#trial"
              className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-inverse px-7 text-sm font-bold text-inverse-foreground transition-colors hover:bg-[#3A352F]"
            >
              Спробувати безкоштовно
            </SectionLink>
          </div>

          {/* Пʼять томів, розділених rib-лініями */}
          <div className="space-y-14 lg:col-span-8">
            <Volume id="section-baza" index={0}>
              <h3 className="mb-2 text-2xl font-bold">Кожна угода на своєму місці</h3>
              <p className="mb-6 text-foreground-secondary">
                Угоди рухаються етапами, прострочене підсвічується автоматично.
              </p>
              <KanbanPreview />
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <BazaPreview />
                <ul className="divide-y divide-border border-y border-border">
                  {BAZA_CHECKLIST.map((item) => (
                    <li key={item} className="flex items-start gap-3 py-3.5 text-sm font-medium">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Volume>

            <Volume id="section-chat" index={1}>
              <h3 className="mb-2 text-2xl font-bold">Листування, яке не губиться</h3>
              <p className="mb-6 text-foreground-secondary">
                Telegram, WhatsApp та Email в єдиній вхідній скриньці (без телефонії).
              </p>
              <CommsPreview />
              <div className="mt-6 divide-y divide-border border-y border-border">
                {CHANNEL_NOTES.map((channel) => (
                  <div key={channel.name} className="flex items-start gap-3 py-3">
                    <span
                      className={`mt-0.5 inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${channel.tone}`}
                    >
                      {channel.name}
                    </span>
                    <p className="text-sm leading-6 text-foreground-secondary">{channel.text}</p>
                  </div>
                ))}
              </div>
            </Volume>

            <Volume id="section-auto" index={2}>
              <h3 className="mb-2 text-2xl font-bold">Правила працюють, поки ви продаєте</h3>
              <p className="mb-6 text-foreground-secondary">
                Правила самі розподіляють лідів та рухають угоди.
              </p>
              <AutomationPreview />
            </Volume>

            <Volume id="section-audit" index={3}>
              <h3 className="mb-2 text-2xl font-bold">Контроль без мікроменеджменту</h3>
              <p className="mb-6 text-foreground-secondary">
                Видно джерела лідів і завантаженість команди, а доступ — за ролями: кожна дія з
                даними потрапляє в журнал аудиту.
              </p>
              <RolesPreview />
            </Volume>

            <Volume id="section-ai" index={4}>
              <h3 className="mb-2 text-2xl font-bold">Відповіді з ваших даних, а не з повітря</h3>
              <p className="mb-6 text-foreground-secondary">
                Підключайте власні AI-ключі, налаштовуйте вебхуки та інтеграції, стежте за
                використанням AI у журналі.
              </p>
              <SettingsPreview />
            </Volume>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
