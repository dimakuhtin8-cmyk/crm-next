/**
 * Deals API — CRUD для угод
 * 
 * GET /api/deals — Список угод (кэширован)
 * POST /api/deals — Створення угоди (інвалідує кеш)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { csrfProtection } from '@/lib/csrf';
import { extractUserId } from '@/lib/auth-utils';
import { getUserRole } from '@/lib/rbac';
import { getTenantQuery } from '@/lib/tenant-query';
import { cachedGet, cacheKeys, TTL, cacheTags, invalidateCacheByTag } from '@/lib/cache';
import { apiSuccess } from '@/lib/errors';
import { withAuth } from '@/lib/auth-guard';

/**
 * GET /api/deals — List deals (кэширован)
 */
async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  const tq = await getTenantQuery(request);
  if (!tq) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const pipelineId = searchParams.get('pipelineId') || undefined;
  const stageId = searchParams.get('stageId') || undefined;
  const status = searchParams.get('status') || undefined;
  const contactId = searchParams.get('contactId') || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');

  // RBAC data filter (injected by withAuth, field: ownerId).
  // MUST be part of the cache key — otherwise a member could receive
  // another member's cached response.
  const dataFilterParam = searchParams.get('_dataFilter') || undefined;

  // Генерируем ключ кэша на основе параметров (включая фильтр доступа)
  const cacheKey = cacheKeys.deals(
    tq.tenantId,
    `${search || ''}:${pipelineId || ''}:${stageId || ''}:${status || ''}:${contactId || ''}:${page}:${limit}:${dataFilterParam || ''}`
  );

  // Кэшируем результат
  const data = await cachedGet(
    cacheKey,
    TTL.DEALS,
    [cacheTags.DEALS, cacheTags.DASHBOARD],
    async () => {
      const skip = (page - 1) * limit;
      const where: Record<string, unknown> = {};
      
      if (search) where.OR = [
        { title: { contains: search } },
        { company: { contains: search } },
      ];
      if (pipelineId) where.pipelineId = pipelineId;
      if (stageId) where.stageId = stageId;
      if (status) where.status = status;
      if (contactId) where.contactId = contactId;
      if (dataFilterParam) {
        try {
          Object.assign(where, JSON.parse(dataFilterParam));
        } catch {}
      }

      const [deals, total] = await Promise.all([
        tq.deal.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            stage: { select: { name: true, color: true } },
            pipeline: { select: { name: true } },
            contact: { select: { firstName: true, lastName: true } },
            owner: { select: { id: true, name: true, email: true, image: true } },
          },
        }),
        tq.deal.count({ where }),
      ]);

      return { deals, total, page, limit };
    }
  );

  return apiSuccess(data);
}

/**
 * POST /api/deals — Create deal (інвалідує кеш)
 */
const createDealSchema = z.object({
  title: z.string().min(1).max(200),
  pipelineId: z.string(),
  stageId: z.string(),
  value: z.number().min(0).optional(),
  currency: z.string().max(3).default('UAH'),
  probability: z.number().min(0).max(100).default(50),
  contactId: z.string().optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  ownerId: z.string().optional().nullable(),
  products: z.array(z.object({
    name: z.string().min(1).max(200),
    quantity: z.number().min(1).default(1),
    price: z.number().min(0),
  })).optional(),
});

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  const tq = await getTenantQuery(request);
  if (!tq) {
    return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { products, ownerId: requestedOwnerId, ...dealData } = parsed.data;

  // Owner resolution: explicit ownerId allowed only for admin+ (backend-validated).
  // Default: the creator becomes the owner.
  const tqTenantId = (tq as unknown as { tenantId: string }).tenantId;
  const creatorId = await extractUserId(request);
  let ownerId: string | null = creatorId;
  if (requestedOwnerId !== undefined && requestedOwnerId !== null) {
    const role = creatorId ? await getUserRole(creatorId, tqTenantId) : null;
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Призначати власника може лише admin' }, { status: 403 });
    }
    ownerId = requestedOwnerId;
  }

  const deal = await tq.deal.create({
    data: {
      ...dealData,
      ownerId,
      expectedCloseDate: dealData.expectedCloseDate ? new Date(dealData.expectedCloseDate) : null,
      products: products?.length ? { create: products } : undefined,
    } as never,
    include: { products: true, stage: true, pipeline: true },
  });

  // Інвалідуємо кеш угод
  await invalidateCacheByTag(cacheTags.DEALS);

  return apiSuccess({ deal }, 201);
}

export const GET = withAuth({ dataFilter: true, dataField: 'ownerId' })(GETHandler);
export const POST = withAuth({ permission: 'deal:create' })(POSTHandler);
