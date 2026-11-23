/**
 * Керування exchange-токеном (обмін з 1С) — cookie-автентифікований роут (admin+).
 *
 * GET  /api/v1/exchange/token → { hasToken, masked } (маска ****abcd, без токена)
 * POST /api/v1/exchange/token { action: 'generate' | 'revoke' }
 *      → generate повертає токен ОДИН раз (для передачі в 1С), далі лише маска.
 *
 * Токен ніколи не логується і не потрапляє в audit log — лише маска.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logAuditEvent, extractRequestMeta } from '@/lib/audit';
import { withAuth } from '@/lib/auth-guard';
import { extractUserId } from '@/lib/auth-utils';
import { csrfProtection } from '@/lib/csrf';
import {
  generateExchangeToken,
  getExchangeToken,
  maskToken,
  revokeExchangeToken,
} from '@/lib/exchange-token';
import { getTenantQuery } from '@/lib/tenant-query';

import type { NextRequest } from 'next/server';

/**
 * GET /api/v1/exchange/token — статус ключа обміну
 */
async function GETHandler(request: NextRequest) {
  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const token = await getExchangeToken(tenantId);
    return NextResponse.json({
      hasToken: token !== null,
      masked: token ? maskToken(token) : null,
    });
  } catch (error) {
    console.error('Exchange token GET error:', error);
    return NextResponse.json({ error: 'Помилка отримання ключа обміну' }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(['generate', 'revoke']),
});

/**
 * POST /api/v1/exchange/token — згенерувати або відкликати ключ обміну
 */
async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Невірні дані', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const tenantId = (tq as unknown as { tenantId: string }).tenantId;
    const userId = (await extractUserId(request)) ?? undefined;
    const meta = extractRequestMeta(request);

    if (parsed.data.action === 'generate') {
      const token = await generateExchangeToken(tenantId);
      const masked = maskToken(token);

      await logAuditEvent({
        tenantId,
        userId,
        action: 'update',
        entity: 'settings',
        entityId: tenantId,
        newValues: { exchangeToken: 'generated', masked },
        ...meta,
      });

      // Токен повертається один раз — зберегти його має адміністратор
      return NextResponse.json({ hasToken: true, masked, token });
    }

    await revokeExchangeToken(tenantId);
    await logAuditEvent({
      tenantId,
      userId,
      action: 'update',
      entity: 'settings',
      entityId: tenantId,
      newValues: { exchangeToken: 'revoked' },
      ...meta,
    });

    return NextResponse.json({ hasToken: false, masked: null });
  } catch (error) {
    console.error('Exchange token POST error:', error);
    return NextResponse.json({ error: 'Помилка оновлення ключа обміну' }, { status: 500 });
  }
}

export const GET = withAuth({ minRole: 'admin' })(GETHandler);
export const POST = withAuth({ minRole: 'admin' })(POSTHandler);
