import { getRequestConfig } from 'next-intl/server';

// Интерфейс: только украинский (по умолчанию) и английский — решение владельца
export const locales = ['uk', 'en'] as const;
export const defaultLocale = 'uk' as const;

export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  // next-intl v4: локаль приходит из URL-сегмента [locale] через middleware.
  // Раньше здесь читался заголовок x-next-intl-locale, который никто не
  // выставлял — из-за этого всегда грузился defaultLocale (uk) и переводы
  // ru/en не применялись.
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
