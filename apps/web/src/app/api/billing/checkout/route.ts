/**
 * POST /api/billing/checkout — Create Stripe checkout session
 *
 * Body: { planId: "starter" | "professional" | "enterprise", period: "monthly" | "yearly" }
 * Returns: { url: string } — redirect URL for Stripe checkout
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { getPlan } from '@/lib/billing/plans';
import { createCheckoutSession } from '@/lib/billing/stripe';
import { csrfProtection } from '@/lib/csrf';
import { localeUrl } from '@/lib/locale-path';
import { getTenantQuery } from '@/lib/tenant-query';

const checkoutSchema = z.object({
  planId: z.enum(['starter', 'professional', 'enterprise']),
  period: z.enum(['monthly', 'yearly']).default('monthly'),
  locale: z.string().optional(),
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
        { status: 400 },
      );
    }

    const { planId, period } = parsed.data;
    const locale = parsed.data.locale;
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
      ? await prisma.user.findUnique({
          where: { id: userPayload as string },
          select: { email: true },
        })
      : null;

    const priceId =
      period === 'yearly' ? plan.stripeYearlyPriceId || plan.stripePriceId : plan.stripePriceId;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Оплата не налаштована. Зверніться до адміністратора.' },
        { status: 503 },
      );
    }

    const successUrl = localeUrl('/dashboard/settings/billing?success=true', locale);
    const cancelUrl = localeUrl('/dashboard/settings/billing?canceled=true', locale);

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
    return NextResponse.json({ error: 'Помилка створення сесії оплати' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'tenant:billing' })(POSTHandler);
