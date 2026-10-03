'use client';

/**
 * «Можливості»: sticky-навігація ліворуч (активна печатка синхронізується
 * IntersectionObserver, Framer Motion — плавний індикатор) і п'ять томів
 * праворуч, розділених бамбуковими rib-лініями. Akari world: плоский папір,
 * печатка-статус, чорнило ручки. Жодних вкладених карток.
 */

import { motion, MotionConfig } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AutomationPreview } from '@/components/landing/automation-preview';
import { BazaPreview } from '@/components/landing/baza-preview';
import { CommsPreview } from '@/components/landing/comms-preview';
import { RolesPreview } from '@/components/landing/roles-preview';
import { SettingsPreview } from '@/components/landing/settings-preview';

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

/** Міні-канбан «База»: картка-печатка переїжджає між етапами (layoutId). */
function KanbanPreview() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % 2), 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-background-secondary p-4">
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
          Нові (2)
        </span>
        <div className="rounded-lg border border-border bg-card p-3 text-xs text-foreground">
          ТОВ «Альфа» — 140k
        </div>
        {step === 0 && (
          <motion.div
            layoutId="moving-card"
            className="rounded-lg border-2 border-primary bg-primary-light p-3 text-xs font-bold text-primary shadow-sm"
          >
            LTD Instagram — 82k
          </motion.div>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
          Кваліфікація
        </span>
        {step === 1 && (
          <motion.div
            layoutId="moving-card"
            className="rounded-lg border-2 border-success bg-success-light p-3 text-xs font-bold text-success shadow-sm"
          >
            LTD Instagram — 82k
          </motion.div>
        )}
        <div className="rounded-lg border border-border bg-card p-3 text-xs text-foreground">
          ФОП «Колос» — 89k
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
          Угода
        </span>
        <div className="rounded-lg border border-border bg-card p-3 text-xs text-foreground">
          ТОВ «Вектор» — 520k
        </div>
      </div>
    </div>
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
        <h2 className="sr-only">Можливості</h2>
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Sticky-навігація: плоский папір, активна — печатка */}
          <div className="z-10 space-y-1 rounded-xl border border-border bg-background-secondary p-3 lg:sticky lg:top-28 lg:col-span-4">
            <h3 className="px-4 pb-2 pt-2 text-xl font-bold">Можливості</h3>
            {features.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => handleNav(feature.id)}
                className={`relative w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors duration-200 ${
                  activeTab === feature.id
                    ? 'text-primary-foreground'
                    : 'text-foreground-secondary hover:bg-secondary hover:text-foreground'
                }`}
              >
                {activeTab === feature.id && (
                  <motion.span
                    layoutId="active-feature-tab"
                    className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative">{feature.label}</span>
              </button>
            ))}
          </div>

          {/* Пʼять томів, розділених rib-лініями */}
          <div className="space-y-14 lg:col-span-8">
            <div id="section-baza" className="scroll-mt-28 border-t-2 border-border-hover pt-10">
              <h4 className="mb-2 text-2xl font-bold">База клієнтів і воронка без втрат</h4>
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
            </div>

            <div id="section-chat" className="scroll-mt-28 border-t-2 border-border-hover pt-10">
              <h4 className="mb-2 text-2xl font-bold">Уся комунікація — в CRM</h4>
              <p className="mb-6 text-foreground-secondary">
                Telegram, WhatsApp та Email в єдиній вхідній скриньці (БЕЗ телефонії).
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
            </div>

            <div id="section-auto" className="scroll-mt-28 border-t-2 border-border-hover pt-10">
              <h4 className="mb-2 text-2xl font-bold">Автоматизація рутини</h4>
              <p className="mb-6 text-foreground-secondary">
                Правила самі розподіляють лідів та рухають угоди.
              </p>
              <AutomationPreview />
            </div>

            <div id="section-audit" className="scroll-mt-28 border-t-2 border-border-hover pt-10">
              <h4 className="mb-2 text-2xl font-bold">Аналітика й контроль доступу</h4>
              <p className="mb-6 text-foreground-secondary">
                Видно джерела лідів і завантаженість команди, а доступ — за ролями: кожна дія з
                даними потрапляє в журнал аудиту.
              </p>
              <RolesPreview />
            </div>

            <div id="section-ai" className="scroll-mt-28 border-t-2 border-border-hover pt-10">
              <h4 className="mb-2 text-2xl font-bold">AI та розширені налаштування</h4>
              <p className="mb-6 text-foreground-secondary">
                Підключайте власні AI-ключі, налаштовуйте вебхуки та інтеграції, стежте за
                використанням AI у журналі.
              </p>
              <SettingsPreview />
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
