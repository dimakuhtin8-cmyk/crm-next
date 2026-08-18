import createMiddleware from 'next-intl/middleware';

import { locales, defaultLocale } from './config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  matcher: [
    // Match all pathnames except for
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - api routes
    // - trpc routes
    // - static files
    '/((?!_next/static|_next/image|favicon.ico|api|trpc|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
