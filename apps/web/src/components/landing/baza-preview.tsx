/**
 * «База і воронка»: приклад картки клієнта — контакти, етап, сума та наступна дія.
 */

export function BazaPreview() {
  return (
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
          <span className="font-semibold text-foreground">Надіслати КП сьогодні</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>Історія</span>
          <span className="font-semibold text-foreground">12 подій</span>
        </li>
      </ul>
    </div>
  );
}
