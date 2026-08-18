import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getBotInfo, setWebhook, deleteWebhook } from '@/lib/telegram/bot';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/telegram/config — Get bot config for current tenant
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    // Get tenant with telegram fields
    const { prisma: p } = await import('@crm-next/database');
    const tenant = await p.tenant.findUnique({
      where: { id: (tq as unknown as { tenantId: string }).tenantId },
      select: {
        id: true,
        telegramBotToken: true,
        telegramWebhookSecret: true,
        telegramBotUsername: true,
      },
    });

    return NextResponse.json({
      configured: !!tenant?.telegramBotToken,
      botUsername: tenant?.telegramBotUsername || null,
      webhookSet: !!tenant?.telegramWebhookSecret,
    });
  } catch (error) {
    console.error('Get telegram config error:', error);
    return NextResponse.json({ error: 'Помилка отримання конфігурації' }, { status: 500 });
  }
}

/**
 * POST /api/telegram/config — Setup or update bot
 * Body: { botToken: string }
 */
const configSchema = z.object({
  botToken: z.string().min(40).max(100),
});

export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const body = await request.json();
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Невірний формат токена' }, { status: 400 });
    }

    // Verify bot token with Telegram API
    const botInfo = await getBotInfo(parsed.data.botToken);
    if (!botInfo.ok) {
      return NextResponse.json({ error: 'Невірний токен бота' }, { status: 400 });
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomUUID().replace(/-/g, '');

    // Save to tenant
    const { prisma: p } = await import('@crm-next/database');
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    await p.tenant.update({
      where: { id: tenantId },
      data: {
        telegramBotToken: parsed.data.botToken,
        telegramWebhookSecret: webhookSecret,
        telegramBotUsername: botInfo.result.username,
      },
    });

    // Set webhook
    const webhookUrl = `${request.nextUrl.origin}/api/telegram/webhook?token=${webhookSecret}`;
    const webhookResult = await setWebhook(parsed.data.botToken, webhookUrl, webhookSecret);

    if (!webhookResult.ok) {
      console.error('Failed to set webhook:', webhookResult);
    }

    return NextResponse.json({
      success: true,
      botUsername: botInfo.result.username,
      webhookSet: webhookResult.ok,
    });
  } catch (error) {
    console.error('Setup telegram bot error:', error);
    return NextResponse.json({ error: 'Помилка налаштування бота' }, { status: 500 });
  }
}

/**
 * DELETE /api/telegram/config — Remove bot from tenant
 */
export async function DELETE(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { prisma: p } = await import('@crm-next/database');
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const tenant = await p.tenant.findUnique({
      where: { id: tenantId },
      select: { telegramBotToken: true },
    });

    if (tenant?.telegramBotToken) {
      await deleteWebhook(tenant.telegramBotToken);
    }

    await p.tenant.update({
      where: { id: tenantId },
      data: {
        telegramBotToken: null,
        telegramWebhookSecret: null,
        telegramBotUsername: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete telegram config error:', error);
    return NextResponse.json({ error: 'Помилка видалення конфігурації' }, { status: 500 });
  }
}
