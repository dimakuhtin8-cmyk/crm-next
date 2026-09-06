import crypto from 'crypto';

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { WhatsAppWebhookBody } from '@/lib/whatsapp/client';
import type { NextRequest} from 'next/server';

import { handleWhatsAppWebhook } from '@/lib/whatsapp/handler';

/**
 * GET /api/whatsapp/webhook — Webhook verification (360dialog/Facebook)
 * Query params: hub.mode, hub.verify_token, hub.challenge
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (!mode || !token || !challenge) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Find tenant by verify token
  const tenant = await prisma.tenant.findFirst({
    where: { whatsappWebhookSecret: token },
  });

  if (!tenant) {
    return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
  }

  // Verify: mode must be 'subscribe' and token must match
  if (mode === 'subscribe' && token === tenant.whatsappWebhookSecret) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * Verify Meta signature header `x-hub-signature-256: sha256=<hex hmac>`.
 * Uses the tenant's stored webhook secret as the HMAC key (same secret the
 * tenant pastes into Meta's webhook settings).
 */
function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const [algo, hash] = signatureHeader.split('=');
  if (algo !== 'sha256' || !hash) return false;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
    actual = Buffer.from(hash, 'hex');
  } catch {
    return false;
  }
  // timingSafeEqual throws on length mismatch — compare lengths first
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

/**
 * POST /api/whatsapp/webhook — Handle incoming WhatsApp messages
 *
 * Fail closed: requests without a valid signature are rejected with 403
 * and never reach the message handler (previously ANY body got 200 and
 * was processed, allowing forged inbound messages).
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 403 });
    }

    const tenants = await prisma.tenant.findMany({
      where: { whatsappWebhookSecret: { not: null } },
      select: { whatsappWebhookSecret: true },
    });

    const verified = tenants.some(
      (t) => t.whatsappWebhookSecret && verifySignature(rawBody, signature, t.whatsappWebhookSecret)
    );

    if (!verified) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    let body: WhatsAppWebhookBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Process asynchronously to respond quickly to WhatsApp
    handleWhatsAppWebhook(body).catch((error) => {
      console.error('WhatsApp webhook processing error:', error);
    });

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
