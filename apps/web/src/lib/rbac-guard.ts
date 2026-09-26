/**
 * RBAC Guard — higher-order function for API route protection
 *
 * Wraps API route handlers with permission checks.
 * Returns 403 if the user lacks the required permission.
 *
 * @example
 * export const POST = withPermission('contact:create')(async (request) => {
 *   // This only runs if the user has contact:create permission
 * });
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extractUserId } from '@/lib/auth-utils';
import { hasPermission, hasMinRole, type TenantRole } from '@/lib/rbac';
import { getTenantQuery } from '@/lib/tenant-query';

type Handler = (request: NextRequest, context?: any) => Promise<Response>;

/**
 * Require a specific permission
 */
export function withPermission(permission: string) {
  return function (handler: Handler): Handler {
    return async (request: NextRequest, context?: any): Promise<Response> => {
      try {
        const tq = await getTenantQuery(request);
        if (!tq) {
          return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
        }

        const userId = (tq as Record<string, unknown>).userId as string;
        if (!userId) {
          return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
        }

        const allowed = await hasPermission(userId, tq.tenantId, permission);
        if (!allowed) {
          return NextResponse.json(
            { error: 'Недостатньо прав', required: permission },
            { status: 403 }
          );
        }

        return handler(request, context);
      } catch (error) {
        console.error('RBAC guard error:', error);
        return NextResponse.json({ error: 'Помилка авторизації' }, { status: 500 });
      }
    };
  };
}

/**
 * Require a minimum role level
 */
export function withMinRole(minRole: TenantRole) {
  return function (handler: Handler): Handler {
    return async (request: NextRequest, context?: any): Promise<Response> => {
      try {
        const tq = await getTenantQuery(request);
        if (!tq) {
          return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
        }

        const userId = (tq as Record<string, unknown>).userId as string;
        if (!userId) {
          return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
        }

        const allowed = await hasMinRole(userId, tq.tenantId, minRole);
        if (!allowed) {
          return NextResponse.json(
            { error: 'Недостатньо прав', required: minRole },
            { status: 403 }
          );
        }

        return handler(request, context);
      } catch (error) {
        console.error('RBAC guard error:', error);
        return NextResponse.json({ error: 'Помилка авторизації' }, { status: 500 });
      }
    };
  };
}

/**
 * Deny viewer role (require write access)
 */
export function withWriteAccess() {
  return withMinRole('member');
}

/**
 * Require owner role
 */
export function withOwnerOnly() {
  return withMinRole('owner');
}
