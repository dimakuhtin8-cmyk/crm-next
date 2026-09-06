import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error('ENCRYPTION_KEY must be set and 64 hex characters');
  process.exit(1);
}

function deriveKey(keyHex) {
  return Buffer.from(keyHex, 'hex');
}

function isEncrypted(value) {
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

function encrypt(text) {
  const key = deriveKey(ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

console.log('=== Migration: Encrypt plaintext AI keys ===\n');

const tenants = await prisma.tenant.findMany({
  select: {
    id: true,
    name: true,
    geminiApiKey: true,
    aiApiKey: true,
  },
});

console.log(`Found ${tenants.length} tenants\n`);

let migrated = 0;
let skipped = 0;
let errors = 0;

for (const tenant of tenants) {
  const updates = {};

  if (tenant.aiApiKey && !isEncrypted(tenant.aiApiKey)) {
    updates.aiApiKey = encrypt(tenant.aiApiKey);
    console.log(`[${tenant.name}] aiApiKey: plaintext → encrypted`);
  } else if (tenant.aiApiKey) {
    console.log(`[${tenant.name}] aiApiKey: already encrypted`);
  }

  if (tenant.geminiApiKey && !isEncrypted(tenant.geminiApiKey)) {
    updates.geminiApiKey = encrypt(tenant.geminiApiKey);
    console.log(`[${tenant.name}] geminiApiKey: plaintext → encrypted`);
  } else if (tenant.geminiApiKey) {
    console.log(`[${tenant.name}] geminiApiKey: already encrypted`);
  }

  if (Object.keys(updates).length > 0) {
    try {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: updates,
      });
      migrated++;
      console.log(`  ✓ Migrated\n`);
    } catch (err) {
      errors++;
      console.error(`  ✗ Error: ${err}\n`);
    }
  } else {
    skipped++;
    console.log(`  → Skipped (no plaintext keys)\n`);
  }
}

console.log('=== Summary ===');
console.log(`Total tenants: ${tenants.length}`);
console.log(`Migrated: ${migrated}`);
console.log(`Skipped: ${skipped}`);
console.log(`Errors: ${errors}`);

await prisma.$disconnect();
