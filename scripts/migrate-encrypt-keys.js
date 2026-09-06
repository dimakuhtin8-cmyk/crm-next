/**
 * Migration: Encrypt all plaintext AI API keys
 * 
 * Run: node scripts/migrate-encrypt-keys.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.error('ENCRYPTION_KEY must be set and 64 hex characters');
  process.exit(1);
}

function deriveKey(keyHex) {
  return crypto.scryptSync(keyHex, 'crm-next-salt', 32);
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

async function main() {
  console.log('=== Migration: Encrypt plaintext AI keys ===\n');

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      aiApiKey: true,
      aiFallbackApiKey: true,
      aiProvider: true,
      aiFallbackProvider: true,
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
      console.log(`[${tenant.name}] Primary key: plaintext → encrypted`);
    } else if (tenant.aiApiKey) {
      console.log(`[${tenant.name}] Primary key: already encrypted`);
    }

    if (tenant.aiFallbackApiKey && !isEncrypted(tenant.aiFallbackApiKey)) {
      updates.aiFallbackApiKey = encrypt(tenant.aiFallbackApiKey);
      console.log(`[${tenant.name}] Fallback key: plaintext → encrypted`);
    } else if (tenant.aiFallbackApiKey) {
      console.log(`[${tenant.name}] Fallback key: already encrypted`);
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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
