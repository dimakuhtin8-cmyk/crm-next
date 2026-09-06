/**
 * Error Handling — единая система обработки ошибок
 * 
 * Концепция:
 * 1. Все ошибки оборачиваются в AppError с HTTP-кодом
 * 2. API routes ловят ошибки и возвращают единый формат
 * 3. Клиентские компоненты ловят ошибки через ErrorBoundary
 */

/**
 * Базовый класс ошибки приложения
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    
    // Сохраняем стек-трейс
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============ Предопределённые ошибки ============

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} з id ${id} не знайдено` : `${resource} не знайдено`,
      404,
      'NOT_FOUND'
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Необхідна авторизація') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Недостатньо прав') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR', true, { fields });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(
      'Забагато запитів. Спробуйте пізніше.',
      429,
      'RATE_LIMITED',
      true,
      { retryAfter }
    );
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(
      `Помилка сервісу ${service}: ${message}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      true,
      { service }
    );
  }
}

// ============ API Response Helpers ============

/**
 * Единый формат ответа API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

/**
 * Успешный ответ
 */
export function apiSuccess<T>(data: T, status: number = 200): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  
  return NextResponse.json(response, { status });
}

/**
 * Ответ с ошибкой
 */
export function apiError(
  error: AppError | Error,
  statusCode?: number
): Response {
  if (error instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.context,
      },
    };
    
    return NextResponse.json(response, { status: error.statusCode });
  }
  
  // Неизвестная ошибка — не раскрываем детали в проде
  const isDev = process.env.NODE_ENV !== 'production';
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? error.message : 'Внутрішня помилка сервера',
    },
  };
  
  return NextResponse.json(response, { status: statusCode || 500 });
}

// ============ API Route Wrapper ============

import { NextResponse } from 'next/server';
import { logError } from '@/lib/logging/logger';

/**
 * Обёртка для API routes с автоматическим error handling
 * 
 * @example
 * export const GET = withErrorHandling(async (request) => {
 *   const data = await fetchData();
 *   return apiSuccess(data);
 * });
 */
export function withErrorHandling(
  handler: (request: Request, context?: any) => Promise<Response>
) {
  return async (request: Request, context?: any): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (err: any) {
      // Логируем ошибку
      logError(err, {
        method: request.method,
        url: request.url,
      });
      
      // Возвращаем единый формат
      if (err instanceof AppError) {
        return apiError(err);
      }
      
      return apiError(err);
    }
  };
}

// ============ Client-side Error Boundary ============

/**
 * Обработка ошибок на клиенте
 * 
 * @example
 * try {
 *   const res = await fetch('/api/deals');
 *   const data = await handleApiResponse(res);
 * } catch (err) {
 *   if (err instanceof AppError) {
 *     toast.error(err.message);
 *   }
 * }
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  const data: ApiResponse<T> = await response.json();
  
  if (!data.success || data.error) {
    throw new AppError(
      data.error?.message || 'Помилка запиту',
      response.status,
      data.error?.code || 'API_ERROR',
      true,
      data.error?.details
    );
  }
  
  return data.data as T;
}
