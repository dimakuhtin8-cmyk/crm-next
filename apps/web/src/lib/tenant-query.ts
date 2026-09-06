/**
 * Tenant-scoped query helpers
 *
 * All data queries MUST use these helpers to ensure tenant isolation.
 * This prevents cross-tenant data leaks.
 *
 * Supports external databases:
 * - "shared" → default Prisma client (all tenants in one DB)
 * - "postgresql" / "mysql" / "mariadb" / "sqlserver" → dedicated Prisma client per tenant
 */

import { prisma } from '@crm-next/database';
import { getTenantDbClient, type DatabaseType } from '@crm-next/database/tenant-db';

import type { NextRequest } from 'next/server';

import { extractUser } from '@/lib/auth-utils';
import { getUserRole } from '@/lib/rbac';
import { decrypt, isEncrypted } from '@/lib/encryption';

type PrismaClient = typeof prisma;

/**
 * Error thrown when a record does not belong to the current tenant.
 * Carries Prisma code 'P2025' (record not found) so existing route
 * catch-blocks treat it as "not found" instead of leaking existence.
 */
export function tenantScopeError(): Error {
  return Object.assign(new Error('Record not found in tenant scope'), { code: 'P2025' });
}

type OwnedModel = 'contact' | 'task' | 'tag' | 'pipeline' | 'deal';

/**
 * Verify that a record with the given id belongs to the tenant.
 * Throws tenantScopeError() otherwise.
 */
async function assertOwned(
  db: PrismaClient,
  model: OwnedModel,
  id: string,
  tenantId: string,
): Promise<void> {
  const found = await (db[model] as {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  }).findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!found) throw tenantScopeError();
}

/**
 * Get tenant ID from request and verify membership
 */
export async function getTenantId(request: NextRequest): Promise<string | null> {
  const user = await extractUser(request);
  if (!user?.id) return null;

  // Try tenant from JWT first
  if (user.tenantId) {
    const role = await getUserRole(user.id, user.tenantId);
    if (role) return user.tenantId;
  }

  return null;
}

/**
 * Get the Prisma client for a specific tenant
 * Checks if tenant has external DB configured, falls back to shared DB
 */
async function getDbForTenant(tenantId: string): Promise<PrismaClient> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { databaseUrl: true, databaseType: true },
    });

    if (!tenant?.databaseUrl || !tenant.databaseType || tenant.databaseType === 'shared') {
      return prisma;
    }

    // databaseUrl is stored encrypted (see PUT /api/tenant/database);
    // fall back to plaintext for URLs written before encryption.
    let databaseUrl = tenant.databaseUrl;
    if (isEncrypted(databaseUrl)) {
      databaseUrl = decrypt(databaseUrl);
    }

    return getTenantDbClient(
      { databaseUrl, databaseType: tenant.databaseType as DatabaseType },
      prisma
    );
  } catch {
    return prisma;
  }
}

/**
 * Create a tenant-scoped query helper
 *
 * Usage:
 *   const tq = await createTenantQuery(tenantId);
 *   const contacts = await tq.contact.findMany();
 *
 * For external DBs, pass the resolved Prisma client:
 *   const db = await getDbForTenant(tenantId);
 *   const tq = createTenantQuery(tenantId, db);
 */
export function createTenantQuery(tenantId: string, db: PrismaClient = prisma) {
  return {
    tenantId,

    // Contact queries
    contact: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number }) =>
        db.contact.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown> }) =>
        db.contact.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string }; select?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.contact.findFirst({
          ...args,
          where: { id: args.where.id, tenantId },
        } as never),
      create: (args: { data: Record<string, unknown> }) =>
        db.contact.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        await assertOwned(db, 'contact', args.where.id, tenantId);
        return db.contact.update(args as never);
      },
      delete: async (args: { where: { id: string } }) => {
        await assertOwned(db, 'contact', args.where.id, tenantId);
        return db.contact.delete(args);
      },
      count: (args?: { where?: Record<string, unknown> }) =>
        db.contact.count({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
    },

    // Task queries
    task: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number; include?: Record<string, unknown> }) =>
        db.task.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.task.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string }; select?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.task.findFirst({
          ...args,
          where: { id: args.where.id, tenantId },
        } as never),
      create: (args: { data: Record<string, unknown> }) =>
        db.task.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        await assertOwned(db, 'task', args.where.id, tenantId);
        return db.task.update(args as never);
      },
      delete: async (args: { where: { id: string } }) => {
        await assertOwned(db, 'task', args.where.id, tenantId);
        return db.task.delete(args);
      },
      count: (args?: { where?: Record<string, unknown> }) =>
        db.task.count({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
    },

    // TaskComment queries (no tenantId in schema — ownership verified via parent task)
    taskComment: {
      findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) => {
        const taskId = args?.where?.taskId as string | undefined;
        if (!taskId) throw tenantScopeError();
        await assertOwned(db, 'task', taskId, tenantId);
        return db.taskComment.findMany({
          ...args,
          where: { ...args?.where } as never,
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const taskId = args.data.taskId as string | undefined;
        if (!taskId) throw tenantScopeError();
        await assertOwned(db, 'task', taskId, tenantId);
        return db.taskComment.create({
          ...args,
        } as never);
      },
      delete: async (args: { where: { id: string } }) => {
        const existing = await db.taskComment.findUnique({
          where: { id: args.where.id },
          select: { taskId: true },
        });
        if (!existing) throw tenantScopeError();
        await assertOwned(db, 'task', existing.taskId, tenantId);
        return db.taskComment.delete(args);
      },
    },

    // Tenant queries
    tenant: {
      findUnique: (args: { where: { id: string }; include?: Record<string, boolean> }) =>
        db.tenant.findUnique(args as never),
      update: (args: { where: { id: string }; data: Record<string, unknown> }) =>
        db.tenant.update(args as never),
    },

    // Member queries
    member: {
      findMany: () =>
        db.tenantMember.findMany({
          where: { tenantId },
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        }),
      findFirst: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.tenantMember.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
    },

    // Tag queries
    tag: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) =>
        db.tag.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown> }) =>
        db.tag.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string }; select?: Record<string, unknown> }) =>
        db.tag.findFirst({
          ...args,
          where: { id: args.where.id, tenantId },
        } as never),
      create: (args: { data: Record<string, unknown> }) =>
        db.tag.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      delete: async (args: { where: { id: string } }) => {
        await assertOwned(db, 'tag', args.where.id, tenantId);
        return db.tag.delete(args);
      },
    },

    // ContactTag queries (no tenantId in schema — ownership verified via parent contact + tag)
    contactTag: {
      findMany: async (args?: { where?: Record<string, unknown> }) => {
        const contactId = args?.where?.contactId as string | undefined;
        if (!contactId) throw tenantScopeError();
        await assertOwned(db, 'contact', contactId, tenantId);
        return db.contactTag.findMany({
          ...args,
          where: { ...args?.where } as never,
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const contactId = args.data.contactId as string | undefined;
        const tagId = args.data.tagId as string | undefined;
        if (!contactId || !tagId) throw tenantScopeError();
        await assertOwned(db, 'contact', contactId, tenantId);
        await assertOwned(db, 'tag', tagId, tenantId);
        return db.contactTag.create({
          ...args,
        } as never);
      },
      delete: async (args: { where: { id: string } }) => {
        const existing = await db.contactTag.findUnique({
          where: { id: args.where.id },
          select: { contactId: true },
        });
        if (!existing) throw tenantScopeError();
        await assertOwned(db, 'contact', existing.contactId, tenantId);
        return db.contactTag.delete(args);
      },
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        const contactId = args.where?.contactId as string | undefined;
        if (!contactId) throw tenantScopeError();
        await assertOwned(db, 'contact', contactId, tenantId);
        return db.contactTag.deleteMany({
          ...args,
        } as never);
      },
    },

    // Activity queries
    activity: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number }) =>
        db.activity.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      create: (args: { data: Record<string, unknown> }) =>
        db.activity.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      count: (args?: { where?: Record<string, unknown> }) =>
        db.activity.count({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
    },

    // Pipeline queries
    pipeline: {
      findMany: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown>; orderBy?: Record<string, string> }) =>
        db.pipeline.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.pipeline.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string }; select?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.pipeline.findFirst({
          ...args,
          where: { id: args.where.id, tenantId },
        } as never),
      create: (args: { data: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.pipeline.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        await assertOwned(db, 'pipeline', args.where.id, tenantId);
        return db.pipeline.update(args as never);
      },
      delete: async (args: { where: { id: string } }) => {
        await assertOwned(db, 'pipeline', args.where.id, tenantId);
        return db.pipeline.delete(args);
      },
    },

    // PipelineStage queries (no tenantId in schema — ownership verified via parent pipeline)
    pipelineStage: {
      findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) => {
        const pipelineId = args?.where?.pipelineId as string | undefined;
        if (!pipelineId) throw tenantScopeError();
        await assertOwned(db, 'pipeline', pipelineId, tenantId);
        return db.pipelineStage.findMany({
          ...args,
          where: { ...args?.where } as never,
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const pipelineId = args.data.pipelineId as string | undefined;
        if (!pipelineId) throw tenantScopeError();
        await assertOwned(db, 'pipeline', pipelineId, tenantId);
        return db.pipelineStage.create({
          ...args,
        } as never);
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = await db.pipelineStage.findUnique({
          where: { id: args.where.id },
          select: { pipelineId: true },
        });
        if (!existing) throw tenantScopeError();
        await assertOwned(db, 'pipeline', existing.pipelineId, tenantId);
        return db.pipelineStage.update(args as never);
      },
      delete: async (args: { where: { id: string } }) => {
        const existing = await db.pipelineStage.findUnique({
          where: { id: args.where.id },
          select: { pipelineId: true },
        });
        if (!existing) throw tenantScopeError();
        await assertOwned(db, 'pipeline', existing.pipelineId, tenantId);
        return db.pipelineStage.delete(args);
      },
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        const pipelineId = args.where?.pipelineId as string | undefined;
        if (!pipelineId) throw tenantScopeError();
        await assertOwned(db, 'pipeline', pipelineId, tenantId);
        return db.pipelineStage.deleteMany({
          ...args,
        } as never);
      },
    },

    // Deal queries
    deal: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number; include?: Record<string, unknown> }) =>
        db.deal.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.deal.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string }; select?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.deal.findFirst({
          ...args,
          where: { id: args.where.id, tenantId },
        } as never),
      create: (args: { data: Record<string, unknown>; include?: Record<string, unknown> }) =>
        db.deal.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        await assertOwned(db, 'deal', args.where.id, tenantId);
        return db.deal.update(args as never);
      },
      delete: async (args: { where: { id: string } }) => {
        await assertOwned(db, 'deal', args.where.id, tenantId);
        return db.deal.delete(args);
      },
      count: (args?: { where?: Record<string, unknown> }) =>
        db.deal.count({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      groupBy: (args: { by: string[]; where?: Record<string, unknown>; _sum?: Record<string, boolean>; _count?: Record<string, boolean> }) =>
        db.deal.groupBy({
          ...args,
          where: { ...args.where, tenantId } as never,
        } as never),
    },

    // DealProduct queries (no tenantId in schema — ownership verified via parent deal)
    dealProduct: {
      findMany: async (args?: { where?: Record<string, unknown> }) => {
        const dealId = args?.where?.dealId as string | undefined;
        if (!dealId) throw tenantScopeError();
        await assertOwned(db, 'deal', dealId, tenantId);
        return db.dealProduct.findMany({
          ...args,
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const dealId = args.data.dealId as string | undefined;
        if (!dealId) throw tenantScopeError();
        await assertOwned(db, 'deal', dealId, tenantId);
        return db.dealProduct.create({
          ...args,
        } as never);
      },
      delete: async (args: { where: { id: string } }) => {
        const existing = await db.dealProduct.findUnique({
          where: { id: args.where.id },
          select: { dealId: true },
        });
        if (!existing) throw tenantScopeError();
        await assertOwned(db, 'deal', existing.dealId, tenantId);
        return db.dealProduct.delete(args);
      },
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        const dealId = args.where?.dealId as string | undefined;
        if (!dealId) throw tenantScopeError();
        await assertOwned(db, 'deal', dealId, tenantId);
        return db.dealProduct.deleteMany({
          ...args,
        } as never);
      },
    },
  };
}

/**
 * Validate tenant access from request
 * Returns tenantQuery if valid, null if not
 *
 * Automatically resolves external DB if configured for the tenant
 */
export async function getTenantQuery(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) return null;

  // Resolve the correct Prisma client for this tenant
  const db = await getDbForTenant(tenantId);
  return createTenantQuery(tenantId, db);
}
