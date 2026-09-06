/**
 * POST /api/billing/webhook — Stripe webhook handler
 *
 * Handles:
 * - checkout.session.completed → activate subscription
 * - invoice.paid → record payment
 * - invoice.payment_failed → update status
 * - customer.subscription.updated → sync status
 * - customer.subscription.deleted → cancel subscription
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';
import { verifyWebhook } from '@/lib/billing/stripe';
import log from '@/lib/logging/logger';
import type Stripe from 'stripe';

/**
 * Period end of a subscription (stripe v22 removed Subscription.current_period_end;
 * the period now lives on subscription items, with billing_cycle_anchor as fallback).
 */
function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ts =
    sub.items?.data?.[0]?.current_period_end ??
    (typeof sub.billing_cycle_anchor === 'number' ? sub.billing_cycle_anchor : null);
  return ts ? new Date(ts * 1000) : null;
}

/**
 * Subscription reference of an invoice (stripe v22 keeps it under
 * parent.subscription_details — there is no top-level `subscription`).
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === 'string' ? sub : sub.id;
}

/**
 * First payment attempt of an invoice (stripe v22 keeps payments under
 * invoice.payments — there is no top-level `payment_intent`).
 */
function invoiceFirstPayment(invoice: Stripe.Invoice): { amount: number | null; paymentIntentId: string | null } {
  const p = invoice.payments?.data?.[0];
  if (!p) return { amount: null, paymentIntentId: null };
  const pi: unknown = p.payment?.payment_intent;
  return {
    amount: typeof p.amount_paid === 'number' ? p.amount_paid : null,
    paymentIntentId:
      typeof pi === 'string' ? pi
      : pi && typeof pi === 'object' && 'id' in pi
        ? String((pi as { id: unknown }).id)
        : null,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = verifyWebhook(body, signature);
  } catch (err) {
    log.error({ err }, 'Stripe webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    // Idempotency with status tracking:
    // - Create record with status='pending' to claim the event
    // - If P2002 → check existing status: 'completed' = skip, 'pending'/'failed' = reprocess
    // - After processing → update status to 'completed'
    // - On error → update status to 'failed' (allows retry on next delivery)
    let existingEvent: { status: string } | null = null;
    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          status: 'pending',
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        existingEvent = await prisma.stripeWebhookEvent.findUnique({
          where: { stripeEventId: event.id },
          select: { status: true },
        });
        if (existingEvent?.status === 'completed') {
          log.info({ eventId: event.id, type: event.type }, 'Stripe event already processed, skipping');
          return NextResponse.json({ received: true, idempotent: true });
        }
        // status is 'pending' or 'failed' → reprocess
        log.info({ eventId: event.id, type: event.type, prevStatus: existingEvent?.status }, 'Reprocessing incomplete Stripe event');
      } else {
        throw e;
      }
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const planId = session.metadata?.planId;

        if (tenantId && session.subscription) {
          const subscription = await (await import('@/lib/billing/stripe')).getStripe()
            .subscriptions.retrieve(session.subscription as string);

          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              plan: planId || 'starter',
              subscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
              subscriptionEndsAt: subscriptionPeriodEnd(subscription),
              trialEndsAt: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : null,
            },
          });

          log.info({ tenantId, planId, subscriptionId: subscription.id }, 'Subscription activated');
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = invoiceSubscriptionId(invoice);
        const tenantId = invoice.metadata?.tenantId || subscriptionRef;

        // Find tenant by subscription ID
        let resolvedTenantId = tenantId;
        if (!resolvedTenantId && subscriptionRef) {
          const tenant = await prisma.tenant.findFirst({
            where: { subscriptionId: subscriptionRef },
            select: { id: true },
          });
          resolvedTenantId = tenant?.id ?? null;
        }

        if (resolvedTenantId) {
          // Idempotency: Stripe may redeliver the same invoice — Payment
          // carries status, so an existing record means "already processed".
          const existing = await prisma.payment.findFirst({
            where: { tenantId: resolvedTenantId, stripeInvoiceId: invoice.id },
            select: { id: true, status: true },
          });

          if (existing?.status === 'succeeded') {
            log.info({ tenantId: resolvedTenantId, invoiceId: invoice.id }, 'Payment already recorded, skipping');
          } else {
            const firstPayment = invoiceFirstPayment(invoice);
            const paymentData = {
              stripePaymentId: firstPayment.paymentIntentId,
              amount: firstPayment.amount ?? invoice.amount_paid,
              currency: invoice.currency,
              status: 'succeeded',
              description: `Підписка — інвойс ${invoice.id}`,
              invoiceUrl: invoice.hosted_invoice_url ?? null,
            };
            if (existing) {
              await prisma.payment.update({ where: { id: existing.id }, data: paymentData });
              log.info({ tenantId: resolvedTenantId, invoiceId: invoice.id }, 'Payment updated to succeeded');
            } else {
              await prisma.payment.create({
                data: { tenantId: resolvedTenantId, stripeInvoiceId: invoice.id, ...paymentData },
              });
              log.info({ tenantId: resolvedTenantId, invoiceId: invoice.id }, 'Payment recorded');
            }
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = invoiceSubscriptionId(invoice);
        let failedTenantId: string | null = invoice.metadata?.tenantId || subscriptionRef;
        if ((!failedTenantId || failedTenantId === subscriptionRef) && subscriptionRef) {
          const tenant = await prisma.tenant.findFirst({
            where: { subscriptionId: subscriptionRef },
            select: { id: true },
          });
          if (tenant) failedTenantId = tenant.id;
        }
        const tenant = failedTenantId ? { id: failedTenantId } : null;

        if (tenant) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionStatus: 'past_due' },
          });

          const existing = await prisma.payment.findFirst({
            where: { tenantId: tenant.id, stripeInvoiceId: invoice.id },
            select: { id: true },
          });

          const firstPayment = invoiceFirstPayment(invoice);
          const paymentData = {
            stripePaymentId: firstPayment.paymentIntentId,
            amount: invoice.amount_due,
            currency: invoice.currency,
            status: 'failed',
            description: 'Неуспішна оплата',
          };

          if (existing) {
            await prisma.payment.update({ where: { id: existing.id }, data: paymentData });
          } else {
            await prisma.payment.create({
              data: { tenantId: tenant.id, stripeInvoiceId: invoice.id, ...paymentData },
            });
          }

          log.warn({ tenantId: tenant.id, invoiceId: invoice.id }, 'Payment failed');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenant = await prisma.tenant.findFirst({
          where: { subscriptionId: subscription.id },
          select: { id: true },
        });

        if (tenant) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: subscription.status,
              subscriptionEndsAt: subscriptionPeriodEnd(subscription),
              trialEndsAt: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : null,
            },
          });

          log.info({ tenantId: tenant.id, status: subscription.status }, 'Subscription updated');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenant = await prisma.tenant.findFirst({
          where: { subscriptionId: subscription.id },
          select: { id: true },
        });

        if (tenant) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              plan: 'free',
              subscriptionId: null,
              subscriptionStatus: 'canceled',
              subscriptionEndsAt: null,
            },
          });

          log.info({ tenantId: tenant.id }, 'Subscription canceled, downgraded to free');
        }
        break;
      }

      default:
        log.info({ type: event.type }, 'Unhandled Stripe event');
    }

    // Mark as completed
    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: { status: 'completed' },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    // Mark as failed (allows retry on next Stripe delivery)
    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: { status: 'failed' },
    }).catch(() => {}); // best-effort

    log.error({ err: error, eventType: event.type }, 'Stripe webhook processing error');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
