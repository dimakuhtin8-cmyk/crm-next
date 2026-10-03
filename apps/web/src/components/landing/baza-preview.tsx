/**
 * «База і воронка»: міні-канбан з перетягуванням картки + картка клієнта.
 */

export function BazaPreview() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <style>{`
        @keyframes baza-move {
          0%   { transform: translateX(0) translateY(0); opacity: 0; }
          6%   { opacity: 1; }
          20%  { transform: translateX(0) translateY(-6px); }
          40%  { transform: translateX(calc(100% + 1.5rem)) translateY(-6px); }
          48%  { transform: translateX(calc(100% + 1.5rem)) translateY(0); }
          86%  { transform: translateX(calc(100% + 1.5rem)) translateY(0); opacity: 1; }
          100% { transform: translateX(calc(100% + 1.5rem)) translateY(0); opacity: 0; }
        }
        .baza-ghost {
          animation: baza-move 7s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          box-shadow: 0 8px 18px -10px rgba(15, 23, 42, 0.4);
        }
      `}</style>

      {/* Картка клієнта */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground-muted">
          Картка клієнта
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
            МК
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Марія Коваль</p>
            <p className="truncate text-xs text-foreground-secondary">ТОВ «Альфа» · лід з сайту</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
            Instagram
          </span>
          <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
            Кваліфікація
          </span>
        </div>
        <ul className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-foreground-secondary">
          <li className="flex items-center justify-between gap-3">
            <span>Угода</span>
            <span className="font-semibold tabular-nums text-foreground">₴120 тис.</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Наступна дія</span>
            <span className="font-semibold text-foreground">Дзвінок сьогодні</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Історія</span>
            <span className="font-semibold text-foreground">12 подій</span>
          </li>
        </ul>
      </div>

      {/* Міні-канбан з drag-and-drop анімацією */}
      <div className="relative grid grid-cols-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="pe-3">
          <p className="text-xs font-bold">Кваліфікація</p>
          <div className="mt-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
            <p className="truncate text-xs font-semibold">ФОП «Коло»</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-foreground-secondary">₴86 тис.</p>
          </div>
        </div>
        <div className="pe-0 ps-3">
          <p className="text-xs font-bold">Переговори</p>
          <div className="mt-2.5 rounded-lg border border-border bg-background px-3 py-2.5 opacity-60">
            <p className="truncate text-xs font-semibold">ТОВ «Ліга»</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-foreground-secondary">₴210 тис.</p>
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-4 top-[42px] grid grid-cols-2"
          aria-hidden="true"
        >
          <div className="baza-ghost w-[calc(100%-0.75rem)] rounded-lg border-2 border-primary bg-card px-3 py-2.5">
            <p className="truncate text-xs font-bold text-primary">ТОВ «Орбіта»</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-foreground-secondary">₴140 тис.</p>
          </div>
        </div>
        <p className="col-span-2 mt-4 border-t border-border pt-3 text-[11px] text-foreground-muted">
          Картку перетягують між етапами — статус оновлюється в усієї команди
        </p>
      </div>
    </div>
  );
}
