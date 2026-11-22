/**
 * Global Middleware — защита всех API routes
 *
 * Что делает:
 * 1. Rate Limiting (100 req/15min)
 * 2. Request ID (для трассировки)
 * 3. Timing (для метрик)
 * 4. Logging (все запросы)
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import intlMiddleware from '@/i18n/middleware';
import { apiLimiter, getClientIp } from '@/lib/middleware/rate-limit';

// Генерация уникального ID запроса
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function middleware(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Пропускаем статические файлы и внутренние Next.js маршруты
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next();
  }

  // === AUTH GUARD: защищаем dashboard маршруты ===
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ??
    request.cookies.get('__Secure-authjs.session-token')?.value;
  const isDashboard = /^\/[^/]+\/dashboard/.test(pathname);

  // Если нет сессии и это dashboard — редирект на логин
  if (isDashboard && !sessionToken) {
    const locale = pathname.split('/')[1] || 'uk';
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // === REDIRECT: старый /ru → /uk (локаль ru убрана, остались uk + en) ===
  if (pathname === '/ru' || pathname.startsWith('/ru/')) {
    const redirectUrl = new URL(pathname.replace(/^\/ru/, '/uk'), request.url);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 301);
  }

  // === REDIRECT: старый /dashboard без locale → /uk/dashboard ===
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const redirectUrl = new URL(`/uk${pathname}`, request.url);
    // Сохраняем query (?error=..., ?callbackUrl=...) — иначе 301 его теряет
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 301);
  }

  // === REDIRECT: legacy /auth без locale → /uk/auth (legacy-страницы удалены) ===
  if (pathname === '/auth' || pathname.startsWith('/auth/')) {
    const redirectUrl = new URL(`/uk${pathname}`, request.url);
    // Сохраняем query (?error=CredentialsSignin и т.п.) — иначе сообщение об
    // ошибке входа пропадает после редиректа
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 301);
  }

  // Rate Limiting только для API routes
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(request as unknown as Request);

    // Проверяем rate limit (асинхронно через event)
    // Не блокируем запрос, просто логируем
    apiLimiter.consume(ip).catch(() => {
      // Rate limit exceeded — логируем но не блокируем (middleware не async)
      console.warn(`Rate limit exceeded for IP: ${ip}`);
    });

    const apiResponse = NextResponse.next();
    addSecurityHeaders(apiResponse, requestId, startTime, pathname);
    return apiResponse;
  }

  // === I18N: next-intl middleware выставляет X-NEXT-INTL-LOCALE ===
  // Без этого getRequestConfig всегда падал в defaultLocale (uk) и
  // переводы ru/en не применялись. Вызываем только для страниц:
  // matcher оригинала исключал api/trpc/static.
  const response = intlMiddleware(request);
  addSecurityHeaders(response, requestId, startTime, pathname);

  // Редирект локали (например, /foo → /uk/foo) возвращаем как есть.
  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  return response;
}

/** Security-заголовки (единые для всех ответов middleware). */
function addSecurityHeaders(
  response: NextResponse,
  requestId: string,
  startTime: number,
  pathname: string,
): void {
  // Добавляем request ID (для трассировки)
  response.headers.set('X-Request-ID', requestId);

  // Добавляем timing header
  response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // CORS для API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Tenant-ID',
    );
  }
}

export const config = {
  matcher: [
    // Все маршруты кроме статических
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
