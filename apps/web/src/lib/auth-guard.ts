/**
 * Auth Guard — обёртка для существующих API-роутов
 *
 * Добавляет проверку аутентификации и авторизации к любому роуту.
 * Не требует переписывания существующего кода — оборачивает handler.
 *
 * @example
 * export const POST = withAuth({ permission: 'contact:create' })(originalPOST);
 * export const GET = withAuth({ dataFilter: true })(originalGET);
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUser } from '@/lib/auth-utils';
import { hasPermission, getUserRole, buildDataFilter, type TenantRole } from '@/lib/rbac';

type RouteHandler = (request: NextRequest, context?: any) => Promise<Response>;

interface AuthGuardOptions {
  /** Требуемое разрешение (проверяет hasPermission) */
  permission?: string;
  /** Требуемый минимальный уровень роли */
  minRole?: TenantRole;
  /** Автоматически добавить data visibility filter в query params (для GET) */
  dataFilter?: boolean;
  /**
   * Поле принадлежности для dataFilter (per-модель).
   * Task → 'assigneeId' (дефолт), Contact/Deal → 'ownerId'.
   * Саму функцию buildDataFilter() не дублируем — поле настраивается здесь.
   */
  dataField?: string;
  /** Имя query параметра для tenantId (по умолчанию из tenant-query) */
  tenantIdParam?: string;
}

export function withAuth(options: AuthGuardOptions = {}) {
  return function (handler: RouteHandler): RouteHandler {
    return async (request: NextRequest, context?: any): Promise<Response> => {
      // 1. Аутентификация
      const user = await extractUser(request);
      if (!user?.id) {
        return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
      }

      // 2. Получаем tenantId из URL или из JWT
      const tenantId = context?.params?.id
        || new URL(request.url).searchParams.get('tenantId')
        || user.tenantId;

      if (!tenantId) {
        return NextResponse.json({ error: 'Тенант не визначений' }, { status: 400 });
      }

      // 3. Проверка разрешения
      if (options.permission) {
        const allowed = await hasPermission(user.id, tenantId, options.permission);
        if (!allowed) {
          return NextResponse.json(
            { error: 'Недостатньо прав', required: options.permission },
            { status: 403 }
          );
        }
      }

      // 4. Проверка минимальной роли
      if (options.minRole) {
        const role = await getUserRole(user.id, tenantId);
        if (!role) {
          return NextResponse.json({ error: 'Немає ролі в тенанті' }, { status: 403 });
        }
        const { ROLE_HIERARCHY } = await import('@/lib/rbac');
        if ((ROLE_HIERARCHY[role] || 0) < (ROLE_HIERARCHY[options.minRole] || 0)) {
          return NextResponse.json(
            { error: 'Недостатньо прав', required: options.minRole },
            { status: 403 }
          );
        }
      }

      // 5. Data visibility filter (для GET-запросов)
      if (options.dataFilter && request.method === 'GET') {
        const role = await getUserRole(user.id, tenantId);
        if (role) {
          const filter = buildDataFilter(role, user.id, options.dataField ?? 'assigneeId');
          if (filter) {
            const url = new URL(request.url);
            url.searchParams.set('_dataFilter', JSON.stringify(filter));
            // Клонируем запрос с изменённым URL, используя NextRequest для сохранения cookies
            const modifiedRequest = new NextRequest(url, {
              method: request.method,
              headers: request.headers,
              body: request.body,
              signal: request.signal,
            });
            return handler(modifiedRequest, context);
          }
        }
      }

      return handler(request, context);
    };
  };
}
