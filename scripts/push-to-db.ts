#!/usr/bin/env node
/**
 * Push Prisma schema to different database types
 * Usage: npx tsx scripts/push-to-db.ts postgresql|mysql|sqlserver
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(__dirname, '../packages/database/prisma/schema.prisma');
const BACKUP_PATH = resolve(__dirname, '../packages/database/prisma/schema.prisma.bak');

const DB_CONFIGS: Record<string, { provider: string; url: string }> = {
  postgresql: {
    provider: 'postgresql',
    url: process.env.CRM_POSTGRES_URL || 'postgresql://postgres@localhost:5432/crm_next_postgres',
  },
  mysql: {
    provider: 'mysql',
    url: process.env.CRM_MYSQL_URL || 'mysql://crm_user:CrmDev2026!@localhost:3306/crm_next_mariadb',
  },
  sqlserver: {
    provider: 'sqlserver',
    url: process.env.CRM_SQLSERVER_URL || 'sqlserver://localhost:1433;database=crm_next_mssql;user=sa;password=YourStrong!Pass123;trustServerCertificate=true',
  },
};

const dbType = process.argv[2];

if (!dbType || !DB_CONFIGS[dbType]) {
  console.error('Usage: npx tsx scripts/push-to-db.ts postgresql|mysql|sqlserver');
  process.exit(1);
}

const config = DB_CONFIGS[dbType];

// Backup original schema
const originalSchema = readFileSync(SCHEMA_PATH, 'utf-8');
writeFileSync(BACKUP_PATH, originalSchema);

// Replace provider and URL
let newSchema = originalSchema.replace(
  /provider\s*=\s*"[^"]+"/,
  `provider = "${config.provider}"`
);
newSchema = newSchema.replace(
  /url\s*=\s*env\("[^"]+"\)/,
  `url      = "${config.url}"`
);

writeFileSync(SCHEMA_PATH, newSchema);

console.log(`Pushing schema to ${dbType}...`);
console.log(`URL: ${config.url}`);

try {
  execSync(`npx prisma db push --schema=${SCHEMA_PATH} --accept-data-loss`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: config.url },
  });
  console.log(`\n✅ Successfully pushed to ${dbType}`);
} catch (error) {
  console.error(`\n❌ Failed to push to ${dbType}`);
  process.exit(1);
} finally {
  // Restore original schema
  writeFileSync(SCHEMA_PATH, originalSchema);
  console.log('Original schema restored');
}
