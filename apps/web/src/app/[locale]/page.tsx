import {
  Building2,
  Briefcase,
  Check,
  Cloud,
  History,
  KeyRound,
  ShoppingCart,
  Shield,
  Terminal,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { AiTypewriter } from '@/components/landing/ai-typewriter';
import { DevConsole } from '@/components/landing/dev-console';
import { HeroKanban } from '@/components/landing/hero-kanban';
import { MobileCtaBar } from '@/components/landing/mobile-cta-bar';
import { SectionLink } from '@/components/landing/section-link';
import { StickyFeatures } from '@/components/landing/sticky-features';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { siteOwnerLine, SITE_OWNER } from '@/lib/legal/company';

const NAV_ITEMS: [string, string][] = [
  ['#mozlyvosti', 'Можливості'],
  ['#ai-copilot', 'AI Co-Pilot'],
  ['#section-chat', 'Комунікація'],
  ['#section-auto', 'Автоматизація'],
  ['#admin', 'Адміністрування'],
  ['#faq', 'FAQ'],
];

const AUDIENCE = [
  {
    icon: Building2,
    name: 'B2B-продажі',
    text: 'Довгі угоди, кілька контактів, контроль кожного етапу.',
  },
  {
    icon: Cloud,
    name: 'SaaS та IT',
    text: 'Ліди з сайту й форм одразу розподіляються між менеджерами.',
  },
  {
    icon: ShoppingCart,
    name: 'E-commerce',
    text: 'Замовлення, оплати й повторні продажі в одному вікні.',
  },
  {
    icon: Briefcase,
    name: 'Послуги',
    text: 'Заявки, записи, нагадування й історія кожного клієнта.',
  },
];

const SECURITY_ITEMS = [
  { icon: Users, text: 'Member бачить свої та непризначені завдання' },
  { icon: Shield, text: 'Viewer має доступ лише для читання' },
  { icon: KeyRound, text: 'API-ключі зберігаються у зашифрованому вигляді' },
  { icon: History, text: 'Зміни й входи видно в журналі аудиту' },
];

const FAQ_ITEMS = [
  {
    q: 'Чи побачить менеджер чужі угоди?',
    a: 'Ні. Member працює зі своїми та непризначеними завданнями, owner і admin бачать усе, viewer лише читає.',
  },
  {
    q: 'Чи можна перенести наявну базу?',
    a: 'Так. Контакти можна імпортувати, знайти дублі й навести лад у базі перед запуском воронки.',
  },
  {
    q: 'Як працює AI Co-Pilot?',
    a: 'AI допомагає з наступними діями, статусами й короткими підсумками на основі ваших даних. Використання рахується за тенантом і видно в журналі.',
  },
  {
    q: 'Що з безпекою даних?',
    a: 'Доступ за ролями, шифрування чутливих полів і журнал аудиту для важливих дій.',
  },
];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <main className="landing-akari min-h-screen bg-background text-foreground antialiased">
      <style>{`
        html:has(.landing-akari), html:has(.landing-akari) body { background-color: #f6f1e7; }
        ::selection { background: var(--primary); color: var(--primary-foreground); }
        :focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; border-radius: 8px; }
        @keyframes landing-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .landing-rise { animation: landing-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .landing-rise { animation: none; }
        }
      `}</style>

      {/* Header — ink-смуга на папері, якірні лінки через SectionLink */}
      <header className="sticky top-0 z-50 border-b border-border bg-inverse text-inverse-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2"
            aria-label="CRM-Next — на головну"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <span className="text-base font-bold tracking-tight">CRM-Next</span>
          </Link>

          <nav
            className="hidden items-center gap-6 text-sm font-medium text-inverse-muted lg:flex"
            aria-label="Розділи"
          >
            {NAV_ITEMS.map(([href, label]) => (
              <SectionLink
                key={href}
                className="transition-colors hover:text-inverse-foreground"
                href={href}
              >
                {label}
              </SectionLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={`/${locale}/auth/login`}
              className="hidden text-sm font-semibold text-inverse-foreground underline-offset-4 hover:underline sm:inline"
            >
              Увійти
            </Link>
            <Link
              href={`/${locale}/auth/register`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-inverse px-5 text-sm font-bold text-inverse-foreground shadow-[0_10px_24px_-12px_rgba(74,60,40,0.45)] transition-colors hover:bg-[#3A352F]"
            >
              Спробувати безкоштовно
            </Link>
          </div>

          <details className="relative lg:hidden">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-white/15 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Меню
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card p-2 text-foreground shadow-xl">
              {[
                ...NAV_ITEMS,
                [`/${locale}/auth/login`, 'Увійти'],
                [`/${locale}/auth/register`, 'Спробувати безкоштовно'],
              ].map(([href, label]) => (
                <SectionLink
                  key={href + label}
                  href={href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  {label}
                </SectionLink>
              ))}
            </div>
          </details>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Жодна угода не губиться
            </h1>
            <p className="mt-5 max-w-[62ch] text-base leading-7 text-foreground-secondary sm:text-lg sm:leading-8">
              База клієнтів, воронка продажу, автоматизація, завдання й аналітика — в одному вікні.
              Інтерфейс українською.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/auth/register`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-inverse px-7 text-sm font-bold text-inverse-foreground shadow-[0_18px_36px_-18px_rgba(74,60,40,0.5)] transition-colors hover:bg-[#3A352F]"
              >
                Спробувати безкоштовно
              </Link>
              <SectionLink
                href="#mozlyvosti"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-transparent px-7 text-sm font-bold transition-colors hover:bg-secondary"
              >
                Дивитися можливості
              </SectionLink>
            </div>
            <p className="mt-5 text-sm font-medium text-foreground-secondary">
              Воронка, завдання, комунікація та контроль команди — без хаосу в таблицях.
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              {['Без картки', '14 днів пробного', 'Інтерфейс українською'].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Паперовий місяць: жива воронка всередині освітленого обʼєму */}
          <div className="relative px-4 py-8 sm:px-8">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[104%] w-full sm:h-[112%] sm:w-[104%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFFDF7] shadow-lg"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[112%] w-full sm:h-[126%] sm:w-[114%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9B992]"
              aria-hidden="true"
            />
            <div className="relative">
              <HeroKanban />
            </div>
          </div>
        </div>
      </section>

      {/* Facts strip — only verifiable product facts, no invented metrics */}
      <section className="border-b border-border bg-background-secondary">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            ['4', 'ролі доступу: від глядача до власника'],
            ['3', 'канали: Telegram, WhatsApp, Email'],
            ['AI', 'Co-Pilot з доступом до ваших даних'],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm"
            >
              <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
              <p className="mt-1 text-sm font-medium text-foreground-secondary">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities: sticky nav (IntersectionObserver) + framer cards */}
      <div id="mozlyvosti" className="scroll-mt-28">
        <StickyFeatures />
      </div>

      {/* AI Co-Pilot showcase */}
      <section id="ai-copilot" className="border-b border-border">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 className="max-w-[20ch] text-2xl font-bold tracking-tight sm:text-3xl">
              Питання до CRM — відповідь за секунди
            </h2>
            <p className="mt-4 max-w-[62ch] text-sm leading-7 text-foreground-secondary sm:text-base">
              Co-Pilot читає ваші дані в межах вашої ролі та відповідає природною мовою: які угоди
              під ризиком, кому подзвонити сьогодні, які підсумки тижня.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm font-medium">
              {[
                'Відповіді лише на основі вашої CRM — без вигадок',
                'Використання рахується за тенантом і видно в журналі',
                'Можна підключити власний API-ключ AI-провайдера',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <AiTypewriter />
        </div>
      </section>

      {/* Admin / DevConsole showcase */}
      <section id="admin" className="border-b border-border bg-background-secondary">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <DevConsole />
          <div>
            <h2 className="max-w-[22ch] text-2xl font-bold tracking-tight sm:text-3xl">
              Прозорий стан системи — без дзвінків адміну
            </h2>
            <p className="mt-4 max-w-[62ch] text-sm leading-7 text-foreground-secondary sm:text-base">
              Кеш, черги завдань, вебхуки та системні журнали доступні адміністратору без звернення
              до підтримки.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm font-medium">
              {[
                'Статус кешу та черг завдань у реальному часі',
                'Вебхуки: доставка й коди відповідей',
                'Системні журнали й розділ «Логи»',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Terminal className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Audience */}
      <section id="dlya-kogo" className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="max-w-[22ch] text-2xl font-bold tracking-tight sm:text-3xl">
            Для яких команд підходить CRM-Next
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {AUDIENCE.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-base font-bold">{item.name}</p>
                  <p className="mt-1.5 text-sm leading-6 text-foreground-secondary">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="bezpeka" className="border-b border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Безпека і порядок у даних
            </h2>
            <p className="mt-4 max-w-[64ch] text-sm leading-7 text-foreground-secondary sm:text-base">
              Ролі owner, admin, member і viewer розділяють доступ. Чутливі поля шифруються, дії
              користувачів фіксуються в аудиті.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['Owner', 'Admin', 'Member', 'Viewer'].map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold shadow-sm"
                >
                  {role}
                </span>
              ))}
            </div>
            <Link
              href={`/${locale}/auth/register`}
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Спробувати безкоштовно
            </Link>
          </div>
          <ul className="space-y-3 text-sm font-medium">
            {SECURITY_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.text}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm"
                >
                  <span className="mt-0.5 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {item.text}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-border bg-background-secondary">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Часті запитання</h2>
          <Accordion type="single" collapsible className="mt-8">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem
                key={item.q}
                value={item.q}
                className="mb-3 rounded-2xl border border-border bg-card px-5 shadow-sm last:mb-0"
              >
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-xl sm:px-12">
            <h2 className="relative mx-auto max-w-[20ch] text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Наведіть лад у продажах цього тижня
            </h2>
            <p className="mx-auto mt-4 max-w-[60ch] text-sm leading-7 text-foreground-secondary sm:text-base">
              Почніть з бази й воронки, далі підключіть автоматизацію та AI-підказки.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={`/${locale}/auth/register`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-inverse px-7 text-sm font-bold text-inverse-foreground shadow-[0_18px_36px_-18px_rgba(74,60,40,0.5)] transition-colors hover:bg-[#3A352F]"
              >
                Спробувати безкоштовно
              </Link>
              <Link
                href={`/${locale}/auth/login`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-foreground/30 px-7 text-sm font-bold transition-colors hover:bg-secondary"
              >
                Увійти
              </Link>
            </div>
            <p className="mt-5 text-sm font-medium text-foreground-secondary">
              Без картки · 14 днів пробного періоду
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-border-hover bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-sm text-foreground-secondary sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-bold text-foreground">CRM-Next</p>
            <p>База клієнтів · Воронка · Автоматизація · Аналітика</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Правова документація">
            <Link
              href={`/${locale}/legal/oferta`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Публічна оферта
            </Link>
            <Link
              href={`/${locale}/legal/privacy`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Політика конфіденційності
            </Link>
            <Link
              href={`/${locale}/legal/dpa`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Договір обробки даних (DPA)
            </Link>
          </nav>
          <p className="text-xs leading-5">
            Власник сайту та адміністратор персональних даних — {siteOwnerLine} · Email для
            зв&apos;язку:{' '}
            <a
              href={`mailto:${SITE_OWNER.email}`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {SITE_OWNER.email}
            </a>
          </p>
        </div>
      </footer>
      <MobileCtaBar locale={locale} />
    </main>
  );
}
