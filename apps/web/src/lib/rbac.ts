/**
 * Role-Based Access Control (RBAC) utilities
 *
 * Roles hierarchy: owner > admin > member
 */

import { prisma } from '@crm-next/database';

export type TenantRole = 'owner' | 'admin' | 'member';

// Permission matrix
const PERMISSIONS: Record<TenantRole, string[]> = {
  owner: [
    'tenant:read',
    'tenant:update',
    'tenant:delete',
    'tenant:billing',
    'member:read',
    'member:invite',
    'member:update_role',
    'member:remove',
    'contact:create',
    'contact:read',
    'contact:update',
    'contact:delete',
    'deal:create',
    'deal:read',
    'deal:update',
    'deal:delete',
    'task:create',
    'task:read',
    'task:update',
    'task:delete',
    'analytics:read',
    'settings:read',
    'settings:update',
  ],
  admin: [
    'tenant:read',
    'member:read',
    'member:invite',
    'member:update_role',
    'member:remove',
    'contact:create',
    'contact:read',
    'contact:update',
    'contact:delete',
    'deal:create',
    'deal:read',
    'deal:update',
    'deal:delete',
    'task:create',
    'task:read',
    'task:update',
    'task:delete',
    'analytics:read',
    'settings:read',
    'settings:update',
  ],
  member: [
    'tenant:read',
    'member:read',
    'contact:create',
    'contact:read',
    'contact:update',
    'deal:create',
    'deal:read',
    'deal:update',
    'task:create',
    'task:read',
    'task:update',
    'analytics:read',
    'settings:read',
  ],
};

/**
 * Get user's role in a tenant
 */
export async function getUserRole(
  userId: string,
  tenantId: string
): Promise<TenantRole | null> {
  try {
    const membership = await prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { role: true },
    });
    return (membership?.role as TenantRole) || null;
  } catch {
    return null;
  }
}

/**
 * Check if user has a specific permission in a tenant
 */
export async function hasPermission(
  userId: string,
  tenantId: string,
  permission: string
): Promise<boolean> {
  const role = await getUserRole(userId, tenantId);
  if (!role) return false;

  return PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if user has minimum role level
 */
export async function hasMinRole(
  userId: string,
  tenantId: string,
  minRole: TenantRole
): Promise<boolean> {
  const role = await getUserRole(userId, tenantId);
  if (!role) return false;

  const roleHierarchy: Record<TenantRole, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  return roleHierarchy[role] >= roleHierarchy[minRole];
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: TenantRole): string[] {
  return PERMISSIONS[role] || [];
}

/**
 * Check if role can perform action on another role
 */
export function canManageRole(
  actorRole: TenantRole,
  targetRole: TenantRole
): boolean {
  const roleHierarchy: Record<TenantRole, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  // Can only manage roles below your level
  return roleHierarchy[actorRole] > roleHierarchy[targetRole];
}

/**
 * Get tenants where user has a specific permission
 */
export async function getTenantsWithPermission(
  userId: string,
  permission: string
): Promise<Array<{ id: string; name: string; slug: string; role: TenantRole }>> {
  const memberships = await prisma.tenantMember.findMany({
    where: { userId },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return memberships
    .filter((m) => {
      const role = m.role as TenantRole;
      return PERMISSIONS[role]?.includes(permission) ?? false;
    })
    .map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role as TenantRole,
    }));
}
