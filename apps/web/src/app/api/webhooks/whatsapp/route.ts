/**
 * WhatsApp Webhook Receiver
 * 
 * POST /api/webhooks/whatsapp
 * GET /api/webhooks/whatsapp (verification)
 * 
 * Принимает обновления от WhatsApp Business API
 */

import { NextResponse } from 'next/server';
import { handleInboundWebhook } from '@/lib/webhooks';
import { withErrorHandling } from '@/lib/errors';

export const POST = withErrorHandling(async (request: Request) => {
  const result = await handleInboundWebhook('whatsapp', request);
  
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }
  
  return NextResponse.json({ ok: true });
});

// Верификация webhook URL
export const GET = withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
});
