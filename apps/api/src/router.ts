import { z } from 'zod';

import { router, publicProcedure, protectedProcedure, tenantProcedure } from './trpc';

// ============ HEALTH ============

const healthRouter = router({
  check: publicProcedure.query(() => {
    return {
      status: 'ok',
      service: 'crm-next-api',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  }),
});

// ============ TENANTS ============

const tenantRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        domain: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new Error('Unauthorized');

      const tenantRef = ctx.db.collection('tenants').doc();
      const memberRef = ctx.db
        .collection('tenants')
        .doc(tenantRef.id)
        .collection('members')
        .doc(ctx.userId);

      const tenant = {
        id: tenantRef.id,
        name: input.name,
        domain: input.domain || null,
        plan: 'free',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create tenant and add creator as owner
      await ctx.db.runTransaction(async (transaction) => {
        transaction.set(tenantRef, tenant);
        transaction.set(memberRef, {
          userId: ctx.userId,
          role: 'owner',
          joinedAt: new Date(),
        });
      });

      return { success: true, tenant };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) throw new Error('Unauthorized');

    const membersSnapshot = await ctx.db
      .collectionGroup('members')
      .where('userId', '==', ctx.userId)
      .get();

    const tenantIds = membersSnapshot.docs.map((doc) => doc.ref.parent.parent!.id);

    if (tenantIds.length === 0) return { tenants: [] };

    const tenantDocs = await Promise.all(
      tenantIds.map((id) => ctx.db.collection('tenants').doc(id).get()),
    );

    const tenants = tenantDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({ id: doc.id, ...doc.data() }));

    return { tenants };
  }),

  get: tenantProcedure.query(async ({ ctx }) => {
    const tenantDoc = await ctx.db.collection('tenants').doc(ctx.tenantId!).get();

    if (!tenantDoc.exists) {
      throw new Error('Tenant not found');
    }

    return { id: tenantDoc.id, ...tenantDoc.data() };
  }),
});

// ============ CONTACTS ============

const contactRouter = router({
  list: tenantProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .collection('contacts')
        .where('tenantId', '==', ctx.tenantId!)
        .orderBy('createdAt', 'desc')
        .limit(input.limit);

      if (input.cursor) {
        const cursorDoc = await ctx.db.collection('contacts').doc(input.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snapshot = await query.get();
      const contacts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        contacts,
        nextCursor:
          snapshot.docs.length === input.limit ? snapshot.docs[snapshot.docs.length - 1]?.id : null,
      };
    }),

  get: tenantProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const doc = await ctx.db.collection('contacts').doc(input.id).get();

    if (!doc.exists) {
      throw new Error('Contact not found');
    }

    return { id: doc.id, ...doc.data() };
  }),

  create: tenantProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().optional(),
        company: z.string().optional(),
        position: z.string().optional(),
        phones: z.array(z.string()).default([]),
        emails: z.array(z.string().email()).default([]),
        socials: z.record(z.string()).default({}),
        tags: z.array(z.string()).default([]),
        source: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ref = ctx.db.collection('contacts').doc();
      const contact = {
        id: ref.id,
        tenantId: ctx.tenantId!,
        ...input,
        ownerId: ctx.userId!,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await ref.set(contact);
      return { success: true, contact };
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        company: z.string().optional(),
        position: z.string().optional(),
        phones: z.array(z.string()).optional(),
        emails: z.array(z.string().email()).optional(),
        socials: z.record(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const ref = ctx.db.collection('contacts').doc(id);

      await ref.update({
        ...data,
        updatedAt: new Date(),
      });

      return { success: true, id };
    }),

  delete: tenantProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.collection('contacts').doc(input.id).delete();
    return { success: true };
  }),
});

// ============ DEALS ============

const dealRouter = router({
  list: tenantProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        stage: z.string().optional(),
        pipelineId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .collection('deals')
        .where('tenantId', '==', ctx.tenantId!)
        .orderBy('createdAt', 'desc')
        .limit(input.limit);

      if (input.stage) {
        query = query.where('stage', '==', input.stage);
      }

      if (input.pipelineId) {
        query = query.where('pipelineId', '==', input.pipelineId);
      }

      const snapshot = await query.get();
      const deals = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        deals,
        nextCursor:
          snapshot.docs.length === input.limit ? snapshot.docs[snapshot.docs.length - 1]?.id : null,
      };
    }),

  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        value: z.number().min(0).default(0),
        currency: z.string().default('UAH'),
        stage: z.string().default('lead'),
        pipelineId: z.string().min(1),
        contactIds: z.array(z.string()).default([]),
        products: z
          .array(
            z.object({
              name: z.string(),
              quantity: z.number().min(1).default(1),
              price: z.number().min(0),
            }),
          )
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ref = ctx.db.collection('deals').doc();
      const deal = {
        id: ref.id,
        tenantId: ctx.tenantId!,
        ...input,
        ownerId: ctx.userId!,
        probability: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await ref.set(deal);
      return { success: true, deal };
    }),

  updateStage: tenantProcedure
    .input(
      z.object({
        id: z.string(),
        stage: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ref = ctx.db.collection('deals').doc(input.id);
      await ref.update({
        stage: input.stage,
        updatedAt: new Date(),
      });
      return { success: true };
    }),
});

// ============ PIPELINES ============

const pipelineRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const snapshot = await ctx.db
      .collection('pipelines')
      .where('tenantId', '==', ctx.tenantId!)
      .get();

    const pipelines = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { pipelines };
  }),

  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        stages: z.array(
          z.object({
            id: z.string(),
            name: z.string().min(1),
            order: z.number().min(0),
            probability: z.number().min(0).max(100).optional(),
            color: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ref = ctx.db.collection('pipelines').doc();
      const pipeline = {
        id: ref.id,
        tenantId: ctx.tenantId!,
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await ref.set(pipeline);
      return { success: true, pipeline };
    }),
});

// ============ MAIN ROUTER ============

export const appRouter = router({
  health: healthRouter,
  tenants: tenantRouter,
  contacts: contactRouter,
  deals: dealRouter,
  pipelines: pipelineRouter,
});

export type AppRouter = typeof appRouter;
