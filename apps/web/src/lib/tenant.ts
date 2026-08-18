/**
 * Tenant resolution middleware
 *
 * Supports 3 resolution strategies:
 * 1. Subdomain: tenant.crm-next.com → tenant
 * 2. Custom domain: crm.acme.com → tenant
 * 3. JWT token: cookie "authjs.session-token" → tenantId
 * 4. Header: X-Tenant-ID header (for API calls)
 */

import { prisma } from '@crm-next/database';
import { jwtVerify } from 'jose';

import type { NextRequest } from 'next/server';

export interface TenantContext {
  tenantId: string | null;
  tenantSlug: string | null;
  source: 'subdomain' | 'domain' | 'jwt' | 'header' | 'none';
}

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'localhost';
const TENANT_HEADER = 'x-tenant-id';

/**
 * Extract tenant from subdomain
 * e.g., "acme.localhost" → "acme"
 * e.g., "acme.crm-next.com" → "acme"
 */
function extractFromSubdomain(hostname: string): string | null {
  // Skip IPs (127.0.0.1, etc.)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

  // Skip localhost (no subdomain)
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    // For localhost:3000, treat as no subdomain
    const parts = hostname.split('.');
    if (parts.length <= 2) return null;
    return parts[0]; // subdomain.localhost
  }

  const parts = hostname.split('.');
  // e.g., acme.crm-next.com → ["acme", "crm-next", "com"]
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

/**
 * Extract tenant from custom domain
 * e.g., "crm.acme.com" → lookup tenant by domain
 */
async function extractFromDomain(hostname: string): Promise<string | null> {
  // Skip localhost and IPs
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { domain: hostname },
      select: { id: true },
    });
    return tenant?.id || null;
  } catch {
    return null;
  }
}

/**
 * Extract tenant from JWT token
 */
async function extractFromJWT(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('authjs.session-token')?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return (payload.tenantId as string) || null;
  } catch {
    return null;
  }
}

/**
 * Extract tenant from X-Tenant-ID header
 */
function extractFromHeader(request: NextRequest): string | null {
  return request.headers.get(TENANT_HEADER);
}

/**
 * Resolve tenant slug from tenant ID
 */
async function resolveSlug(tenantId: string): Promise<string | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    return tenant?.slug || null;
  } catch {
    return null;
  }
}

/**
 * Main tenant resolution function
 * Tries each strategy in order of priority
 */
export async function resolveTenant(request: NextRequest): Promise<TenantContext> {
  const { hostname } = request.nextUrl;

  // 1. Try subdomain
  const subdomain = extractFromSubdomain(hostname);
  if (subdomain) {
    // Verify subdomain corresponds to a real tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: subdomain },
      select: { id: true },
    });
    if (tenant) {
      return {
        tenantId: tenant.id,
        tenantSlug: subdomain,
        source: 'subdomain',
      };
    }
  }

  // 2. Try custom domain
  const domainTenantId = await extractFromDomain(hostname);
  if (domainTenantId) {
    const slug = await resolveSlug(domainTenantId);
    return {
      tenantId: domainTenantId,
      tenantSlug: slug,
      source: 'domain',
    };
  }

  // 3. Try header (for API calls)
  const headerTenantId = extractFromHeader(request);
  if (headerTenantId) {
    const slug = await resolveSlug(headerTenantId);
    return {
      tenantId: headerTenantId,
      tenantSlug: slug,
      source: 'header',
    };
  }

  // 4. Try JWT
  const jwtTenantId = await extractFromJWT(request);
  if (jwtTenantId) {
    const slug = await resolveSlug(jwtTenantId);
    return {
      tenantId: jwtTenantId,
      tenantSlug: slug,
      source: 'jwt',
    };
  }

  // No tenant resolved
  return {
    tenantId: null,
    tenantSlug: null,
    source: 'none',
  };
}
