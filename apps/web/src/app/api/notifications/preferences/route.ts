/**
 * GET/PATCH /api/notifications/preferences — настройки тостов.
 *
 * Хранятся в Tenant.settings (JSON): { toast: { enabled, position } }.
 * Чтение — любой участник тенанта, запись — settings:update (owner/admin).
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getTenantQuery } from '@/lib/tenant-query';
import { prisma } from '@crm-next/database';
import { withAuth } from '@/lib/auth-guard';

export interface ToastPrefs {
  enabled: boolean;
  position: 'bottom-left' | 'bottom-right' | 'top-right';
}

export const DEFAULT_TOAST_PREFS: ToastPrefs = {
  enabled: true,
  position: 'bottom-left',
};

function readPrefs(raw: string | null): ToastPrefs {
  if (!raw) return { ...DEFAULT_TOAST_PREFS };
  try {
    const parsed = JSON.parse(raw) as { toast?: Partial<ToastPrefs> };
    const position = parsed.toast?.position;
    return {
      enabled: parsed.toast?.enabled !== false,
      position: position === 'bottom-right' || position === 'top-right' || position === 'bottom-left'
        ? position
        : 'bottom-left',
    };
  } catch {
    return { ...DEFAULT_TOAST_PREFS };
  }
}

const prefsSchema = z.object({
  enabled: z.boolean().optional(),
  position: z.enum(['bottom-left', 'bottom-right', 'top-right']).optional(),
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

    return NextResponse.json({ toast: readPrefs(tenant?.settings || null) });
  } catch (error) {
    console.error('Get notification prefs error:', error);
    return NextResponse.json({ error: 'Помилка отримання налаштувань' }, { status: 500 });
  }
}

async function PATCHHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    const tenantId = (tq as unknown as { tenantId: string }).tenantId;

    const body = await request.json().catch(() => ({}));
    const parsed = prefsSchema.safeParse(body.toast || body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Невірні дані' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const current = readPrefs(tenant?.settings || null);
    const next = { ...current, ...parsed.data };

    let settings: Record<string, unknown> = {};
    try {
      settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    } catch {}
    settings.toast = next;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: JSON.stringify(settings) },
    });

    return NextResponse.json({ toast: next });
  } catch (error) {
    console.error('Update notification prefs error:', error);
    return NextResponse.json({ error: 'Помилка збереження налаштувань' }, { status: 500 });
  }
}

export const GET = withAuth()(GETHandler);
export const PATCH = withAuth({ permission: 'settings:update' })(PATCHHandler);
