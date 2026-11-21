/**
 * Telegram Webhook Receiver
 *
 * POST /api/webhooks/telegram
 *
 * Принимает обновления от Telegram Bot API
 */

import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/lib/errors';
import { handleInboundWebhook } from '@/lib/webhooks';

export const POST = withErrorHandling(async (request: Request) => {
  const result = await handleInboundWebhook('telegram', request);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
});
