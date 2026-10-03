/**
 * «Адміністрування»: DevConsole у темній темі slate — статуси сервісів,
 * черги, вебхуки та системні журнали зі статус-бейджами.
 */

const ROWS = [
  {
    name: 'api gateway',
    badge: 'OK',
    tone: 'bg-success text-success-foreground',
    meta: 'усі маршрути відповідають',
  },
  {
    name: 'cache',
    badge: 'OK',
    tone: 'bg-success text-success-foreground',
    meta: 'стан чинний',
  },
  {
    name: 'queues',
    badge: '3 активні',
    tone: 'bg-info text-info-foreground',
    meta: 'завдання у виконанні',
  },
  {
    name: 'webhooks',
    badge: '200 OK',
    tone: 'bg-success text-success-foreground',
    meta: 'доставлено щойно',
  },
  {
    name: 'system logs',
    badge: 'INFO',
    tone: 'bg-secondary text-secondary-foreground',
    meta: 'критичних помилок немає',
  },
];

export function DevConsole() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-inverse text-inverse-foreground shadow-lg">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        </span>
        <p className="font-mono text-xs text-inverse-muted">crm-next — system status</p>
        <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-inverse-foreground">
          production
        </span>
      </div>

      <ul className="divide-y divide-white/5 px-5 py-1 font-mono text-[13px]">
        {ROWS.map((row) => (
          <li key={row.name} className="flex items-center gap-3 py-2.5">
            <span className="w-28 shrink-0 text-inverse-foreground">{row.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.tone}`}>
              {row.badge}
            </span>
            <span className="hidden truncate text-inverse-muted sm:inline">{row.meta}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t border-white/10 px-5 py-3.5 font-mono text-xs text-inverse-muted">
        <span className="text-primary-foreground">&gt;</span>
        <span
          className="inline-block h-3.5 w-0.5 animate-pulse bg-primary-foreground"
          aria-hidden="true"
        />
        <span>оновлено щойно · журнали зберігаються в розділі «Логи»</span>
      </div>
    </div>
  );
}
