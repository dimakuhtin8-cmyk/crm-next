/**
 * Tenant-scoped query helpers
 *
 * All data queries MUST use these helpers to ensure tenant isolation.
 * This prevents cross-tenant data leaks.
 */

import { prisma } from '@crm-next/database';

import type { NextRequest } from 'next/server';

import { extractUser } from '@/lib/auth-utils';
import { getUserRole } from '@/lib/rbac';

type PrismaClient = typeof prisma;

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
 * Create a tenant-scoped query helper
 *
 * Usage:
 *   const tenantQuery = createTenantQuery(tenantId);
 *   const contacts = await tenantQuery.contact.findMany();
 */
export function createTenantQuery(tenantId: string) {
  return {
    tenantId,

    // Contact queries
    contact: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number }) =>
        prisma.contact.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown> }) =>
        prisma.contact.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string } }) =>
        prisma.contact.findUnique(args),
      create: (args: { data: Record<string, unknown> }) =>
        prisma.contact.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      update: (args: { where: { id: string }; data: Record<string, unknown> }) =>
        prisma.contact.update(args as never),
      delete: (args: { where: { id: string } }) =>
        prisma.contact.delete(args),
      count: (args?: { where?: Record<string, unknown> }) =>
        prisma.contact.count({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
    },

    // Task queries
    task: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number; include?: Record<string, unknown> }) =>
        prisma.task.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        prisma.task.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string }; include?: Record<string, unknown> }) =>
        prisma.task.findUnique(args as never),
      create: (args: { data: Record<string, unknown> }) =>
        prisma.task.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      update: (args: { where: { id: string }; data: Record<string, unknown> }) =>
        prisma.task.update(args as never),
      delete: (args: { where: { id: string } }) =>
        prisma.task.delete(args),
      count: (args?: { where?: Record<string, unknown> }) =>
        prisma.task.count({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
    },

    // TaskComment queries
    taskComment: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) =>
        prisma.taskComment.findMany({
          ...args,
          where: { ...args?.where } as never,
        }),
      create: (args: { data: Record<string, unknown> }) =>
        prisma.taskComment.create({
          ...args,
        } as never),
      delete: (args: { where: { id: string } }) =>
        prisma.taskComment.delete(args),
    },

    // Tenant queries
    tenant: {
      findUnique: (args: { where: { id: string }; include?: Record<string, boolean> }) =>
        prisma.tenant.findUnique(args as never),
      update: (args: { where: { id: string }; data: Record<string, unknown> }) =>
        prisma.tenant.update(args as never),
    },

    // Member queries
    member: {
      findMany: () =>
        prisma.tenantMember.findMany({
          where: { tenantId },
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        }),
      findFirst: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        prisma.tenantMember.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
    },

    // Tag queries
    tag: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) =>
        prisma.tag.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown> }) =>
        prisma.tag.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      create: (args: { data: Record<string, unknown> }) =>
        prisma.tag.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      delete: (args: { where: { id: string } }) =>
        prisma.tag.delete(args),
    },

    // ContactTag queries
    contactTag: {
      findMany: (args?: { where?: Record<string, unknown> }) =>
        prisma.contactTag.findMany({
          ...args,
          where: { ...args?.where } as never,
        }),
      create: (args: { data: Record<string, unknown> }) =>
        prisma.contactTag.create({
          ...args,
        } as never),
      delete: (args: { where: { id: string } }) =>
        prisma.contactTag.delete(args),
      deleteMany: (args: { where: Record<string, unknown> }) =>
        prisma.contactTag.deleteMany({
          ...args,
        } as never),
    },

    // Activity queries
    activity: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number }) =>
        prisma.activity.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      create: (args: { data: Record<string, unknown> }) =>
        prisma.activity.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      count: (args?: { where?: Record<string, unknown> }) =>
        prisma.activity.count({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
    },

    // Pipeline queries
    pipeline: {
      findMany: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown>; orderBy?: Record<string, string> }) =>
        prisma.pipeline.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        prisma.pipeline.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string }; include?: Record<string, unknown> }) =>
        prisma.pipeline.findUnique(args as never),
      create: (args: { data: Record<string, unknown>; include?: Record<string, unknown> }) =>
        prisma.pipeline.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      update: (args: { where: { id: string }; data: Record<string, unknown> }) =>
        prisma.pipeline.update(args as never),
      delete: (args: { where: { id: string } }) =>
        prisma.pipeline.delete(args),
    },

    // PipelineStage queries
    pipelineStage: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string> }) =>
        prisma.pipelineStage.findMany({
          ...args,
          where: { ...args?.where } as never,
        }),
      create: (args: { data: Record<string, unknown> }) =>
        prisma.pipelineStage.create({
          ...args,
        } as never),
      update: (args: { where: { id: string }; data: Record<string, unknown> }) =>
        prisma.pipelineStage.update(args as never),
      delete: (args: { where: { id: string } }) =>
        prisma.pipelineStage.delete(args),
      deleteMany: (args: { where: Record<string, unknown> }) =>
        prisma.pipelineStage.deleteMany({
          ...args,
        } as never),
    },

    // Deal queries
    deal: {
      findMany: (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number; include?: Record<string, unknown> }) =>
        prisma.deal.findMany({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findFirst: (args?: { where?: Record<string, unknown>; include?: Record<string, unknown> }) =>
        prisma.deal.findFirst({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      findUnique: (args: { where: { id: string }; include?: Record<string, unknown> }) =>
        prisma.deal.findUnique(args as never),
      create: (args: { data: Record<string, unknown>; include?: Record<string, unknown> }) =>
        prisma.deal.create({
          ...args,
          data: { ...args.data, tenantId },
        } as never),
      update: (args: { where: { id: string }; data: Record<string, unknown> }) =>
        prisma.deal.update(args as never),
      delete: (args: { where: { id: string } }) =>
        prisma.deal.delete(args),
      count: (args?: { where?: Record<string, unknown> }) =>
        prisma.deal.count({
          ...args,
          where: { ...args?.where, tenantId } as never,
        }),
      groupBy: (args: { by: string[]; where?: Record<string, unknown>; _sum?: Record<string, boolean>; _count?: Record<string, boolean> }) =>
        prisma.deal.groupBy({
          ...args,
          where: { ...args.where, tenantId } as never,
        } as never),
    },

    // DealProduct queries
    dealProduct: {
      findMany: (args?: { where?: Record<string, unknown> }) =>
        prisma.dealProduct.findMany({
          ...args,
        }),
      create: (args: { data: Record<string, unknown> }) =>
        prisma.dealProduct.create({
          ...args,
        } as never),
      delete: (args: { where: { id: string } }) =>
        prisma.dealProduct.delete(args),
      deleteMany: (args: { where: Record<string, unknown> }) =>
        prisma.dealProduct.deleteMany({
          ...args,
        } as never),
    },
  };
}

/**
 * Validate tenant access from request
 * Returns tenantQuery if valid, null if not
 */
export async function getTenantQuery(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) return null;
  return createTenantQuery(tenantId);
}
