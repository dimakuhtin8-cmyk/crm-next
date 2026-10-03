'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/legal/oferta', label: 'Публічна оферта' },
  { href: '/legal/privacy', label: 'Конфіденційність' },
  { href: '/legal/dpa', label: 'DPA' },
] as const;

/** Навігація між правовими документами з підсвіткою активної сторінки. */
export function LegalNav({ locale }: { locale: string }) {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-3 text-sm font-medium sm:gap-4"
      aria-label="Правові документи"
    >
      {ITEMS.map((item) => {
        const href = `/${locale}${item.href}`;
        const active = pathname === href;
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'underline-offset-4 transition-colors hover:text-foreground hover:underline',
              active ? 'text-foreground' : 'text-foreground-secondary',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
