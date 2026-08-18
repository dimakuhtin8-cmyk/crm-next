import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';

import { auth, db } from './lib/firebase';

import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

// ============ CONTEXT ============

export interface Context {
  userId: string | null;
  tenantId: string | null;
  auth: typeof auth;
  db: typeof db;
}

export async function createContext({ req }: CreateFastifyContextOptions): Promise<Context> {
  const authHeader = req.headers['authorization'];
  let userId: string | null = null;
  let tenantId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      if (auth) {
        const decoded = await auth.verifyIdToken(token);
        userId = decoded.uid;
        tenantId = decoded.tenantId as string | null;
      }
    } catch {
      // Invalid token - user remains unauthenticated
    }
  }

  // Check tenant header for multi-tenancy
  const tenantHeader = req.headers['x-tenant-id'];
  if (tenantHeader && typeof tenantHeader === 'string') {
    tenantId = tenantHeader;
  }

  return {
    userId,
    tenantId,
    auth,
    db,
  };
}

// ============ TRPC INITIALIZATION ============

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

// ============ EXPORTS ============

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

// Tenant procedure - requires tenant context
export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Tenant ID is required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.tenantId,
    },
  });
});
