/**
 * Authentication utilities
 */

import { jwtVerify } from 'jose';

import type { NextRequest } from 'next/server';

/**
 * Read the session JWT from cookies.
 * NextAuth v5 uses `__Secure-authjs.session-token` on HTTPS deployments
 * and plain `authjs.session-token` on http://localhost — accept both,
 * otherwise production sessions are invisible to the app.
 */
export function getSessionToken(request: NextRequest): string | null {
  return (
    request.cookies.get('authjs.session-token')?.value ??
    request.cookies.get('__Secure-authjs.session-token')?.value ??
    null
  );
}

/**
 * Extract user ID from session token
 */
export async function extractUserId(request: NextRequest): Promise<string | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.id as string) || null;
  } catch {
    return null;
  }
}

/**
 * Extract full user from session token
 */
export async function extractUser(request: NextRequest): Promise<{
  id: string;
  tenantId?: string;
  tenantSlug?: string;
} | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      tenantId: payload.tenantId as string | undefined,
      tenantSlug: payload.tenantSlug as string | undefined,
    };
  } catch {
    return null;
  }
}
