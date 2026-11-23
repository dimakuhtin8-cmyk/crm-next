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
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { BazaPreview } from '@/components/landing/baza-preview';
import { CommsPreview } from '@/components/landing/comms-preview';
import { MergeDemo } from '@/components/landing/merge-demo';
import { RolesPreview } from '@/components/landing/roles-preview';
import { RuleBuilder } from '@/components/landing/rule-builder';
import { SectionLink } from '@/components/landing/section-link';
import { SettingsPreview } from '@/components/landing/settings-preview';

const MOVE_SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const;
const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

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

export function StickyFeatures() {
  const t = useTranslations('landing.features');
  const tCta = useTranslations('landing.cta');
  const [activeTab, setActiveTab] = useState('baza');
  // Скоуп піддерева: у видачі Next лежить прихований prerender-дублікат
  // (div#S:0), тому document.getElementById брав би невидимі копії.
  const rootRef = useRef<HTMLDivElement>(null);

  const features = [
    { id: 'baza', label: t('nav.baza') },
    { id: 'chat', label: t('nav.chat') },
    { id: 'auto', label: t('nav.auto') },
    { id: 'audit', label: t('nav.audit') },
    { id: 'ai', label: t('nav.ai') },
  ];

  const CHANNEL_NOTES = [
    {
      name: 'Telegram',
      text: t('channels.telegram'),
      tone: 'bg-info-light text-info',
    },
    {
      name: 'WhatsApp',
      text: t('channels.whatsapp'),
      tone: 'bg-success-light text-success',
    },
    {
      name: 'Email',
      text: t('channels.email'),
      tone: 'bg-primary-light text-primary',
    },
  ];

  const BAZA_CHECKLIST = [t('baza.check1'), t('baza.check2'), t('baza.check3')];

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
            <h3 className="hidden px-4 pb-2 pt-2 text-xl font-bold lg:block">{t('navTitle')}</h3>
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
              {tCta('tryFree')}
            </SectionLink>
          </div>

          {/* Пʼять томів, розділених rib-лініями */}
          <div className="space-y-14 lg:col-span-8">
            <Volume id="section-baza" index={0}>
              <h3 className="mb-2 text-2xl font-bold">{t('baza.title')}</h3>
              <p className="mb-6 text-foreground-secondary">{t('baza.body')}</p>
              <MergeDemo />
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
              <h3 className="mb-2 text-2xl font-bold">{t('chat.title')}</h3>
              <p className="mb-6 text-foreground-secondary">{t('chat.body')}</p>
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
              <h3 className="mb-2 text-2xl font-bold">{t('auto.title')}</h3>
              <p className="mb-6 text-foreground-secondary">{t('auto.body')}</p>
              <RuleBuilder />
            </Volume>

            <Volume id="section-audit" index={3}>
              <h3 className="mb-2 text-2xl font-bold">{t('audit.title')}</h3>
              <p className="mb-6 text-foreground-secondary">{t('audit.body')}</p>
              <RolesPreview />
            </Volume>

            <Volume id="section-ai" index={4}>
              <h3 className="mb-2 text-2xl font-bold">{t('ai.title')}</h3>
              <p className="mb-6 text-foreground-secondary">{t('ai.body')}</p>
              <SettingsPreview />
            </Volume>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
