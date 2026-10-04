'use client';

/**
 * Мобільний липкий CTA-бар: зʼявляється після прокрутки hero (600px),
 * лише на малих екранах. Суцільний папір, safe-area знизу.
 */

import { useEffect, useState } from 'react';

export function MobileCtaBar({ locale }: { locale: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:hidden">
      <a
        href={`/${locale}/auth/register`}
        className="flex min-h-12 items-center justify-center rounded-xl bg-inverse px-7 text-sm font-bold text-inverse-foreground transition-colors hover:bg-[#3A352F]"
      >
        Спробувати безкоштовно
      </a>
    </div>
  );
}
