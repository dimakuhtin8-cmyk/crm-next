/**
 * «Комунікація»: split-view всіх каналів CRM — лише Telegram, WhatsApp і Email
 * (телефонії немає). Ліворуч — вхідні по каналах, праворуч — листування.
 */

const INBOX = [
  {
    name: 'Telegram',
    snippet: 'Добрий день, надішліть будь ласка КП',
    time: '10:42',
    unread: 2,
    tone: 'bg-info-light text-info',
  },
  {
    name: 'WhatsApp',
    snippet: 'Домовимося на вівторок о 15:00?',
    time: '09:58',
    unread: 1,
    tone: 'bg-success-light text-success',
  },
  {
    name: 'Email',
    snippet: 'Рахунок №1042 від «Альфа»',
    time: 'вчора',
    unread: 0,
    tone: 'bg-primary-light text-primary',
  },
];

export function CommsPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm font-bold">Вхідні · усі канали</p>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground-secondary">
          3 канали
        </span>
      </div>

      <div className="grid sm:grid-cols-2">
        {/* Список каналів */}
        <ul className="divide-y divide-border border-b border-border sm:border-b-0 sm:border-r">
          {INBOX.map((item) => (
            <li
              key={item.name}
              className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-secondary"
            >
              <span
                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.tone}`}
              >
                {item.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <span className="shrink-0 text-[11px] text-foreground-muted">{item.time}</span>
                </div>
                <p className="truncate text-xs text-foreground-secondary">{item.snippet}</p>
              </div>
              {item.unread > 0 && (
                <span className="mt-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                  {item.unread}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Листування */}
        <div className="flex flex-col gap-2.5 px-4 py-3.5">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2 text-sm">
            Добрий день, надішліть будь ласка КП
          </div>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
            Вже надсилаю — перевірте пошту 📎
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2 text-sm">
            Дякую! Погодимо умови до п&apos;ятниці
          </div>
          <div className="mt-auto flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground-muted">
            Написати повідомлення…
            <span
              className="ml-auto inline-block h-3.5 w-0.5 animate-pulse bg-primary"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
