/**
 * Tenant Database Adapter
 *
 * Resolves the correct Prisma client for each tenant:
 * - "shared" → default Prisma client (all tenants in one DB)
 * - "postgresql" / "mysql" / "mariadb" / "sqlserver" → dedicated Prisma client per tenant
 */

import { PrismaClient } from '@prisma/client';

const globalForTenantDb = globalThis as unknown as {
  tenantDbCache: Map<string, PrismaClient> | undefined;
};

const tenantDbCache = globalForTenantDb.tenantDbCache ?? new Map<string, PrismaClient>();
if (process.env.NODE_ENV !== 'production') {
  globalForTenantDb.tenantDbCache = tenantDbCache;
}

export type DatabaseType = 'shared' | 'postgresql' | 'mysql' | 'mariadb' | 'sqlserver';

export interface TenantDbConfig {
  databaseUrl: string | null;
  databaseType: DatabaseType;
}

/**
 * Detect provider from connection URL
 */
export function detectProvider(url: string): 'postgresql' | 'mysql' | 'sqlserver' {
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgresql';
  if (url.startsWith('mysql://') || url.startsWith('mariadb://')) return 'mysql';
  if (url.startsWith('sqlserver://') || url.startsWith('mssql://')) return 'sqlserver';
  return 'postgresql';
}

/**
 * Get or create a Prisma client for a tenant's external database
 */
export function getTenantDbClient(config: TenantDbConfig, defaultClient: PrismaClient): PrismaClient {
  if (!config.databaseUrl || config.databaseType === 'shared') {
    return defaultClient;
  }

  const cacheKey = `${config.databaseType}:${config.databaseUrl}`;

  const cached = tenantDbCache.get(cacheKey);
  if (cached) return cached;

  const provider = detectProvider(config.databaseUrl);

  const client = new PrismaClient({
    datasourceUrl: config.databaseUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  tenantDbCache.set(cacheKey, client);

  return client;
}

/**
 * Test a database connection
 */
export async function testDatabaseConnection(
  url: string,
  type: DatabaseType
): Promise<{ success: boolean; version?: string; error?: string }> {
  try {
    const provider = detectProvider(url);
    const client = new PrismaClient({
      datasourceUrl: url,
      log: [],
    });

    // Simple query to test connection
    const result = await client.$queryRawUnsafe<{ version: string }[]>(
      provider === 'mysql'
        ? 'SELECT VERSION() AS version'
        : provider === 'sqlserver'
        ? 'SELECT @@VERSION AS version'
        : 'SELECT version() AS version'
    );

    await client.$disconnect();

    return {
      success: true,
      version: result[0]?.version,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Push Prisma schema to an external database
 */
export async function pushSchemaToDatabase(
  url: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use prisma db push via child process
    const { execSync } = await import('child_process');
    execSync(
      `npx prisma db push --schema=./prisma/schema.prisma`,
      {
        env: { ...process.env, DATABASE_URL: url },
        timeout: 60000,
        stdio: 'pipe',
      }
    );
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed',
    };
  }
}

/**
 * Disconnect all cached external DB clients
 */
export async function disconnectAllTenantDbs(): Promise<void> {
  for (const [key, client] of tenantDbCache.entries()) {
    try {
      await client.$disconnect();
    } catch {
      // Ignore errors on disconnect
    }
    tenantDbCache.delete(key);
  }
}
