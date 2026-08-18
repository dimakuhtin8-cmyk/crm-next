import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { handleTelegramUpdate } from '@/lib/telegram/handler';

/**
 * POST /api/telegram/webhook?token=XXX
 * Telegram sends updates here. We verify the secret token
 * and route to the correct tenant.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('token');

  if (!secret) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  // Find tenant by webhook secret
  const tenant = await prisma.tenant.findFirst({
    where: { telegramWebhookSecret: secret },
  });

  if (!tenant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Verify X-Telegram-Bot-Api-Secret-Token header
  const telegramSecret = request.headers.get('x-telegram-bot-api-secret-token');
  if (telegramSecret !== tenant.telegramWebhookSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Handle the update
    await handleTelegramUpdate(tenant.id, body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Telegram sends GET requests to verify webhook
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
