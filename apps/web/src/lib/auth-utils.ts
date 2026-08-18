/**
 * Authentication utilities
 */

import { jwtVerify } from 'jose';

import type { NextRequest } from 'next/server';

/**
 * Extract user ID from session token
 */
export async function extractUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('authjs.session-token')?.value;
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
  const token = request.cookies.get('authjs.session-token')?.value;
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
