/**
 * Stripe Integration — client setup and helpers
 *
 * Handles:
 * - Stripe client initialization
 * - Customer creation/management
 * - Checkout session creation
 * - Subscription management
 * - Invoice retrieval
 * - Webhook event verification
 */

import Stripe from 'stripe';
import { prisma } from '@crm-next/database';
import log from '@/lib/logging/logger';

// Lazy-initialized Stripe client (exported for webhook event retrieval)
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY не налаштовано');
    }
    _stripe = new Stripe(key, {
      apiVersion: '2025-08-27.basil' as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

/**
 * Get or create Stripe customer for a tenant
 */
export async function getOrCreateCustomer(
  tenantId: string,
  tenantName: string,
  tenantEmail: string
): Promise<Stripe.Customer> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });

  if (tenant?.stripeCustomerId) {
    try {
      const customer = await getStripe().customers.retrieve(tenant.stripeCustomerId);
      if (customer.deleted) {
        // Customer was deleted, create a new one
        return createCustomer(tenantId, tenantName, tenantEmail);
      }
      return customer as Stripe.Customer;
    } catch {
      // Customer not found in Stripe, create new
      return createCustomer(tenantId, tenantName, tenantEmail);
    }
  }

  return createCustomer(tenantId, tenantName, tenantEmail);
}

async function createCustomer(
  tenantId: string,
  name: string,
  email: string
): Promise<Stripe.Customer> {
  const customer = await getStripe().customers.create({
    name,
    email,
    metadata: { tenantId },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeCustomerId: customer.id },
  });

  log.info({ tenantId, stripeCustomerId: customer.id }, 'Stripe customer created');
  return customer;
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(params: {
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  priceId: string;
  planId: string;
  trialDays?: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const customer = await getOrCreateCustomer(
    params.tenantId,
    params.tenantName,
    params.tenantEmail
  );

  const session = await getStripe().checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: params.trialDays || undefined,
      metadata: {
        tenantId: params.tenantId,
        planId: params.planId,
      },
    },
    metadata: {
      tenantId: params.tenantId,
      planId: params.planId,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  log.info({ tenantId: params.tenantId, sessionId: session.id, planId: params.planId }, 'Checkout session created');
  return session;
}

/**
 * Create a billing portal session
 */
export async function createPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });

  if (!tenant?.stripeCustomerId) {
    throw new Error('Stripe customer not found');
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  });

  log.info({ tenantId, sessionId: session.id }, 'Portal session created');
  return session;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  tenantId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionId: true },
  });

  if (!tenant?.subscriptionId) {
    throw new Error('No active subscription');
  }

  // NOTE (stripe v22): subscriptions.cancel() does NOT accept
  // cancel_at_period_end — end-of-period cancel goes via update().
  if (!immediately) {
    const subscription = await getStripe().subscriptions.update(
      tenant.subscriptionId,
      { cancel_at_period_end: true }
    );

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'canceled' },
    });

    log.info({ tenantId, subscriptionId: tenant.subscriptionId, immediately }, 'Subscription scheduled for cancelation');
    return subscription;
  }

  const subscription = await getStripe().subscriptions.cancel(
    tenant.subscriptionId
  );

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      subscriptionStatus: 'canceled',
      ...(immediately ? { subscriptionEndsAt: new Date() } : {}),
    },
  });

  log.info({ tenantId, subscriptionId: tenant.subscriptionId, immediately }, 'Subscription canceled');
  return subscription;
}

/**
 * Retrieve subscription details
 */
export async function getSubscription(
  tenantId: string
): Promise<Stripe.Subscription | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionId: true },
  });

  if (!tenant?.subscriptionId) return null;

  try {
    const subscription = await getStripe().subscriptions.retrieve(
      tenant.subscriptionId,
      { expand: ['latest_invoice', 'default_payment_method'] }
    );
    return subscription;
  } catch {
    return null;
  }
}

/**
 * Get payment history for a tenant
 */
export async function getPaymentHistory(
  tenantId: string,
  limit: number = 20
): Promise<Stripe.PaymentIntent[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });

  if (!tenant?.stripeCustomerId) return [];

  const intents = await getStripe().paymentIntents.list({
    customer: tenant.stripeCustomerId,
    limit,
  });

  return intents.data;
}

/**
 * Get upcoming invoice (next billing)
 *
 * NOTE (stripe v22): invoices.retrieveUpcoming() was removed — replaced by
 * invoices.createPreview(), which returns a regular Invoice.
 */
export async function getUpcomingInvoice(
  tenantId: string
): Promise<Stripe.Invoice | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true, subscriptionId: true },
  });

  if (!tenant?.stripeCustomerId || !tenant?.subscriptionId) return null;

  try {
    const invoice = await getStripe().invoices.createPreview({
      customer: tenant.stripeCustomerId,
      subscription: tenant.subscriptionId,
    });
    return invoice;
  } catch {
    return null;
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhook(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET не налаштовано');
  }

  return getStripe().webhooks.constructEvent(payload, signature, secret);
}
