import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const locales = ['uk', 'en', 'ru'] as const;
export const defaultLocale = 'uk' as const;

export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') || defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
