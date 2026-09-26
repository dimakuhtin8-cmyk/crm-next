/**
 * API Versioning — версионирование API
 * 
 * Стратегия: Route-based versioning (/api/v1/, /api/v2/)
 * 
 * Почему не Header-based:
 * - Проще дебажить (URL виден в браузере)
 * - Кэширование по URL работает автоматически
 * - Проще миграция для клиентов
 * 
 * Жизненный цикл версий:
 * - v1: Текущая стабильная (сейчас)
 * - v2: Следующая (когда будут breaking changes)
 * - deprecated: Помечается заголовком Deprecated
 * 
 * Заголовки:
 * - X-API-Version: текущая версия
 * - X-API-Deprecated: true если версия устаревает
 * - Sunset: дата отключения старой версии
 */

import { NextResponse } from 'next/server';

// ============ Version Config ============

export const API_VERSIONS = {
  v1: {
    version: '1.0.0',
    status: 'stable' as const,
    deprecated: false,
    sunsetDate: null,
  },
  v2: {
    version: '2.0.0',
    status: 'beta' as const,
    deprecated: false,
    sunsetDate: null,
  },
};

export const CURRENT_VERSION = 'v1';
export const DEPRECATED_VERSIONS: string[] = [];

// ============ Version Response Headers ============

/**
 * Добавить заголовки версии к ответу
 */
export function addVersionHeaders(
  response: NextResponse,
  version: string
): NextResponse {
  const versionConfig = API_VERSIONS[version as keyof typeof API_VERSIONS];
  
  if (versionConfig) {
    response.headers.set('X-API-Version', versionConfig.version);
    response.headers.set('X-API-Status', versionConfig.status);
    
    if (versionConfig.deprecated) {
      response.headers.set('X-API-Deprecated', 'true');
      if (versionConfig.sunsetDate) {
        response.headers.set('Sunset', versionConfig.sunsetDate);
      }
    }
  }
  
  return response;
}

// ============ Version Validation ============

/**
 * Проверить, поддерживается ли версия
 */
export function isVersionSupported(version: string): boolean {
  return version in API_VERSIONS;
}

/**
 * Проверить, устаревшая ли версия
 */
export function isVersionDeprecated(version: string): boolean {
  const config = API_VERSIONS[version as keyof typeof API_VERSIONS];
  return config?.deprecated ?? false;
}

/**
 * Получить текущую стабильную версию
 */
export function getLatestVersion(): string {
  const versions = Object.entries(API_VERSIONS)
    .filter(([_, config]) => config.status === 'stable')
    .sort(([a], [b]) => b.localeCompare(a));
  
  return versions[0]?.[0] || CURRENT_VERSION;
}

// ============ Version Migration Helpers ============

/**
 * Маппинг полей между версиями
 * 
 * @example
 * // v1 -> v2 маппинг
 * const v2Data = migrateFields(v1Data, {
 *   'firstName': 'name.first',
 *   'lastName': 'name.last',
 *   'email': 'contacts.email',
 * });
 */
export function migrateFields(
  data: Record<string, any>,
  fieldMap: Record<string, string>
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [oldPath, newPath] of Object.entries(fieldMap)) {
    const value = getNestedValue(data, oldPath);
    if (value !== undefined) {
      setNestedValue(result, newPath, value);
    }
  }
  
  return result;
}

/**
 * Получить вложенное значение по пути
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Установить вложенное значение по пути
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

// ============ Version Router Helper ============

/**
 * Получить версию из URL
 * 
 * /api/v1/deals -> v1
 * /api/deals -> v1 (по умолчанию)
 */
export function getVersionFromUrl(pathname: string): string {
  const match = pathname.match(/\/api\/(v\d+)\//);
  return match?.[1] || CURRENT_VERSION;
}

/**
 * Убрать префикс версии из пути
 * 
 * /api/v1/deals -> /deals
 * /api/deals -> /deals
 */
export function stripVersionPrefix(pathname: string): string {
  return pathname.replace(/\/api\/v\d+/, '/api');
}

// ============ Deprecation Warning ============

/**
 * Создать предупреждение об устаревшей версии
 */
export function createDeprecationNotice(
  fromVersion: string,
  toVersion: string,
  sunsetDate: string
): string {
  return `API ${fromVersion} deprecated. Migrate to ${toVersion} before ${sunsetDate}.`;
}

/**
 * Добавить предупреждение о депрекации
 */
export function addDeprecationWarning(
  response: NextResponse,
  fromVersion: string,
  toVersion: string,
  sunsetDate: string
): NextResponse {
  response.headers.set('Deprecation', 'true');
  response.headers.set('Sunset', sunsetDate);
  response.headers.set(
    'X-Deprecation-Notice',
    createDeprecationNotice(fromVersion, toVersion, sunsetDate)
  );
  
  return response;
}

// ============ API Changelog ============

/**
 * Журнал изменений API
 */
export const API_CHANGELOG = {
  v1: {
    '1.0.0': {
      date: '2026-08-28',
      features: [
        'Contacts CRUD',
        'Deals CRUD with Kanban',
        'Tasks CRUD',
        'Pipeline management',
        'AI Co-Pilot integration',
        'Multi-tenant support',
      ],
    },
  },
  v2: {
    '2.0.0-beta': {
      date: 'TBD',
      breakingChanges: [
        'Response format: { success, data, error }',
        'Pagination: cursor-based instead of offset',
        'Date format: ISO 8601 everywhere',
      ],
      features: [
        'Batch operations',
        'Real-time subscriptions',
        'Advanced filtering',
      ],
    },
  },
};

/**
 * Получить changelog для версии
 */
export function getChangelog(version: string) {
  return API_CHANGELOG[version as keyof typeof API_CHANGELOG] || {};
}
