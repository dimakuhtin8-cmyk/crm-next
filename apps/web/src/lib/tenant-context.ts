/**
 * Tenant context for React and Server components
 */

import { prisma } from '@crm-next/database';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
  settings: string | null;
}

/**
 * Get current tenant from JWT token (server-side)
 */
export async function getCurrentTenant(): Promise<Tenant | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('authjs.session-token')?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const tenantId = payload.tenantId as string | undefined;
    if (!tenantId) return null;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    return tenant;
  } catch {
    return null;
  }
}

/**
 * Get current tenant by slug
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
    });
    return tenant;
  } catch {
    return null;
  }
}

/**
 * Check if user is member of tenant
 */
export async function isTenantMember(
  userId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const membership = await prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: { userId, tenantId },
      },
    });
    return !!membership;
  } catch {
    return false;
  }
}

/**
 * Get user's tenants
 */
export async function getUserTenants(userId: string): Promise<Tenant[]> {
  try {
    const memberships = await prisma.tenantMember.findMany({
      where: { userId },
      include: { tenant: true },
    });
    return memberships.map((m) => m.tenant);
  } catch {
    return [];
  }
}

/**
 * Create a new tenant
 */
export async function createTenant(data: {
  name: string;
  slug: string;
  domain?: string;
  ownerId: string;
}): Promise<Tenant> {
  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      members: {
        create: {
          userId: data.ownerId,
          role: 'owner',
        },
      },
    },
  });

  return tenant;
}
