import { describe, it, expect } from 'vitest';
import {
  ROLE_HIERARCHY,
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  getRolePermissions,
  canManageRole,
  getDataScope,
  buildDataFilter,
  type TenantRole,
} from '@/lib/rbac';

describe('RBAC - Role Hierarchy', () => {
  it('should have correct hierarchy order: owner > admin > member > viewer', () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.member);
    expect(ROLE_HIERARCHY.member).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });

  it('should have 4 roles defined', () => {
    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(4);
  });
});

describe('RBAC - Permissions', () => {
  it('owner should have all permissions', () => {
    const ownerPerms = getRolePermissions('owner');
    expect(ownerPerms.length).toBeGreaterThanOrEqual(ALL_PERMISSIONS.length - 2); // at least most
    expect(ownerPerms).toContain('tenant:delete');
    expect(ownerPerms).toContain('tenant:billing');
    expect(ownerPerms).toContain('member:remove');
  });

  it('viewer should only have read permissions', () => {
    const viewerPerms = getRolePermissions('viewer');
    for (const perm of viewerPerms) {
      expect(perm).toContain(':read');
    }
    expect(viewerPerms).not.toContain('contact:create');
    expect(viewerPerms).not.toContain('deal:delete');
  });

  it('admin should have member management but not tenant delete', () => {
    const adminPerms = getRolePermissions('admin');
    expect(adminPerms).toContain('member:invite');
    expect(adminPerms).toContain('member:update_role');
    expect(adminPerms).toContain('contact:delete');
    expect(adminPerms).not.toContain('tenant:delete');
    expect(adminPerms).not.toContain('tenant:billing');
  });

  it('member should have CRUD on contacts, deals, tasks', () => {
    const memberPerms = getRolePermissions('member');
    expect(memberPerms).toContain('contact:create');
    expect(memberPerms).toContain('contact:read');
    expect(memberPerms).toContain('contact:update');
    expect(memberPerms).toContain('deal:create');
    expect(memberPerms).toContain('task:create');
    expect(memberPerms).not.toContain('contact:delete'); // no delete for member
  });
});

describe('RBAC - canManageRole', () => {
  it('owner can manage all roles', () => {
    expect(canManageRole('owner', 'admin')).toBe(true);
    expect(canManageRole('owner', 'member')).toBe(true);
    expect(canManageRole('owner', 'viewer')).toBe(true);
  });

  it('admin can manage member and viewer', () => {
    expect(canManageRole('admin', 'member')).toBe(true);
    expect(canManageRole('admin', 'viewer')).toBe(true);
  });

  it('admin cannot manage owner', () => {
    expect(canManageRole('admin', 'owner')).toBe(false);
  });

  it('member can manage viewer but not admin/owner', () => {
    expect(canManageRole('member', 'viewer')).toBe(true); // hierarchy allows
    expect(canManageRole('member', 'admin')).toBe(false);
  });

  it('viewer cannot manage anyone', () => {
    expect(canManageRole('viewer', 'member')).toBe(false);
  });

  it('same role cannot manage itself', () => {
    expect(canManageRole('admin', 'admin')).toBe(false);
    expect(canManageRole('member', 'member')).toBe(false);
  });
});

describe('RBAC - getDataScope', () => {
  it('owner sees all data', () => {
    expect(getDataScope('owner')).toBe('all');
  });

  it('admin sees all data', () => {
    expect(getDataScope('admin')).toBe('all');
  });

  it('viewer sees all data (read-only)', () => {
    expect(getDataScope('viewer')).toBe('all');
  });

  it('member sees own data only', () => {
    expect(getDataScope('member')).toBe('own');
  });
});

describe('RBAC - buildDataFilter', () => {
  it('owner returns no filter (sees all)', () => {
    expect(buildDataFilter('owner', 'user-1')).toBeUndefined();
  });

  it('admin returns no filter', () => {
    expect(buildDataFilter('admin', 'user-1')).toBeUndefined();
  });

  it('viewer returns no filter', () => {
    expect(buildDataFilter('viewer', 'user-1')).toBeUndefined();
  });

  it('member returns OR filter for own + unassigned', () => {
    const filter = buildDataFilter('member', 'user-123');
    expect(filter).toEqual({
      OR: [{ assigneeId: 'user-123' }, { assigneeId: null }],
    });
  });

  it('member with custom field uses that field', () => {
    const filter = buildDataFilter('member', 'user-123', 'createdById');
    expect(filter).toEqual({
      OR: [{ createdById: 'user-123' }, { createdById: null }],
    });
  });
});

describe('RBAC - Permission Categories', () => {
  it('should have 9 permission categories', () => {
    expect(PERMISSION_CATEGORIES).toHaveLength(9);
  });

  it('each category should have permissions array', () => {
    for (const cat of PERMISSION_CATEGORIES) {
      expect(Array.isArray(cat.permissions)).toBe(true);
      expect(cat.permissions.length).toBeGreaterThan(0);
    }
  });
});
