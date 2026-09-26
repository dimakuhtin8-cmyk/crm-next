/**
 * Structured Logging — pino
 * 
 * Почему pino:
 * - Самый быстрый Node.js логгер (10-100x быстрее winston)
 * - JSON формат для парсинга в Datadog/Grafana/Loki
 * - Красивый вывод в dev mode
 * - Контекстная информация (requestId, tenantId, userId)
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// Создаём основной логгер
const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  
  // Красивый вывод в dev, JSON в prod
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  
  // Базовые поля — добавляются ко всем логам
  base: {
    service: 'crm-next',
    version: process.env.npm_package_version || '0.1.0',
  },
  
  // Форматирование
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  
  // Красивые даты
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Создать дочерний логгер с контекстом
 * 
 * @example
 * const log = createLogger({ requestId: '123', tenantId: 'abc' });
 * log.info('Запит до API');
 * log.error({ err }, 'Помилка бази даних');
 */
export function createLogger(context: Record<string, any> = {}) {
  return logger.child(context);
}

/**
 * Логгер для HTTP запросов
 */
export function createRequestLogger(request: Request, requestId: string) {
  const url = new URL(request.url);
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  return logger.child({
    requestId,
    method: request.method,
    path: url.pathname,
    ip,
    userAgent: request.headers.get('user-agent')?.slice(0, 100),
  });
}

/**
 * Логгер для AI запросов
 */
export function createAILogger(provider: string, model: string) {
  return logger.child({
    provider,
    model,
    category: 'ai',
  });
}

/**
 * Логгер для аутентификации
 */
export function createAuthLogger(action: string) {
  return logger.child({
    category: 'auth',
    action,
  });
}

/**
 * Логгер для ошибок
 */
export function logError(err: Error, context: Record<string, any> = {}) {
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    ...context,
  }, `Помилка: ${err.message}`);
}

/**
 * Логгер для медленных запросов
 */
export function logSlowRequest(
  method: string,
  path: string,
  durationMs: number,
  thresholdMs: number = 1000
) {
  if (durationMs > thresholdMs) {
    logger.warn({
      method,
      path,
      durationMs,
      category: 'performance',
    }, `Повільний запит: ${durationMs}ms`);
  }
}

/**
 * Логгер для безопасных событий (аудит)
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any> = {}
) {
  logger.warn({
    category: 'security',
    event,
    ...details,
  }, `Безпечна подія: ${event}`);
}

export default logger;
