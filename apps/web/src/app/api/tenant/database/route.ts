/**
 * Tenant Database Management API
 *
 * GET  /api/tenant/database  — Get current DB config
 * PUT  /api/tenant/database  — Update DB config (connect/disconnect external DB)
 * POST /api/tenant/database  — Test connection to external DB
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@crm-next/database';
import { testDatabaseConnection, detectProvider, type DatabaseType } from '@crm-next/database/tenant-db';
import { extractUser } from '@/lib/auth-utils';
import { getUserRole } from '@/lib/rbac';
import { encrypt } from '@/lib/encryption';

/** Schemes allowed per database type — blocks file://, http:// and other SSRF vectors. */
const ALLOWED_SCHEMES: Record<string, string[]> = {
  postgresql: ['postgresql:', 'postgres:'],
  mysql: ['mysql:', 'mariadb:'],
  mariadb: ['mysql:', 'mariadb:'],
  sqlserver: ['sqlserver:', 'mssql:'],
};

function validateDatabaseUrl(databaseUrl: string, databaseType: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return 'Invalid database URL';
  }
  const allowed = ALLOWED_SCHEMES[databaseType];
  if (!allowed || !allowed.includes(parsed.protocol)) {
    return `URL scheme must be one of ${allowed?.join(', ') || '(none)'} for type ${databaseType}`;
  }
  if (!parsed.hostname) {
    return 'URL must contain a hostname';
  }
  return null;
}

async function getTenantFromRequest(request: NextRequest): Promise<{ tenantId: string } | { status: 401 | 403 }> {
  const user = await extractUser(request);
  if (!user?.id) return { status: 401 };

  const tenantId = user.tenantId;
  if (!tenantId) return { status: 401 };

  const role = await getUserRole(user.id, tenantId);
  // Explicit allowlist: only owner/admin may manage external DB.
  // (Previous check `!role || role === 'member'` wrongly let viewers through.)
  if (role !== 'owner' && role !== 'admin') return { status: 403 };

  return { tenantId };
}

function authError(status: 401 | 403) {
  return NextResponse.json(
    { error: status === 401 ? 'Unauthorized' : 'Недостатньо прав' },
    { status }
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getTenantFromRequest(request);
    if (!('tenantId' in auth)) {
      return authError(auth.status);
    }
    const tenantId = auth.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        databaseUrl: true,
        databaseType: true,
        databaseStatus: true,
        databaseLastError: true,
        databaseConnectedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        type: tenant?.databaseType || 'shared',
        status: tenant?.databaseStatus || 'active',
        lastError: tenant?.databaseLastError,
        connectedAt: tenant?.databaseConnectedAt,
        hasExternalDb: !!tenant?.databaseUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getTenantFromRequest(request);
    if (!('tenantId' in auth)) {
      return authError(auth.status);
    }
    const tenantId = auth.tenantId;

    const body = await request.json();
    const { databaseUrl, databaseType } = body;

    // Validate
    if (databaseType && !['shared', 'postgresql', 'mysql', 'mariadb', 'sqlserver'].includes(databaseType)) {
      return NextResponse.json({ error: 'Invalid database type' }, { status: 400 });
    }

    if (databaseUrl && !databaseType) {
      return NextResponse.json({ error: 'Database type is required' }, { status: 400 });
    }

    // Strict URL validation BEFORE any connection attempt (SSRF guard)
    if (databaseUrl && databaseType && databaseType !== 'shared') {
      const urlError = validateDatabaseUrl(databaseUrl, databaseType);
      if (urlError) {
        return NextResponse.json({ error: urlError }, { status: 400 });
      }
    }

    // Test connection if URL provided
    let status = 'active';
    let lastError = null;

    if (databaseUrl && databaseType && databaseType !== 'shared') {
      const testResult = await testDatabaseConnection(databaseUrl, databaseType as DatabaseType);
      if (!testResult.success) {
        status = 'error';
        lastError = testResult.error;
      }
    }

    // Update tenant — connection string is encrypted at rest, like AI keys
    const updateData: Record<string, unknown> = {
      databaseType: databaseType || 'shared',
      databaseStatus: status,
      databaseLastError: lastError,
    };

    if (databaseUrl !== undefined) {
      updateData.databaseUrl = databaseUrl ? encrypt(databaseUrl) : null;
    }

    if (status === 'active') {
      updateData.databaseConnectedAt = new Date();
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        type: databaseType || 'shared',
        status,
        lastError,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getTenantFromRequest(request);
    if (!('tenantId' in auth)) {
      return authError(auth.status);
    }

    const body = await request.json();
    const { databaseUrl, databaseType } = body;

    if (!databaseUrl || !databaseType) {
      return NextResponse.json({ error: 'URL and type are required' }, { status: 400 });
    }

    // Strict URL validation BEFORE any connection attempt (SSRF guard)
    const urlError = validateDatabaseUrl(databaseUrl, databaseType);
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 });
    }

    const result = await testDatabaseConnection(databaseUrl, databaseType as DatabaseType);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
