/**
 * Миграция ключей — тест РЕАЛЬНОГО скрипта scripts/migrate-encrypt-keys.mjs.
 *
 * Это интеграционный тест: сидит tenant с plaintext-ключом, затем реальный
 * скрипт запускается отдельным процессом (spawnSync, как в проде), вывод
 * проверяется, запись в БД проверяется, round-trip через настоящий decrypt().
 *
 * Здесь НЕТ локальных копий deriveKey/encrypt — вся криптография берётся
 * либо из scripts/migrate-encrypt-keys.mjs, либо из lib/encryption.ts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prisma } from '@crm-next/database';
import { decrypt, isEncrypted } from '@/lib/encryption';

const REPO_ROOT = fileURLToPath(new URL('../../../../..', import.meta.url));
const SCRIPT = 'scripts/migrate-encrypt-keys.mjs';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const PLAINTEXT_KEY = 'sk-test-plaintext-12345';
const SLUG = 'mig-canonical';

function runMigration(): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [SCRIPT], {
    cwd: REPO_ROOT,
    env: { ...process.env, ENCRYPTION_KEY, DATABASE_URL: process.env.DATABASE_URL! },
    encoding: 'utf-8',
    timeout: 120000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

let tenantId: string;

beforeAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: SLUG } });
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Migration Canonical Test',
      slug: SLUG,
      plan: 'professional',
      aiApiKey: PLAINTEXT_KEY, // вставлен напрямую, минуя шифрование
    },
  });
  tenantId = tenant.id;
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('П2: реальный scripts/migrate-encrypt-keys.mjs', () => {
  it('прогон скрипта: находит и мигрирует 1 tenant', () => {
    const r = runMigration();
    expect(r.stderr).not.toMatch(/Error|error/);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Migrated: 1/);
  });

  it('запись в БД теперь iv:tag:ciphertext, decrypt возвращает исходник', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(tenant.aiApiKey).not.toBe(PLAINTEXT_KEY);
    expect(isEncrypted(tenant.aiApiKey!)).toBe(true);
    expect(decrypt(tenant.aiApiKey!)).toBe(PLAINTEXT_KEY);
  });

  it('повторный прогон идемпотентен: Migrated: 0', () => {
    const r = runMigration();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Migrated: 0/);
  });

  it('паритет деривации: .mjs и encryption.ts дают идентичный ключ + round-trip', () => {
    // Выполняем функции РЕАЛЬНОГО .mjs в отдельном node-процессе,
    // сверяем с РЕАЛЬНЫМ lib/encryption.ts здесь.
    const probe = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { deriveKey, encrypt } from './${SCRIPT}';
         const k = deriveKey(process.env.ENCRYPTION_KEY);
         console.log(JSON.stringify({ keyHex: k.toString('hex'), cipher: encrypt('parity-probe') }));`,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, ENCRYPTION_KEY, DATABASE_URL: process.env.DATABASE_URL! },
        encoding: 'utf-8',
        timeout: 120000,
      }
    );
    expect(probe.status).toBe(0);
    const { keyHex, cipher } = JSON.parse(probe.stdout);
    // 1) деривация идентична Buffer.from(key, 'hex') — формуле encryption.ts
    expect(keyHex).toBe(Buffer.from(ENCRYPTION_KEY, 'hex').toString('hex'));
    // 2) зашифрованное скриптом расшифровывается настоящим decrypt()
    expect(decrypt(cipher)).toBe('parity-probe');
  });
});
