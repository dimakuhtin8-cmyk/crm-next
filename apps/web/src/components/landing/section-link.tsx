'use client';

/**
 * Якірне посилання лендинга: у видачі Next лежить прихований prerender-дублікат
 * (div#S:0) з тими ж id, тому нативний перехід за #якорем знаходить невидиму
 * копію і не скролить. Скролимо видиму копію всередині body > main вручну.
 */

import type { MouseEvent, ReactNode } from 'react';

export function SectionLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!href.startsWith('#')) return;
    const target = document.querySelector(
      `body > main.landing-akari #${CSS.escape(href.slice(1))}`,
    );
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    event.currentTarget.closest('details')?.removeAttribute('open');
  };

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
