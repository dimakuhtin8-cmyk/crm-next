import Link from 'next/link';

const stages = [
  { name: 'Нові звернення', count: 48, amount: '₴1,2 млн', width: '92%', bar: 'bg-[#111214]' },
  { name: 'Кваліфікація', count: 31, amount: '₴860 тис.', width: '68%', bar: 'bg-[#111214]' },
  { name: 'Переговори', count: 18, amount: '₴540 тис.', width: '46%', bar: 'bg-[#FFC700]' },
  { name: 'Узгодження', count: 9, amount: '₴310 тис.', width: '28%', bar: 'bg-[#111214]' },
  { name: 'Оплата', count: 6, amount: '₴190 тис.', width: '18%', bar: 'bg-[#111214]' },
];

const channels = [
  { name: 'Месенджери', text: 'Листування, нотатки й нагадування залишаються в картці клієнта.' },
  { name: 'Email', text: 'Листи й заявки прив’язуються до контактів та угод.' },
  { name: 'Телефонія', text: 'Дзвінки фіксуються як активності з результатом розмови.' },
  { name: 'Соцмережі', text: 'Звернення з соцмереж потрапляють у спільну чергу.' },
];

const segments = [
  { name: 'B2B-продажі', text: 'Довгі угоди, кілька контактів, контроль кожного етапу.' },
  { name: 'SaaS та IT', text: 'Ліди з сайту й форм одразу розподіляються між менеджерами.' },
  { name: 'Торгівля', text: 'Замовлення, оплати й повторні продажі в одному вікні.' },
  { name: 'Послуги', text: 'Заявки, записи, нагадування й історія кожного клієнта.' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-[#111214] antialiased">
      <style>{`
        ::selection { background: #FFC700; color: #111214; }
        :focus-visible { outline: 2px solid #111214; outline-offset: 3px; border-radius: 8px; }
        @keyframes landing-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .landing-rise { animation: landing-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .landing-rise { animation: none; }
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/uk" className="flex items-center gap-2" aria-label="CRM-Next — на головну">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111214]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#FFC700" aria-hidden="true">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <span className="text-base font-bold tracking-tight">CRM-Next</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[#4B5563] md:flex" aria-label="Розділи">
            <Link className="transition-colors hover:text-[#111214]" href="#mozlyvosti">Можливості</Link>
            <Link className="transition-colors hover:text-[#111214]" href="#kanaly">Канали</Link>
            <Link className="transition-colors hover:text-[#111214]" href="#avtomatyzatsiya">Автоматизація</Link>
            <Link className="transition-colors hover:text-[#111214]" href="#analityka">Аналітика</Link>
            <Link className="transition-colors hover:text-[#111214]" href="#faq">FAQ</Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/uk/auth/login" className="text-sm font-semibold text-[#111214] underline-offset-4 hover:underline">
              Увійти
            </Link>
            <Link
              href="/uk/auth/register"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#FFC700] px-5 text-sm font-bold text-[#111214] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)] transition-colors hover:bg-[#EAB308]"
            >
              Спробувати безкоштовно
            </Link>
          </div>

          <details className="relative md:hidden">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-[#E5E7EB] px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Меню
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.35)]">
              {[
                ['#mozlyvosti', 'Можливості'],
                ['#kanaly', 'Канали'],
                ['#avtomatyzatsiya', 'Автоматизація'],
                ['#analityka', 'Аналітика'],
                ['#faq', 'FAQ'],
                ['/uk/auth/login', 'Увійти'],
                ['/uk/auth/register', 'Спробувати безкоштовно'],
              ].map(([href, label]) => (
                <Link key={href + label} href={href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#111214] hover:bg-[#F5F6F7]">
                  {label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </header>

      {/* AI banner */}
      <section id="ai" className="border-b border-[#E5E7EB] bg-[#F5F6F7]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[#111214]">
              <Icon d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">AI Co-Pilot замість ручного пошуку</h2>
              <p className="mt-1 max-w-[68ch] text-sm leading-6 text-[#4B5563]">
                Запитайте про угоду, клієнта або наступну дію — CRM-Next підкаже рішення на основі ваших даних.
              </p>
            </div>
          </div>
          <Link
            href="/uk/auth/register"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[#111214] px-5 text-sm font-bold text-white transition-colors hover:bg-black"
          >
            Дивитися демо
          </Link>
        </div>
      </section>

      {/* Hero */}
      <section className="border-b border-[#E5E7EB]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              CRM-система для всієї команди
            </h1>
            <p className="mt-5 max-w-[62ch] text-base leading-7 text-[#4B5563] sm:text-lg sm:leading-8">
              База клієнтів, воронка продажу, автоматизація, завдання й аналітика — в одному вікні. Інтерфейс українською.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/uk/auth/register"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#FFC700] px-7 text-sm font-bold text-[#111214] shadow-[0_18px_36px_-18px_rgba(0,0,0,0.5)] transition-colors hover:bg-[#EAB308]"
              >
                Спробувати безкоштовно
              </Link>
              <Link
                href="/uk/auth/login"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#111214] bg-white px-7 text-sm font-bold text-[#111214] transition-colors hover:bg-[#F5F6F7]"
              >
                Хочу демо
              </Link>
            </div>
            <p className="mt-5 text-sm font-medium text-[#4B5563]">
              Воронка, завдання, комунікація та контроль команди — без хаосу в таблицях.
            </p>
          </div>

          <div className="landing-rise rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_28px_56px_-28px_rgba(0,0,0,0.35)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold">Воронка продажу</p>
              <p className="rounded-full bg-[#F5F6F7] px-3 py-1 text-xs font-semibold text-[#4B5563]">Сьогодні</p>
            </div>
            <ul className="mt-5 space-y-4">
              {stages.map((stage) => (
                <li key={stage.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold">{stage.name}</span>
                    <span className="tabular-nums text-[#4B5563]">
                      {stage.count} · {stage.amount}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#F0F1F3]">
                    <div className={`h-full rounded-full ${stage.bar}`} style={{ width: stage.width }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between border-t border-[#E5E7EB] pt-4 text-sm">
              <span className="font-semibold">Прогноз закриття</span>
              <span className="font-bold tabular-nums">₴730 тис.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="mozlyvosti" className="border-b border-[#E5E7EB]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[280px_1fr] lg:py-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Можливості</h2>
            <p className="mt-3 text-sm leading-6 text-[#4B5563]">
              Чотири опори щоденної роботи відділу продажу.
            </p>
            <nav className="mt-6 space-y-1 text-sm font-semibold" aria-label="Можливості">
              {[
                ['#baza', 'База і воронка'],
                ['#kanaly', 'Комунікація'],
                ['#avtomatyzatsiya', 'Автоматизація'],
                ['#analityka', 'Аналітика і доступ'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 hover:bg-[#F5F6F7]">
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-12">
            <div id="baza">
              <h3 className="text-xl font-bold tracking-tight">База клієнтів і воронка без втрат</h3>
              <p className="mt-3 max-w-[68ch] text-sm leading-7 text-[#4B5563] sm:text-base">
                Кожен контакт має картку з історією, завданнями й документами. Угоди рухаються етапами, прострочене підсвічується.
              </p>
              <ul className="mt-5 divide-y divide-[#E5E7EB] rounded-2xl border border-[#E5E7EB]">
                {['Імпорт бази та дедублікація контактів', 'Картка клієнта: комунікація, файли, завдання', 'Канбан воронки з drag-and-drop'].map((item) => (
                  <li key={item} className="flex items-start gap-3 px-4 py-3.5 text-sm font-medium">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFC700] text-[#111214]">
                      <Icon d="M5 12l5 5 9-11" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div id="kanaly">
              <h3 className="text-xl font-bold tracking-tight">Уся комунікація — в CRM</h3>
              <p className="mt-3 max-w-[68ch] text-sm leading-7 text-[#4B5563] sm:text-base">
                Менеджер не перемикається між застосунками: контекст клієнта завжди поруч.
              </p>
              <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#E5E7EB] sm:grid-cols-2">
                {channels.map((channel) => (
                  <div key={channel.name} className="bg-white p-5">
                    <dt className="text-sm font-bold">{channel.name}</dt>
                    <dd className="mt-2 text-sm leading-6 text-[#4B5563]">{channel.text}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div id="avtomatyzatsiya">
              <h3 className="text-xl font-bold tracking-tight">Автоматизація рутини</h3>
              <p className="mt-3 max-w-[68ch] text-sm leading-7 text-[#4B5563] sm:text-base">
                Правила самі розподіляють лідів, створюють завдання й рухають угоди.
              </p>
              <div className="mt-5 rounded-2xl bg-[#111214] p-5 text-sm leading-7 text-white">
                <p className="font-mono text-[13px] text-[#FFC700]">Якщо угода 3 дні без активності</p>
                <p className="mt-2 font-mono text-[13px] text-white/90">→ створити завдання менеджеру</p>
                <p className="font-mono text-[13px] text-white/90">→ нагадати керівнику</p>
                <p className="font-mono text-[13px] text-white/90">→ підсвітити угоду у воронці</p>
              </div>
            </div>

            <div id="analityka">
              <h3 className="text-xl font-bold tracking-tight">Аналітика й контроль доступу</h3>
              <p className="mt-3 max-w-[68ch] text-sm leading-7 text-[#4B5563] sm:text-base">
                Видно джерела лідів, завантаженість команди й вузькі місця воронки. Доступ — за ролями.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {[
                  ['48', 'нових звернень'],
                  ['₴730 тис.', 'прогноз закриття'],
                  ['4', 'ролі доступу'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-[#E5E7EB] px-4 py-5">
                    <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
                    <p className="mt-1 text-sm font-medium text-[#4B5563]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Segments */}
      <section id="dlya-kogo" className="border-b border-[#E5E7EB] bg-[#F5F6F7]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="max-w-[22ch] text-2xl font-bold tracking-tight sm:text-3xl">Для яких команд підходить CRM-Next</h2>
          <div className="mt-8 divide-y divide-[#E5E7EB] rounded-2xl border border-[#E5E7EB] bg-white">
            {segments.map((segment) => (
              <div key={segment.name} className="grid gap-1 px-5 py-5 sm:grid-cols-[240px_1fr] sm:items-baseline sm:gap-6">
                <p className="text-base font-bold">{segment.name}</p>
                <p className="text-sm leading-6 text-[#4B5563] sm:text-base sm:leading-7">{segment.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="bezpeka" className="border-b border-[#E5E7EB]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Безпека і порядок у даних</h2>
            <p className="mt-4 max-w-[64ch] text-sm leading-7 text-[#4B5563] sm:text-base">
              Ролі owner, admin, member і viewer розділяють доступ. Чутливі поля шифруються, дії користувачів фіксуються в аудиті.
            </p>
            <Link
              href="/uk/auth/register"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#111214] px-7 text-sm font-bold text-white transition-colors hover:bg-black"
            >
              Спробувати безкоштовно
            </Link>
          </div>
          <ul className="space-y-3 text-sm font-medium">
            {[
              'Member бачить свої та непризначені завдання',
              'Viewer має доступ лише для читання',
              'API-ключі зберігаються у зашифрованому вигляді',
              'Зміни й входи видно в журналі аудиту',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5">
                <span className="mt-0.5 text-[#111214]">
                  <Icon d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-[#E5E7EB] bg-[#F5F6F7]">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Часті запитання</h2>
          <div className="mt-8 space-y-3">
            {[
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
                a: 'AI допомагає з наступними діями, статусами й короткими підсумками. Використання рахується за тенантом і видно в журналі.',
              },
              {
                q: 'Що з безпекою даних?',
                a: 'Доступ за ролями, шифрування чутливих полів і журнал аудиту для важливих дій.',
              },
            ].map((item) => (
              <details key={item.q} className="group rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4">
                <summary className="cursor-pointer list-none text-base font-bold [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-xl leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </span>
                </summary>
                <p className="mt-3 max-w-[68ch] text-sm leading-7 text-[#4B5563]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="rounded-3xl bg-[#111214] px-6 py-12 text-center text-white sm:px-12">
            <h2 className="mx-auto max-w-[20ch] text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Наведіть лад у продажах цього тижня
            </h2>
            <p className="mx-auto mt-4 max-w-[60ch] text-sm leading-7 text-white/75 sm:text-base">
              Почніть з бази й воронки, далі підключіть автоматизацію та AI-підказки.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/uk/auth/register"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#FFC700] px-7 text-sm font-bold text-[#111214] transition-colors hover:bg-[#EAB308]"
              >
                Спробувати безкоштовно
              </Link>
              <Link
                href="/uk/auth/login"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-7 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Увійти
              </Link>
            </div>
          </div>
          <footer className="flex flex-col gap-3 pt-10 text-sm text-[#4B5563] sm:flex-row sm:items-center sm:justify-between">
            <p className="font-bold text-[#111214]">CRM-Next</p>
            <p>База клієнтів · Воронка · Автоматизація · Аналітика</p>
          </footer>
        </div>
      </section>
    </main>
  );
}
