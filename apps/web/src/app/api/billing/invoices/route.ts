/**
 * GET /api/billing/invoices — Get payment history
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';
import { prisma } from '@crm-next/database';

async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { tenantId: tq.tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: { tenantId: tq.tenantId } }),
    ]);

    return NextResponse.json({
      payments,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Invoices error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання історії платежів' },
      { status: 500 }
    );
  }
}

export const GET = withAuth()(GETHandler);
