/**
 * Data Encryption Utilities
 * 
 * Encrypts/decrypts sensitive fields in the database.
 * Uses AES-256-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  // Fail fast: silently falling back to a hardcoded key would encrypt
  // production secrets with a publicly known value.
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY не задан. Добавьте 64-символьный hex-ключ в переменные окружения — ' +
      'приложение не может безопасно хранить секреты без него.'
    );
  }
  if (key.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY должен быть 64 hex-символами (32 байта). ' +
      `Получено ${key.length} символов.`
    );
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string value
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string value
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext;

  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error(
      'Ключ не в ожидаемом зашифрованном формате (iv:tag:ciphertext) — ' +
      'требуется пересохранение API-ключа в настройках'
    );
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && 
         parts[0].length === IV_LENGTH * 2 && 
         parts[1].length === TAG_LENGTH * 2;
}

/**
 * Encrypt sensitive fields in an object
 */
export function encryptFields<T extends Record<string, unknown>>(
  data: T,
  fields: string[]
): T {
  const result = { ...data };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      (result as Record<string, unknown>)[field] = encrypt(result[field] as string);
    }
  }
  return result;
}

/**
 * Decrypt sensitive fields in an object
 */
export function decryptFields<T extends Record<string, unknown>>(
  data: T,
  fields: string[]
): T {
  const result = { ...data };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      (result as Record<string, unknown>)[field] = decrypt(result[field] as string);
    }
  }
  return result;
}

// Fields that should be encrypted in the database.
//
// OPEN RISK ( зафиксирован, не забыт ): as of Phase 4 only contact.phone/notes
// are wired end-to-end (encrypt on POST+PUT /api/contacts, decrypt on GET reads).
// deal.notes/winReason/lossReason and task.description are stored PLAINTEXT:
// wiring them requires also fixing search/export/import/dedup paths that read
// these fields raw (e.g. contacts search-by-phone already can't match encrypted
// values). Do NOT mark this done until those read paths are migrated too.
export const ENCRYPTED_FIELDS = {
  contact: ['phone', 'notes'],
  deal: ['notes', 'winReason', 'lossReason'],
  task: ['description'],
};
