import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/deals — List deals (tenant-scoped, with filters)
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const pipelineId = searchParams.get('pipelineId') || undefined;
    const stageId = searchParams.get('stageId') || undefined;
    const status = searchParams.get('status') || undefined;
    const contactId = searchParams.get('contactId') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
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

    const [deals, total] = await Promise.all([
      tq.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      tq.deal.count({ where }),
    ]);

    return NextResponse.json({ deals, total, page, limit });
  } catch (error) {
    console.error('List deals error:', error);
    return NextResponse.json({ error: 'Помилка отримання списку угод' }, { status: 500 });
  }
}

/**
 * POST /api/deals — Create deal
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
  products: z.array(z.object({
    name: z.string().min(1).max(200),
    quantity: z.number().min(1).default(1),
    price: z.number().min(0),
  })).optional(),
});

export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const parsed = createDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { products, ...dealData } = parsed.data;

    const deal = await tq.deal.create({
      data: {
        ...dealData,
        expectedCloseDate: dealData.expectedCloseDate ? new Date(dealData.expectedCloseDate) : null,
        products: products?.length ? { create: products } : undefined,
      } as never,
      include: { products: true, stage: true, pipeline: true },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    console.error('Create deal error:', error);
    return NextResponse.json({ error: 'Помилка створення угоди' }, { status: 500 });
  }
}
