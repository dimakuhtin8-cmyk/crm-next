/**
 * Cache System — кэширование для ускорения ответов
 * 
 * Архитектура:
 * 1. In-Memory Cache (LRU) — для dev и small deployments
 * 2. При масштабировании → Redis (exchangeable)
 * 
 * Паттерны:
 * - Cache-Aside: сначала читаем из кэша, потом из БД
 * - Stale-While-Revalidate: отдаём старые данные, обновляем в фоне
 * - Tag-based Invalidation: инвалидация по тегам
 * 
 * TTL (Time To Live):
 * - Контакты: 5 минут (часто обновляются)
 * - Сделки: 2 минуты (критичны для актуальности)
 * - Задачи: 3 минуты
 * - Аналитика: 10 минут (дорогие запросы)
 * - Настройки: 30 минут (редко меняются)
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
    
    // Очистка каждые 5 минут
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Получить значение из кэша
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Проверяем TTL
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Установить значение в кэш
   */
  set<T>(
    key: string,
    value: T,
    ttlMs: number = 5 * 60 * 1000,
    tags: string[] = []
  ): void {
    // Проверяем лимит размера
    if (this.store.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tags,
      createdAt: Date.now(),
    });
    
    this.stats.sets++;
  }

  /**
   * Удалить значение из кэша
   */
  delete(key: string): boolean {
    this.stats.deletes++;
    return this.store.delete(key);
  }

  /**
   * Инвалидировать по тегу
   * Все записи с этим тегом удаляются
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.includes(tag)) {
        this.store.delete(key);
        count++;
      }
    }
    
    this.stats.deletes += count;
    return count;
  }

  /**
   * Очистить весь кэш
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Получить статистику
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
    };
  }

  /**
   * Очистка expired записей
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Удалить самую старую запись (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  /**
   * Уничтожить кэш
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// ============ Singleton Instance ============

export const cache = new MemoryCache(10000);

// ============ Cache Key Generators ============

/**
 * Генераторы ключей для разных типов данных
 */
export const cacheKeys = {
  // Контакты
  contact: (id: string) => `contact:${id}`,
  contacts: (tenantId: string, params?: string) => 
    `contacts:${tenantId}${params ? `:${params}` : ''}`,
  
  // Сделки
  deal: (id: string) => `deal:${id}`,
  deals: (tenantId: string, pipelineId?: string) => 
    `deals:${tenantId}${pipelineId ? `:${pipelineId}` : ''}`,
  pipeline: (id: string) => `pipeline:${id}`,
  pipelines: (tenantId: string) => `pipelines:${tenantId}`,
  
  // Задачи
  task: (id: string) => `task:${id}`,
  tasks: (tenantId: string, params?: string) => 
    `tasks:${tenantId}${params ? `:${params}` : ''}`,
  
  // Аналитика
  dashboard: (tenantId: string) => `dashboard:${tenantId}`,
  analytics: (tenantId: string, period?: string) => 
    `analytics:${tenantId}${period ? `:${period}` : ''}`,
  
  // Настройки
  tenant: (id: string) => `tenant:${id}`,
  user: (id: string) => `user:${id}`,
  
  // AI
  aiScore: (dealId: string) => `ai:score:${dealId}`,
  aiAnalysis: (type: string, id: string) => `ai:analysis:${type}:${id}`,
};

// ============ TTL Constants (in milliseconds) ============

export const TTL = {
  // Short — данные часто меняются
  DEALS: 2 * 60 * 1000,        // 2 минуты
  CONTACTS: 5 * 60 * 1000,     // 5 минут
  TASKS: 3 * 60 * 1000,        // 3 минуты
  MESSAGES: 1 * 60 * 1000,     // 1 минута
  
  // Medium — данные меняются умеренно
  PIPELINES: 10 * 60 * 1000,   // 10 минут
  TENANTS: 15 * 60 * 1000,     // 15 минут
  USERS: 15 * 60 * 1000,       // 15 минут
  
  // Long — данные редко меняются
  SETTINGS: 30 * 60 * 1000,    // 30 минут
  ANALYTICS: 10 * 60 * 1000,   // 10 минут (дорогие запросы)
  DASHBOARD: 5 * 60 * 1000,    // 5 минут
  
  // AI — кэшируем результаты
  AI_SCORE: 30 * 60 * 1000,    // 30 минут
  AI_ANALYSIS: 60 * 60 * 1000, // 1 час
};

// ============ Cache Tags ============

export const cacheTags = {
  CONTACTS: 'contacts',
  DEALS: 'deals',
  TASKS: 'tasks',
  PIPELINES: 'pipelines',
  TENANT: 'tenant',
  USER: 'user',
  DASHBOARD: 'dashboard',
  ANALYTICS: 'analytics',
  AI: 'ai',
};

// ============ Helper Functions ============

/**
 * Получить из кэша или вычислить
 * 
 * @example
 * const deals = await cachedGet(
 *   cacheKeys.deals(tenantId),
 *   TTL.DEALS,
 *   [cacheTags.DEALS],
 *   () => prisma.deal.findMany({ where: { tenantId } })
 * );
 */
export async function cachedGet<T>(
  key: string,
  ttl: number,
  tags: string[],
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Пробуем из кэша
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  // 2. Загружаем из источника
  const data = await fetcher();
  
  // 3. Сохраняем в кэш
  cache.set(key, data, ttl, tags);
  
  return data;
}

/**
 * Инвалидировать кэш при изменении данных
 * 
 * @example
 * // После обновления сделки
 * await invalidateCache(cacheKeys.deal(dealId));
 * await invalidateCacheByTag(cacheTags.DEALS);
 */
export async function invalidateCache(key: string): Promise<void> {
  cache.delete(key);
}

export async function invalidateCacheByTag(tag: string): Promise<number> {
  return cache.invalidateByTag(tag);
}

/**
 * Cache-aside pattern с stale-while-revalidate
 * 
 * Возвращает { data, isStale }
 * Если isStale === true, данные устарели, но отданы для быстрой загрузки
 */
export async function cachedGetStale<T>(
  key: string,
  ttl: number,
  staleTtl: number,
  tags: string[],
  fetcher: () => Promise<T>
): Promise<{ data: T; isStale: boolean }> {
  const entry = (cache as any).store.get(key) as CacheEntry<T> | undefined;
  
  // Нет в кэше — загружаем
  if (!entry) {
    const data = await fetcher();
    cache.set(key, data, ttl, tags);
    return { data, isStale: false };
  }
  
  // Есть, но протух — отдаём как stale, обновляем в фоне
  if (Date.now() > entry.expiresAt) {
    // Stale-while-revalidate: обновляем в фоне
    fetcher().then((freshData) => {
      cache.set(key, freshData, ttl, tags);
    }).catch(() => {});
    
    return { data: entry.value, isStale: true };
  }
  
  // Есть и свежий
  return { data: entry.value, isStale: false };
}

/**
 * Массовая инвалидация при смене тенанта
 */
export async function invalidateTenantCache(tenantId: string): Promise<void> {
  // Инвалидируем все теги, связанные с тенантом
  const tags = [
    cacheTags.CONTACTS,
    cacheTags.DEALS,
    cacheTags.TASKS,
    cacheTags.PIPELINES,
    cacheTags.DASHBOARD,
    cacheTags.ANALYTICS,
  ];
  
  for (const tag of tags) {
    cache.invalidateByTag(tag);
  }
}

/**
 * Промежуточное ПО для кэширования API responses
 */
export function withCache(
  ttl: number,
  tags: string[] = []
) {
  return function cacheMiddleware(handler: Function) {
    return async (request: Request, context?: any) => {
      const url = new URL(request.url);
      const key = `api:${request.method}:${url.pathname}:${url.search}`;
      
      // GET запросы кэшируем
      if (request.method === 'GET') {
        const cached = cache.get<Response>(key);
        if (cached) {
          return cached;
        }
        
        const response = await handler(request, context);
        
        if (response.status === 200) {
          cache.set(key, response, ttl, tags);
        }
        
        return response;
      }
      
      // Для mutation — инвалидируем кэш
      const response = await handler(request, context);
      
      // Инвалидируем по тегам
      for (const tag of tags) {
        cache.invalidateByTag(tag);
      }
      
      return response;
    };
  };
}
