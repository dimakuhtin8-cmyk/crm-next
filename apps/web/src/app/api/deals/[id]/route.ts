import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/deals/[id] — Get deal details
 */
export async function GET(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    const deal = await tq.deal.findUnique({
      where: { id },
      include: { products: true, stage: true, pipeline: true, contact: true },
    });

    if (!deal) return NextResponse.json({ error: 'Угоду не знайдено' }, { status: 404 });
    return NextResponse.json({ deal });
  } catch (error) {
    console.error('Get deal error:', error);
    return NextResponse.json({ error: 'Помилка отримання угоди' }, { status: 500 });
  }
}

/**
 * PUT /api/deals/[id] — Update deal
 */
const updateDealSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  value: z.number().min(0).optional().nullable(),
  currency: z.string().max(3).optional(),
  probability: z.number().min(0).max(100).optional(),
  contactId: z.string().optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  winReason: z.string().max(500).optional().nullable(),
  lossReason: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  products: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    quantity: z.number().min(1).default(1),
    price: z.number().min(0),
  })).optional(),
});

export async function PUT(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = updateDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { products, ...dealData } = parsed.data;

    // Handle close date and status
    if (dealData.status === 'won' || dealData.status === 'lost') {
      (dealData as Record<string, unknown>).actualCloseDate = new Date();
    }
    if (dealData.expectedCloseDate !== undefined) {
      (dealData as Record<string, unknown>).expectedCloseDate = dealData.expectedCloseDate
        ? new Date(dealData.expectedCloseDate)
        : null;
    }

    // Update products if provided
    if (products) {
      await tq.dealProduct.deleteMany({ where: { dealId: id } });
      if (products.length > 0) {
        await Promise.all(
          products.map((p) =>
            tq.dealProduct.create({
              data: { dealId: id, name: p.name, quantity: p.quantity, price: p.price },
            })
          )
        );
      }
    }

    const deal = await (tq.deal as unknown as {
      update: (args: { where: { id: string }; data: Record<string, unknown>; include?: Record<string, unknown> }) => Promise<unknown>;
    }).update({
      where: { id },
      data: dealData as Record<string, unknown>,
      include: { products: true, stage: true, pipeline: true, contact: true },
    });

    return NextResponse.json({ deal });
  } catch (error) {
    console.error('Update deal error:', error);
    return NextResponse.json({ error: 'Помилка оновлення угоди' }, { status: 500 });
  }
}

/**
 * DELETE /api/deals/[id] — Delete deal
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { id } = await params;
    await tq.deal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete deal error:', error);
    return NextResponse.json({ error: 'Помилка видалення угоди' }, { status: 500 });
  }
}
