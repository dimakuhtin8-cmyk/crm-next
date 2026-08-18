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
 * POST /api/whatsapp/webhook — Handle incoming WhatsApp messages
 */
export async function POST(request: NextRequest) {
  try {
    const body: WhatsAppWebhookBody = await request.json();

    // Process asynchronously to respond quickly to WhatsApp
    handleWhatsAppWebhook(body).catch((error) => {
      console.error('WhatsApp webhook processing error:', error);
    });

    // Always respond 200 to WhatsApp
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ status: 'ok' });
  }
}
