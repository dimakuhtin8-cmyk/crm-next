/**
 * POST /api/billing/portal — Create Stripe billing portal session
 *
 * Returns: { url: string } — redirect URL for Stripe portal
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';
import { withAuth } from '@/lib/auth-guard';
import { createPortalSession } from '@/lib/billing/stripe';

async function POSTHandler(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${appUrl}/uk/dashboard/settings/billing`;

    const session = await createPortalSession(tq.tenantId, returnUrl);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json(
      { error: 'Помилка відкриття порталу оплати' },
      { status: 500 }
    );
  }
}

export const POST = withAuth({ permission: 'tenant:billing' })(POSTHandler);
