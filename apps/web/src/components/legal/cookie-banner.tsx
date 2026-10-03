'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/use-locale-path';

/** Ключ згоди щодо cookie у localStorage (показ банера лише при першому візиті). */
export const COOKIE_CONSENT_KEY = 'crm_next_cookie_consent';

/**
 * Cookie-банер першого візиту: інформує про необхідні cookie (вхід, мова,
 * безпека) та зберігає згоду. Посилається на Політику конфіденційності.
 */
export function CookieBanner() {
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_CONSENT_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage недоступний — показати банер, щоб згода була зафіксованою
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    } catch {
      // згода не збереглася — банер з'явиться наступного разу
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Файли cookie"
      data-testid="cookie-banner"
      className="landing-akari fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-foreground-secondary">
          Ми використовуємо необхідні файли cookie (вхід, мова, безпека), щоб сервіс працював
          коректно.{' '}
          <Link
            href={`/${locale}/legal/privacy#cookie`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Докладніше про cookie
          </Link>
        </p>
        <Button type="button" size="sm" onClick={accept}>
          Зрозуміло
        </Button>
      </div>
    </div>
  );
}
