/**
 * Role-Based Access Control (RBAC) utilities
 *
 * Roles hierarchy: owner > admin > member > viewer
 *
 * Roles:
 * - owner: Full access, billing, delete tenant
 * - admin: Manage members, all CRUD, settings
 * - member: Create/read/update own + assigned data
 * - viewer: Read-only access
 */

import { prisma } from '@crm-next/database';

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer';

export const ROLE_HIERARCHY: Record<TenantRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

// Permission matrix
const PERMISSIONS: Record<TenantRole, string[]> = {
  owner: [
    'tenant:read', 'tenant:update', 'tenant:delete', 'tenant:billing',
    'member:read', 'member:invite', 'member:update_role', 'member:remove',
    'contact:create', 'contact:read', 'contact:update', 'contact:delete',
    'deal:create', 'deal:read', 'deal:update', 'deal:delete',
    'task:create', 'task:read', 'task:update', 'task:delete',
    'activity:create', 'activity:read',
    'pipeline:create', 'pipeline:read', 'pipeline:update', 'pipeline:delete',
    'analytics:read', 'audit:read',
    'settings:read', 'settings:update',
    'ai:use',
  ],
  admin: [
    'tenant:read',
    'member:read', 'member:invite', 'member:update_role', 'member:remove',
    'contact:create', 'contact:read', 'contact:update', 'contact:delete',
    'deal:create', 'deal:read', 'deal:update', 'deal:delete',
    'task:create', 'task:read', 'task:update', 'task:delete',
    'activity:create', 'activity:read',
    'pipeline:create', 'pipeline:read', 'pipeline:update', 'pipeline:delete',
    'analytics:read', 'audit:read',
    'settings:read', 'settings:update',
    'ai:use',
  ],
  member: [
    'tenant:read', 'member:read',
    'contact:create', 'contact:read', 'contact:update',
    'deal:create', 'deal:read', 'deal:update',
    'task:create', 'task:read', 'task:update',
    'activity:create', 'activity:read',
    'pipeline:read',
    'analytics:read',
    'settings:read',
    'ai:use',
  ],
  viewer: [
    'tenant:read', 'member:read',
    'contact:read', 'deal:read', 'task:read',
    'activity:read', 'pipeline:read',
    'analytics:read', 'settings:read',
  ],
};

export const ALL_PERMISSIONS = [
  'tenant:read', 'tenant:update', 'tenant:delete', 'tenant:billing',
  'member:read', 'member:invite', 'member:update_role', 'member:remove',
  'contact:create', 'contact:read', 'contact:update', 'contact:delete',
  'deal:create', 'deal:read', 'deal:update', 'deal:delete',
  'task:create', 'task:read', 'task:update', 'task:delete',
  'activity:create', 'activity:read',
  'pipeline:create', 'pipeline:read', 'pipeline:update', 'pipeline:delete',
  'analytics:read', 'audit:read',
  'settings:read', 'settings:update',
  'ai:use',
];

export const PERMISSION_CATEGORIES = [
  { name: 'Контакти', permissions: ['contact:create', 'contact:read', 'contact:update', 'contact:delete'] },
  { name: 'Угоди', permissions: ['deal:create', 'deal:read', 'deal:update', 'deal:delete'] },
  { name: 'Задачі', permissions: ['task:create', 'task:read', 'task:update', 'task:delete'] },
  { name: 'Активність', permissions: ['activity:create', 'activity:read'] },
  { name: 'Воронки', permissions: ['pipeline:create', 'pipeline:read', 'pipeline:update', 'pipeline:delete'] },
  { name: 'Аналітика', permissions: ['analytics:read'] },
  { name: 'Учасники', permissions: ['member:read', 'member:invite', 'member:update_role', 'member:remove'] },
  { name: 'Налаштування', permissions: ['settings:read', 'settings:update', 'tenant:read', 'tenant:update', 'tenant:billing'] },
  { name: 'Аудит', permissions: ['audit:read'] },
];

export async function getUserRole(userId: string, tenantId: string): Promise<TenantRole | null> {
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

export async function hasPermission(userId: string, tenantId: string, permission: string): Promise<boolean> {
  const role = await getUserRole(userId, tenantId);
  if (!role) return false;
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export async function hasMinRole(userId: string, tenantId: string, minRole: TenantRole): Promise<boolean> {
  const role = await getUserRole(userId, tenantId);
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

export function getRolePermissions(role: TenantRole): string[] {
  return PERMISSIONS[role] || [];
}

export function canManageRole(actorRole: TenantRole, targetRole: TenantRole): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

export async function getTenantsWithPermission(
  userId: string,
  permission: string
): Promise<Array<{ id: string; name: string; slug: string; role: TenantRole }>> {
  const memberships = await prisma.tenantMember.findMany({
    where: { userId },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
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

export function getDataScope(role: TenantRole): 'all' | 'own' | 'none' {
  if (role === 'owner' || role === 'admin' || role === 'viewer') return 'all';
  if (role === 'member') return 'own';
  return 'none';
}

export function buildDataFilter(
  role: TenantRole,
  userId: string,
  field: string = 'assigneeId'
): Record<string, unknown> | undefined {
  if (role === 'owner' || role === 'admin' || role === 'viewer') return undefined;
  return { OR: [{ [field]: userId }, { [field]: null }] };
}
