/**
 * GET /api/billing/subscription — Get current subscription status
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { getPlan, parsePlanLimits, type PlanId } from '@/lib/billing/plans';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

async function GETHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tq.tenantId },
      select: {
        plan: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        trialEndsAt: true,
        planLimits: true,
        stripeCustomerId: true,
        subscriptionId: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Тенант не знайдено' }, { status: 404 });
    }

    const plan = getPlan((tenant.plan as PlanId) || 'free');

    // Calculate trial status first — limits depend on it.
    // Trial активен, только пока дата в будущем (протухший trialing-статус
    // без крона сам не перевернётся — дата решает).
    const now = new Date();
    const hasFutureTrial = !!tenant.trialEndsAt && tenant.trialEndsAt > now;
    const isTrial =
      tenant.subscriptionStatus === 'trialing'
        ? !tenant.trialEndsAt || hasFutureTrial
        : hasFutureTrial;
    const trialDaysLeft = tenant.trialEndsAt
      ? Math.max(
          0,
          Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        )
      : 0;

    // Effective limits: professional while trial is active, own plan limits after.
    // Кастомные planLimits (платный договор) уважаются всегда.
    // Данные на чтение не блокируются никогда — только лимиты создания.
    const limits = tenant.planLimits
      ? parsePlanLimits(tenant.planLimits)
      : isTrial
        ? getPlan('professional').limits
        : plan.limits;

    // Get current usage
    const [userCount, contactCount, dealCount] = await Promise.all([
      prisma.tenantMember.count({ where: { tenantId: tq.tenantId } }),
      prisma.contact.count({ where: { tenantId: tq.tenantId } }),
      prisma.deal.count({ where: { tenantId: tq.tenantId } }),
    ]);

    return NextResponse.json({
      plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
      },
      subscription: {
        status: tenant.subscriptionStatus || 'active',
        endsAt: tenant.subscriptionEndsAt,
        isTrial,
        trialDaysLeft,
        trialEndsAt: tenant.trialEndsAt,
      },
      limits,
      usage: {
        users: userCount,
        contacts: contactCount,
        deals: dealCount,
      },
      hasPaymentMethod: !!tenant.stripeCustomerId,
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ error: 'Помилка отримання статусу підписки' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
