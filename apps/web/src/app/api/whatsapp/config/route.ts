import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * GET /api/whatsapp/config — Get WhatsApp config for current tenant
 */
export async function GET(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { prisma } = await import('@crm-next/database');
    const tenant = await prisma.tenant.findUnique({
      where: { id: (tq as unknown as { tenantId: string }).tenantId },
      select: {
        whatsappApiKey: true,
        whatsappAppId: true,
        whatsappPhoneNumberId: true,
        whatsappPhoneNumber: true,
        whatsappWabaId: true,
      },
    });

    return NextResponse.json({
      configured: !!tenant?.whatsappApiKey,
      phoneNumber: tenant?.whatsappPhoneNumber || null,
      phoneNumberId: tenant?.whatsappPhoneNumberId || null,
      wabaId: tenant?.whatsappWabaId || null,
    });
  } catch (error) {
    console.error('Get whatsapp config error:', error);
    return NextResponse.json({ error: 'Помилка отримання конфігурації' }, { status: 500 });
  }
}

/**
 * POST /api/whatsapp/config — Setup WhatsApp integration
 */
const configSchema = z.object({
  apiKey: z.string().min(1),
  appId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  phoneNumber: z.string().min(1),
  wabaId: z.string().min(1),
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
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomUUID().replace(/-/g, '');

    const { prisma } = await import('@crm-next/database');
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappApiKey: parsed.data.apiKey,
        whatsappAppId: parsed.data.appId,
        whatsappPhoneNumberId: parsed.data.phoneNumberId,
        whatsappPhoneNumber: parsed.data.phoneNumber,
        whatsappWabaId: parsed.data.wabaId,
        whatsappWebhookSecret: webhookSecret,
      },
    });

    return NextResponse.json({
      success: true,
      webhookUrl: `${request.nextUrl.origin}/api/whatsapp/webhook`,
      webhookSecret,
    });
  } catch (error) {
    console.error('Setup whatsapp error:', error);
    return NextResponse.json({ error: 'Помилка налаштування WhatsApp' }, { status: 500 });
  }
}

/**
 * DELETE /api/whatsapp/config — Remove WhatsApp integration
 */
export async function DELETE(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const { prisma } = await import('@crm-next/database');
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappApiKey: null,
        whatsappAppId: null,
        whatsappWebhookSecret: null,
        whatsappPhoneNumberId: null,
        whatsappPhoneNumber: null,
        whatsappWabaId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete whatsapp config error:', error);
    return NextResponse.json({ error: 'Помилка видалення конфігурації' }, { status: 500 });
  }
}
