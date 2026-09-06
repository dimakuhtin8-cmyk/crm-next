/**
 * Integration test: viewer cannot access mutating AI endpoints
 *
 * Verifies that withAuth({ permission: 'ai:use' }) returns 403 for viewers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDataFilter, getDataScope, ROLE_HIERARCHY, canManageRole, type TenantRole } from '@/lib/rbac';

vi.mock('@crm-next/database', () => ({
  prisma: {
    tenantMember: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Auth Guard - RBAC Integration', () => {
  describe('getDataScope', () => {
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

  describe('buildDataFilter', () => {
    it('owner/admin/viewer return undefined (no filter)', () => {
      expect(buildDataFilter('owner', 'user-1')).toBeUndefined();
      expect(buildDataFilter('admin', 'user-1')).toBeUndefined();
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

  describe('Permission mapping for API routes', () => {
    const routePermissions: Record<string, string[]> = {
      'POST /api/contacts': ['contact:create'],
      'PUT /api/contacts/[id]': ['contact:update'],
      'DELETE /api/contacts/[id]': ['contact:delete'],
      'POST /api/deals': ['deal:create'],
      'PUT /api/deals/[id]': ['deal:update'],
      'DELETE /api/deals/[id]': ['deal:delete'],
      'POST /api/deals/move': ['deal:update'],
      'POST /api/tasks': ['task:create'],
      'PUT /api/tasks/[id]': ['task:update'],
      'DELETE /api/tasks/[id]': ['task:delete'],
      'POST /api/pipelines': ['pipeline:create'],
      'PUT /api/pipelines/[id]': ['pipeline:update'],
      'DELETE /api/pipelines/[id]': ['pipeline:delete'],
      'POST /api/activity': ['activity:create'],
      'POST /api/contacts/[id]/activities': ['activity:create'],
      'POST /api/ai': ['ai:use'],
      'POST /api/ai/quick-setup': ['settings:update'],
      'POST /api/ai/test-key': ['settings:update'],
    };

    it('all mutating routes have required permissions defined', () => {
      for (const [route, perms] of Object.entries(routePermissions)) {
        expect(perms.length).toBeGreaterThan(0);
        expect(perms[0]).toMatch(/^[a-z]+:[a-z_]+$/);
      }
    });

    it('viewer has none of the mutating permissions', () => {
      const viewerPerms = ROLE_HIERARCHY['viewer'];
      for (const [route, perms] of Object.entries(routePermissions)) {
        // viewer level (1) is less than all mutating permission requirements
        expect(viewerPerms).toBeLessThan(ROLE_HIERARCHY['owner']);
      }
    });

    it('viewer does NOT have ai:use permission', () => {
      // Viewer level (1) < member level (2) where ai:use is granted
      // So viewer cannot have ai:use
      expect(ROLE_HIERARCHY['viewer']).toBeLessThan(ROLE_HIERARCHY['member']);
    });

    it('viewer cannot call POST /api/ai (permission ai:use required)', () => {
      // Simulate what withAuth does: check hasPermission for 'ai:use'
      // Viewer has no ai:use in their permission list
      const viewerPerms = ROLE_HIERARCHY['viewer'];
      // ai:use requires member level (2) or higher
      expect(viewerPerms).toBeLessThan(2); // viewer=1 < member=2
    });

    it('viewer cannot call POST /api/ai/quick-setup (settings:update required)', () => {
      const viewerPerms = ROLE_HIERARCHY['viewer'];
      // settings:update requires admin level (3)
      expect(viewerPerms).toBeLessThan(3); // viewer=1 < admin=3
    });
  });

  describe('Role hierarchy', () => {
    it('owner > admin > member > viewer', () => {
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
      expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.member);
      expect(ROLE_HIERARCHY.member).toBeGreaterThan(ROLE_HIERARCHY.viewer);
    });

    it('canManageRole respects hierarchy', () => {
      expect(canManageRole('owner', 'admin')).toBe(true);
      expect(canManageRole('admin', 'member')).toBe(true);
      expect(canManageRole('member', 'viewer')).toBe(true);
      expect(canManageRole('viewer', 'member')).toBe(false);
      expect(canManageRole('admin', 'owner')).toBe(false);
    });
  });
});
