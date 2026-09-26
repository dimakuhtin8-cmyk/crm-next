/**
 * Audit Log — tracks user actions for compliance and debugging
 *
 * Logs: who did what, when, on which entity, with old/new values
 * Never stores sensitive data (passwords, API keys)
 */

import { prisma } from '@crm-next/database';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'invite' | 'role_change' | 'export' | 'import';
export type AuditEntity = 'contact' | 'deal' | 'task' | 'member' | 'settings' | 'auth' | 'pipeline' | 'import' | 'export';

interface AuditLogData {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId || null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent?.slice(0, 200) || null,
      },
    });
  } catch (err) {
    // Don't let audit failures break the app
    console.error('Audit log failed:', err);
  }
}

/**
 * Extract request metadata for audit logging
 */
export function extractRequestMeta(request: Request): { ipAddress: string; userAgent: string } {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent')?.slice(0, 200) || 'unknown';
  return { ipAddress, userAgent };
}

/**
 * Helper: compute diff between old and new values
 * Returns only changed fields
 */
export function computeDiff(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): { old: Record<string, unknown>; new: Record<string, unknown> } {
  const old: Record<string, unknown> = {};
  const newVals: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    // Skip unchanged, skip sensitive fields
    if (oldVal === newVal) continue;
    if (['password', 'apiKey', 'aiApiKey', 'geminiApiKey', 'stripeCustomerId'].includes(key)) continue;

    if (oldVal !== undefined) old[key] = oldVal;
    if (newVal !== undefined) newVals[key] = newVal;
  }

  return { old, new: newVals };
}

/**
 * Get audit logs for a tenant
 */
export async function getAuditLogs(
  tenantId: string,
  options: {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
    userId?: string;
    from?: string;
    to?: string;
  } = {}
): Promise<{
  logs: Array<{
    id: string;
    userId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    oldValues: string | null;
    newValues: string | null;
    ipAddress: string | null;
    createdAt: Date;
    user?: { name: string | null; email: string | null } | null;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const { page = 1, limit = 20, action, entity, userId, from, to } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };
  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        // We can't use include with the user relation directly since AuditLog.userId doesn't have a FK
        // So we'll do a manual lookup
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Enrich with user info
  const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))] as string[];
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  return {
    logs: logs.map(l => ({
      ...l,
      user: l.userId ? userMap.get(l.userId) || null : null,
    })),
    total,
    page,
    limit,
  };
}
