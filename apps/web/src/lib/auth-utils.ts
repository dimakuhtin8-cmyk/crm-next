/**
 * Authentication utilities
 */

import { jwtVerify } from 'jose';
import { getToken } from 'next-auth/jwt';

import type { NextRequest } from 'next/server';

/** Minimal cookie access — works for NextRequest and plain Request wrappers. */
interface CookieCarrier {
  cookies: {
    get(name: string): { value: string } | undefined;
  };
}

/**
 * Read the session JWT from cookies.
 * NextAuth v5 uses `__Secure-authjs.session-token` on HTTPS deployments
 * and plain `authjs.session-token` on http://localhost — accept both,
 * otherwise production sessions are invisible to the app.
 */
export function getSessionToken(request: CookieCarrier): string | null {
  return (
    request.cookies.get('authjs.session-token')?.value ??
    request.cookies.get('__Secure-authjs.session-token')?.value ??
    null
  );
}

interface SessionPayload {
  id?: string;
  tenantId?: string;
  tenantSlug?: string;
}

/**
 * Verify a session and return its payload.
 *
 * Two token flavors exist:
 * 1. NextAuth-issued cookies are JWE (encrypted) — verified via getToken(),
 *    which also handles the __Secure- cookie name automatically.
 * 2. Custom app JWTs (e.g. Telegram callback) are plain HS256 JWS —
 *    verified via jwtVerify as a fallback.
 */
async function verifySession(request: CookieCarrier): Promise<SessionPayload | null> {
  // 1. NextAuth session (JWE)
  try {
    const decoded = await getToken({
      req: request as unknown as Parameters<typeof getToken>[0]['req'],
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (decoded) {
      const t = decoded as unknown as Record<string, unknown>;
      const id = (t.id as string) || (decoded.sub as string);
      if (id) {
        return {
          id,
          tenantId: t.tenantId as string | undefined,
          tenantSlug: t.tenantSlug as string | undefined,
        };
      }
    }
  } catch {
    // fall through to JWS check
  }

  // 2. Custom HS256 JWT fallback
  const raw = getSessionToken(request);
  if (!raw) return null;
  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(raw, secret);
    return {
      id: payload.id as string,
      tenantId: payload.tenantId as string | undefined,
      tenantSlug: payload.tenantSlug as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Extract user ID from session token
 */
export async function extractUserId(request: CookieCarrier): Promise<string | null> {
  const session = await verifySession(request);
  return session?.id || null;
}

/**
 * Extract full user from session token
 */
export async function extractUser(request: CookieCarrier): Promise<{
  id: string;
  tenantId?: string;
  tenantSlug?: string;
} | null> {
  const session = await verifySession(request);
  if (!session?.id) return null;
  return {
    id: session.id,
    tenantId: session.tenantId,
    tenantSlug: session.tenantSlug,
  };
}
