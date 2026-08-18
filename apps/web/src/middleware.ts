import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import type { NextRequest } from 'next/server';

const locales = ['uk', 'en', 'ru'];
const defaultLocale = 'uk';

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/settings', '/contacts', '/deals', '/tasks', '/messages', '/analytics'];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/auth/login', '/auth/register'];

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname: string): boolean {
  return authRoutes.some((route) => pathname.startsWith(route));
}

function getTokenFromRequest(request: NextRequest): string | null {
  // Check cookies for session token
  const token = request.cookies.get('authjs.session-token')?.value;
  return token || null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for API routes, static files, etc.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = getTokenFromRequest(request);
  const isAuthenticated = !!token;

  // Protect authenticated routes
  if (isProtectedRoute(pathname)) {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const loginUrl = new URL(`/${defaultLocale}/auth/login`, request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users away from auth routes
  if (isAuthRoute(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Continue with i18n middleware
  return createMiddleware({
    locales,
    defaultLocale,
    localePrefix: 'never',
  })(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|trpc|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};
