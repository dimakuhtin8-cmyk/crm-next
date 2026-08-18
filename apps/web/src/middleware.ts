import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

const locales = ['uk', 'en', 'ru'];

function getLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get('locale')?.value;
  if (cookieLocale && locales.includes(cookieLocale)) return cookieLocale;

  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const preferred = acceptLanguage.split(',').map((l) => l.split(';')[0].trim().substring(0, 2));
    for (const lang of preferred) {
      if (locales.includes(lang)) return lang;
    }
  }

  return 'uk';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const hasLocalePrefix = locales.some((locale) => pathname.startsWith(`/${locale}`));

  if (hasLocalePrefix) {
    return NextResponse.next();
  }

  const locale = getLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|trpc).*)'],
};
