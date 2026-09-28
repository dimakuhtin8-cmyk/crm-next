/**
 * POST /api/billing/portal — Create Stripe billing portal session
 *
 * Returns: { url: string } — redirect URL for Stripe portal
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth-guard';
import { createPortalSession } from '@/lib/billing/stripe';
import { csrfProtection } from '@/lib/csrf';
import { localeUrl } from '@/lib/locale-path';
import { getTenantQuery } from '@/lib/tenant-query';

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const locale = typeof body?.locale === 'string' ? body.locale : undefined;
    const returnUrl = localeUrl('/dashboard/settings/billing', locale);

    const session = await createPortalSession(tq.tenantId, returnUrl);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'Помилка відкриття порталу оплати' }, { status: 500 });
  }
}

export const POST = withAuth({ permission: 'tenant:billing' })(POSTHandler);
