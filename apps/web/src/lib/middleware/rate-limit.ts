/**
 * Rate Limiter — защита API от абьюза
 * 
 * Использует rate-limiter-flexible (работает в памяти, без Redis для начала)
 * При масштабировании переключиться на Redis adapter
 * 
 * Лимиты:
 * - Общий API: 100 запросов / 15 минут
 * - AI запросы: 20 запросов / 15 минут (дороже по деньгам)
 * - Auth: 10 попыток / 15 минут
 * - Регистрация: 5 попыток / час
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';

// Общий лимитер — все API запросы
export const apiLimiter = new RateLimiterMemory({
  keyPrefix: 'api',
  points: 100,        // 100 запросов
  duration: 60 * 15,  // за 15 минут
  blockDuration: 0,   // не блокируем, просто отклоняем
});

// AI лимитер — AI запросы (дороже)
export const aiLimiter = new RateLimiterMemory({
  keyPrefix: 'ai',
  points: 20,         // 20 запросов
  duration: 60 * 15,  // за 15 минут
  blockDuration: 60,  // блокируем на 1 минуту при превышении
});

// Auth лимитер — попытки входа
export const authLimiter = new RateLimiterMemory({
  keyPrefix: 'auth',
  points: 10,         // 10 попыток
  duration: 60 * 15,  // за 15 минут
  blockDuration: 60 * 5, // блокируем на 5 минут
});

// Registration лимитер — новые аккаунты
export const registerLimiter = new RateLimiterMemory({
  keyPrefix: 'register',
  points: 5,          // 5 регистраций
  duration: 60 * 60,  // за час
  blockDuration: 60 * 30, // блокируем на 30 минут
});

// Quick setup лимитер — настройка AI ключа
export const quickSetupLimiter = new RateLimiterMemory({
  keyPrefix: 'quick-setup',
  points: 10,         // 10 попыток
  duration: 60 * 60,  // за час
  blockDuration: 0,
});

/**
 * Получить IP клиента из запроса
 */
export function getClientIp(request: Request): string {
  // Vercel / Railway
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Прямой IP
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  
  return 'unknown';
}

/**
 * Получить tenant ID для пер-tenant лимитов
 */
export function getTenantIdFromRequest(request: Request): string | null {
  // Из cookie
  const cookies = request.headers.get('cookie') || '';
  const tenantMatch = cookies.match(/tenantId=([^;]+)/);
  if (tenantMatch) return tenantMatch[1];
  
  // Из header
  const tenantHeader = request.headers.get('x-tenant-id');
  if (tenantHeader) return tenantHeader;
  
  return null;
}

/**
 * Проверить rate limit
 * Возвращает { allowed: boolean, retryAfter?: number, remaining?: number }
 */
export async function checkRateLimit(
  limiter: RateLimiterMemory,
  key: string
): Promise<{ allowed: boolean; retryAfter?: number; remaining: number }> {
  try {
    const result = await limiter.consume(key);
    return {
      allowed: true,
      remaining: result.remainingPoints,
    };
  } catch (rejRes: any) {
    const retryAfterSecs = Math.ceil(rejRes.msBeforeNext / 1000) || 1;
    return {
      allowed: false,
      retryAfter: retryAfterSecs,
      remaining: 0,
    };
  }
}

/**
 * Создать middleware для rate limiting
 */
export function createRateLimitMiddleware(limiter: RateLimiterMemory) {
  return async function rateLimit(request: Request): Promise<Response | null> {
    const ip = getClientIp(request);
    const result = await checkRateLimit(limiter, ip);
    
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Забагато запитів. Спробуйте пізніше.',
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-RetryAfter': String(result.retryAfter),
          },
        }
      );
    }
    
    return null; // Allowed — продолжаем
  };
}
