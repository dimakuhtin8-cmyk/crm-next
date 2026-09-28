/**
 * Путь с префиксом локали: localePath('/auth/login', 'en') → '/en/auth/login'.
 * Чистая функция без React — можно использовать и на сервере (email-ссылки),
 * и на клиенте.
 */
export function localePath(path: string, locale?: string | null): string {
  const loc = locale || 'uk';
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${loc}${clean}`;
}

/**
 * Абсолютный URL с локалью: localeUrl('/auth/verify?token=x', 'en')
 */
export function localeUrl(path: string, locale?: string | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}${localePath(path, locale)}`;
}
