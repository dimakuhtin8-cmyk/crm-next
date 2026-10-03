/**
 * Hero: анімований міні-канбан воронки — картка рухається етапами
 * «Нові звернення → Кваліфікація → Угода» (CSS keyframes, без JS).
 */

const COLUMNS = [
  {
    name: 'Нові звернення',
    count: 48,
    cards: [
      { title: 'Заявка з сайту', sum: '₴45 тис.' },
      { title: 'Лід Instagram', sum: '₴28 тис.' },
    ],
  },
  {
    name: 'Кваліфікація',
    count: 31,
    cards: [{ title: 'ФОП «Коло»', sum: '₴86 тис.' }],
  },
  {
    name: 'Угода',
    count: 6,
    cards: [{ title: 'ТОВ «Альфа»', sum: '₴120 тис.' }],
  },
];

export function HeroKanban() {
  return (
    <div className="landing-rise overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <style>{`
        @keyframes hero-kanban-move {
          0%   { transform: translateX(0) translateY(0); opacity: 0; }
          5%   { opacity: 1; }
          14%  { transform: translateX(0) translateY(-8px); }
          26%  { transform: translateX(100%) translateY(-8px); }
          33%  { transform: translateX(100%) translateY(0); }
          46%  { transform: translateX(100%) translateY(-8px); }
          58%  { transform: translateX(200%) translateY(-8px); }
          65%  { transform: translateX(200%) translateY(0); }
          90%  { transform: translateX(200%) translateY(0); opacity: 1; }
          100% { transform: translateX(200%) translateY(0); opacity: 0; }
        }
        .hero-ghost {
          animation: hero-kanban-move 9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          box-shadow: 0 10px 24px -12px rgba(15, 23, 42, 0.35);
        }
      `}</style>

      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <p className="text-sm font-bold">Воронка продажу</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground-secondary">
          <span
            className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-primary"
            aria-hidden="true"
          />
          Оновлено щойно
        </span>
      </div>

      <div className="relative grid grid-cols-3 px-5 py-4">
        {COLUMNS.map((column) => (
          <div key={column.name} className="pe-3">
            <div className="flex items-baseline justify-between gap-2 text-xs font-bold">
              <span className="truncate">{column.name}</span>
              <span className="tabular-nums text-foreground-muted">{column.count}</span>
            </div>
            <div className="mt-2.5 space-y-2.5">
              {column.cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <p className="truncate text-xs font-semibold">{card.title}</p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-foreground-secondary">
                    {card.sum}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div
          className="pointer-events-none absolute inset-x-5 top-[42px] grid grid-cols-3"
          aria-hidden="true"
        >
          <div className="hero-ghost col-start-1 rounded-lg border-2 border-primary bg-card px-3 py-2.5">
            <p className="truncate text-xs font-bold text-primary">ТОВ «Орбіта»</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-foreground-secondary">₴140 тис.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm">
        <span className="font-semibold">Прогноз закриття</span>
        <span className="font-bold tabular-nums">₴730 тис.</span>
      </div>
    </div>
  );
}
