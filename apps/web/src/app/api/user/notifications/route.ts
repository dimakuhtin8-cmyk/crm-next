/**
 * GET/PUT /api/user/notifications — загальні прапорці сповіщень
 * (email, telegram, нагадування, оновлення угод).
 *
 * Зберігаються в Tenant.settings (JSON, ключ `notif`) за тим самим
 * прецедентом, що й toast-преференси: колонок у User немає, зміна схеми
 * БД для цього не потрібна. Персистяться на рівні тенанта.
 */

import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest } from 'next/server';

import { getTenantQuery } from '@/lib/tenant-query';

interface NotifFlags {
  emailNotifications: boolean;
  telegramNotifications: boolean;
  taskReminders: boolean;
  dealUpdates: boolean;
}

export const DEFAULT_NOTIF_FLAGS: NotifFlags = {
  emailNotifications: true,
  telegramNotifications: false,
  taskReminders: true,
  dealUpdates: true,
};

function readFlags(raw: string | null): NotifFlags {
  if (!raw) return { ...DEFAULT_NOTIF_FLAGS };
  try {
    const parsed = JSON.parse(raw) as { notif?: Partial<NotifFlags> };
    return { ...DEFAULT_NOTIF_FLAGS, ...(parsed.notif || {}) };
  } catch {
    return { ...DEFAULT_NOTIF_FLAGS };
  }
}

const flagsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  telegramNotifications: z.boolean().optional(),
  taskReminders: z.boolean().optional(),
  dealUpdates: z.boolean().optional(),
});

async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    return NextResponse.json(readFlags(tenant?.settings || null));
  } catch (error) {
    console.error('Get notification flags error:', error);
    return NextResponse.json({ error: 'Помилка отримання налаштувань' }, { status: 500 });
  }
}

async function PUTHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    const body = await request.json().catch(() => ({}));
    const parsed = flagsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Невірні дані' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const next: NotifFlags = { ...readFlags(tenant?.settings || null), ...parsed.data };

    let settings: Record<string, unknown> = {};
    try {
      settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    } catch {
      // битий JSON у settings — перезаписуємо порожнім об'єктом
    }
    settings.notif = next;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: JSON.stringify(settings) },
    });

    return NextResponse.json(next);
  } catch (error) {
    console.error('Update notification flags error:', error);
    return NextResponse.json({ error: 'Помилка збереження налаштувань' }, { status: 500 });
  }
}

export const GET = GETHandler;
export const PUT = PUTHandler;
