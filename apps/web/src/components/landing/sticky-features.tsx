'use client';

/**
 * «Можливості»: sticky-навігація ліворуч (активна вкладка синхронізується
 * IntersectionObserver під час скролу, Framer Motion — плавний індикатор)
 * і п'ять карток-секцій праворуч. Тема: #0B0C10 / #13151D / #222634,
 * акцент #2563EB, індикатори #10B981.
 */

import { motion, MotionConfig } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

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
    tone: 'bg-primary-light text-[#93C5FD]',
  },
];

const BAZA_CHECKLIST = [
  'Імпорт бази та дедублікація контактів',
  'Картка клієнта: комунікація, файли, завдання',
  'Канбан воронки з drag-and-drop',
];

/** Міні-канбан «База»: картка переїжджає між етапами (Framer Motion layoutId). */
function KanbanPreview() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % 2), 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl border border-[#222634] bg-[#0B0C10] p-4">
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
          Нові (2)
        </span>
        <div className="rounded-lg border border-[#222634] bg-[#13151D] p-3 text-xs text-white">
          ТОВ «Альфа» — 140k
        </div>
        {step === 0 && (
          <motion.div
            layoutId="moving-card"
            className="rounded-lg border border-[#2563EB] bg-[#2563EB]/20 p-3 text-xs font-medium text-white shadow-md"
          >
            LTD Instagram — 82k
          </motion.div>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
          Кваліфікація
        </span>
        {step === 1 && (
          <motion.div
            layoutId="moving-card"
            className="rounded-lg border border-[#10B981] bg-[#10B981]/20 p-3 text-xs font-medium text-white shadow-md"
          >
            LTD Instagram — 82k
          </motion.div>
        )}
        <div className="rounded-lg border border-[#222634] bg-[#13151D] p-3 text-xs text-white">
          ФОП «Колос» — 89k
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Угода</span>
        <div className="rounded-lg border border-[#222634] bg-[#13151D] p-3 text-xs text-white">
          ТОВ «Вектор» — 520k
        </div>
      </div>
    </div>
  );
}

export function StickyFeatures() {
  const [activeTab, setActiveTab] = useState('baza');

  useEffect(() => {
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
      const element = document.getElementById(`section-${feature.id}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const handleNav = (id: string) => {
    setActiveTab(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-7xl bg-[#0B0C10] px-4 py-14 sm:px-6 lg:py-20">
        <h2 className="sr-only">Можливості</h2>
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
          {/* Sticky Left Navigation */}
          <div className="z-10 space-y-3 rounded-xl border border-[#222634] bg-[#0B0C10]/80 p-4 backdrop-blur-md lg:sticky lg:top-28 lg:col-span-4">
            <h3 className="mb-4 text-xl font-bold text-white">Можливості</h3>
            {features.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => handleNav(feature.id)}
                className={`relative w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                  activeTab === feature.id
                    ? 'text-white'
                    : 'text-[#94A3B8] hover:bg-[#13151D] hover:text-white'
                }`}
              >
                {activeTab === feature.id && (
                  <motion.span
                    layoutId="active-feature-tab"
                    className="absolute inset-0 rounded-lg bg-[#2563EB] shadow-lg shadow-blue-500/20"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative">{feature.label}</span>
              </button>
            ))}
          </div>

          {/* Right Scrollable Content */}
          <div className="space-y-16 lg:col-span-8">
            {/* Card 1: База */}
            <div
              id="section-baza"
              className="group relative scroll-mt-28 overflow-hidden rounded-2xl border border-[#222634] bg-[#13151D] p-8 shadow-2xl"
            >
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#2563EB]/10 blur-3xl transition-all group-hover:bg-[#2563EB]/20"
                aria-hidden="true"
              />
              <h4 className="relative mb-2 text-2xl font-bold text-white">
                База клієнтів і воронка без втрат
              </h4>
              <p className="relative mb-6 text-[#94A3B8]">
                Угоди рухаються етапами, прострочене підсвічується автоматично.
              </p>
              <div className="relative">
                <KanbanPreview />
              </div>
              <div className="relative mt-4 grid gap-4 sm:grid-cols-2">
                <BazaPreview />
                <ul className="divide-y divide-[#222634] rounded-2xl border border-[#222634] bg-[#0B0C10] px-1">
                  {BAZA_CHECKLIST.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 px-3 py-3.5 text-sm font-medium text-white"
                    >
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Card 2: Комунікація */}
            <div
              id="section-chat"
              className="scroll-mt-28 overflow-hidden rounded-2xl border border-[#222634] bg-[#13151D] p-8 shadow-2xl"
            >
              <h4 className="mb-2 text-2xl font-bold text-white">Уся комунікація — в CRM</h4>
              <p className="mb-6 text-[#94A3B8]">
                Telegram, WhatsApp та Email в єдиній вхідній скриньці (БЕЗ телефонії).
              </p>
              <CommsPreview />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {CHANNEL_NOTES.map((channel) => (
                  <div
                    key={channel.name}
                    className="rounded-xl border border-[#222634] bg-[#0B0C10] px-4 py-3"
                  >
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${channel.tone}`}
                    >
                      {channel.name}
                    </span>
                    <p className="mt-2 text-xs leading-5 text-[#94A3B8]">{channel.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Автоматизація */}
            <div
              id="section-auto"
              className="scroll-mt-28 overflow-hidden rounded-2xl border border-[#222634] bg-[#13151D] p-8 shadow-2xl"
            >
              <h4 className="mb-2 text-2xl font-bold text-white">Автоматизація рутини</h4>
              <p className="mb-6 text-[#94A3B8]">
                Правила самі розподіляють лідів та рухають угоди.
              </p>
              <AutomationPreview />
            </div>

            {/* Card 4: Аналітика і доступ */}
            <div
              id="section-audit"
              className="scroll-mt-28 overflow-hidden rounded-2xl border border-[#222634] bg-[#13151D] p-8 shadow-2xl"
            >
              <h4 className="mb-2 text-2xl font-bold text-white">Аналітика й контроль доступу</h4>
              <p className="mb-6 text-[#94A3B8]">
                Видно джерела лідів і завантаженість команди, а доступ — за ролями: кожна дія з
                даними потрапляє в журнал аудиту.
              </p>
              <RolesPreview />
            </div>

            {/* Card 5: AI & Налаштування */}
            <div
              id="section-ai"
              className="scroll-mt-28 overflow-hidden rounded-2xl border border-[#222634] bg-[#13151D] p-8 shadow-2xl"
            >
              <h4 className="mb-2 text-2xl font-bold text-white">AI та розширені налаштування</h4>
              <p className="mb-6 text-[#94A3B8]">
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
