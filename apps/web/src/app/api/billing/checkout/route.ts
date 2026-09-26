/**
 * POST /api/billing/checkout — Create Stripe checkout session
 *
 * Body: { planId: "starter" | "professional" | "enterprise", period: "monthly" | "yearly" }
 * Returns: { url: string } — redirect URL for Stripe checkout
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';
import { prisma } from '@crm-next/database';
import { getPlan, type PlanId } from '@/lib/billing/plans';
import { createCheckoutSession } from '@/lib/billing/stripe';

const checkoutSchema = z.object({
  planId: z.enum(['starter', 'professional', 'enterprise']),
  period: z.enum(['monthly', 'yearly']).default('monthly'),
});

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { planId, period } = parsed.data;
    const plan = getPlan(planId);

    if (!plan) {
      return NextResponse.json({ error: 'Невідомий план' }, { status: 400 });
    }

    // Get tenant info for Stripe
    const tenant = await prisma.tenant.findUnique({
      where: { id: tq.tenantId },
      select: { name: true, slug: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Тенант не знайдено' }, { status: 404 });
    }

    // Get user email from JWT
    const userPayload = (tq as Record<string, unknown>).userId;
    const user = userPayload
      ? await prisma.user.findUnique({ where: { id: userPayload as string }, select: { email: true } })
      : null;

    const priceId = period === 'yearly'
      ? plan.stripeYearlyPriceId || plan.stripePriceId
      : plan.stripePriceId;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Оплата не налаштована. Зверніться до адміністратора.' },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${appUrl}/uk/dashboard/settings/billing?success=true`;
    const cancelUrl = `${appUrl}/uk/dashboard/settings/billing?canceled=true`;

    const session = await createCheckoutSession({
      tenantId: tq.tenantId,
      tenantName: tenant.name,
      tenantEmail: user?.email || `${tenant.slug}@crm-next.com`,
      priceId,
      planId,
      trialDays: plan.trialDays,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Помилка створення сесії оплати' },
      { status: 500 }
    );
  }
}

export const POST = withAuth({ permission: 'tenant:billing' })(POSTHandler);
