'use client';

import { useParams } from 'next/navigation';

import { localePath } from './locale-path';

/**
 * Локаль из URL ([locale]-сегмент), с fallback на дефолтную.
 */
export function useLocale(): string {
  const params = useParams();
  const locale = params?.locale;
  return typeof locale === 'string' && locale ? locale : 'uk';
}

/**
 * Локаль из текущего URL без хуков (для обработчиков событий).
 */
export function currentLocaleFromPath(): string {
  if (typeof window === 'undefined') return 'uk';
  const match = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/);
  return match ? match[1] : 'uk';
}

/**
 * Хук: (path) => путь в текущей локали. Использование:
 *   const lp = useLocalePath();
 *   <Link href={lp('/auth/login')}>
 */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale();
  return (path: string) => localePath(path, locale);
}
