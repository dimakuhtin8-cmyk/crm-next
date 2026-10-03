import type { ReactNode } from 'react';

/**
 * Типографіка правових документів /legal/*.
 * Тільки семантичні токени кольору, без власних значень.
 */

export function DocTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl font-bold tracking-tight text-foreground">{children}</h1>;
}

export function DocUpdated({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm text-foreground-secondary">{children}</p>;
}

export function DocH2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 text-xl font-bold text-foreground">
      {children}
    </h2>
  );
}

export function DocP({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-sm leading-7 text-foreground-secondary">{children}</p>;
}

export function DocOl({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm leading-7 text-foreground-secondary">
      {children}
    </ol>
  );
}

export function DocUl({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-sm leading-7 text-foreground-secondary">
      {children}
    </ul>
  );
}
