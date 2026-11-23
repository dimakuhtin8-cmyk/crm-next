import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

// ВРЕМЕННЫЙ эндпоинт миграции (фаза А: интеграции).
// Идемпотентный SQL: таблица Webhook + колонки externalId.
// ПОСЛЕ успешного запуска на проде ФАЙЛ УДАЛЯЕТСЯ (как ensure-schema ранее).
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Webhook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "Webhook_tenantId_idx" ON "Webhook"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "Webhook_tenantId_active_idx" ON "Webhook"("tenantId", "active")`,
  `ALTER TABLE "Webhook" DROP CONSTRAINT IF EXISTS "Webhook_tenantId_fkey"`,
  `ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "externalId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Contact_tenantId_externalId_idx" ON "Contact"("tenantId", "externalId")`,
  `ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "externalId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Deal_tenantId_externalId_idx" ON "Deal"("tenantId", "externalId")`,
  `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "externalId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Task_tenantId_externalId_idx" ON "Task"("tenantId", "externalId")`,
];

export async function GET() {
  const results: string[] = [];
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push('ok');
    } catch (e) {
      results.push(`error: ${(e as Error).message}`);
    }
  }
  return NextResponse.json({ ok: results.every((r) => r === 'ok'), results });
}
