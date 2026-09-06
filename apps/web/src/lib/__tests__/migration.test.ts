/**
 * P2: Миграция ключей — интеграционный тест
 *
 * Тип: интеграционный тест (реальные insert'ы в БД, реальный encrypt/decrypt, реальная миграция)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { prisma } from '@crm-next/database';
import { decrypt } from '@/lib/encryption';

const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ALGORITHM = 'aes-256-gcm';

function deriveKey(keyHex: string) {
  return Buffer.from(keyHex, 'hex');
}

function encryptLocal(text: string): string {
  const key = deriveKey(ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function isEncrypted(value: string): boolean {
  if (!value || value.length < 20) return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  try {
    Buffer.from(parts[0], 'hex');
    Buffer.from(parts[1], 'hex');
    Buffer.from(parts[2], 'hex');
    return true;
  } catch {
    return false;
  }
}

// Import migration logic inline (same logic as scripts/migrate-encrypt-keys.mjs)
async function runMigration() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, geminiApiKey: true, aiApiKey: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const updates: Record<string, string> = {};

    if (tenant.aiApiKey && !isEncrypted(tenant.aiApiKey)) {
      updates.aiApiKey = encryptLocal(tenant.aiApiKey);
    }
    if (tenant.geminiApiKey && !isEncrypted(tenant.geminiApiKey)) {
      updates.geminiApiKey = encryptLocal(tenant.geminiApiKey);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.tenant.update({ where: { id: tenant.id }, data: updates });
      migrated++;
    } else {
      skipped++;
    }
  }

  return { total: tenants.length, migrated, skipped };
}

const PLAINTEXT_KEY = 'sk-test-plaintext-12345';
let tenantId: string;

beforeAll(async () => {
  // Cleanup
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: 'migration-test' } } });

  // Insert tenant with PLAINTEXT key directly into DB (bypassing encryption)
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Migration Test Tenant',
      slug: 'migration-test-' + Date.now(),
      plan: 'professional',
      aiApiKey: PLAINTEXT_KEY, // Plaintext — not encrypted!
    },
  });
  tenantId = tenant.id;
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
});

describe('P2: Migration — plaintext key → encrypted', () => {
  it('step 1: plaintext key is stored as-is in DB', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(tenant.aiApiKey).toBe(PLAINTEXT_KEY);
    expect(isEncrypted(tenant.aiApiKey!)).toBe(false);
  });

  it('step 2: migration encrypts the plaintext key', async () => {
    const result = await runMigration();

    expect(result.migrated).toBeGreaterThanOrEqual(1);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(tenant.aiApiKey).not.toBe(PLAINTEXT_KEY);
    expect(isEncrypted(tenant.aiApiKey!)).toBe(true);
  });

  it('step 3: decrypt() round-trip returns original plaintext', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const decrypted = decrypt(tenant.aiApiKey!);
    expect(decrypted).toBe(PLAINTEXT_KEY);
  });

  it('step 4: re-running migration is idempotent (0 migrated)', async () => {
    const result = await runMigration();
    expect(result.migrated).toBe(0);
  });
});
