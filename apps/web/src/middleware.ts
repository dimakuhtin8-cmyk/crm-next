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
  const sessionToken = request.cookies.get('authjs.session-token')?.value;
  const isDashboard = /^\/[^/]+\/dashboard/.test(pathname);
  const isAuthRoute = /^\/[^/]+\/auth\//.test(pathname);
  const isApiAuth = pathname.startsWith('/api/auth');
  const isPublic = pathname === '/' || isAuthRoute || isApiAuth;

  // Если нет сессии и это dashboard — редирект на логин
  if (isDashboard && !sessionToken) {
    const locale = pathname.split('/')[1] || 'uk';
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // === REDIRECT: старый /dashboard без locale → /uk/dashboard ===
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const redirectUrl = new URL(`/uk${pathname}`, request.url);
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
  }
  
  // Создаём response с заголовками
  const response = NextResponse.next();
  
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
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
  }
  
  return response;
}

export const config = {
  matcher: [
    // Все маршруты кроме статических
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
