/**
 * TOTP (RFC 6238) — shared implementation for 2FA setup/verify.
 *
 * Secrets are base32 strings (authenticator-app compatible).
 */

import { randomBytes, createHmac } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(key: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);

  const hash = createHmac('sha1', key).update(counterBuffer).digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(code % 1000000).padStart(6, '0');
}

export function generateTOTPSecret(): string {
  return base32Encode(randomBytes(20));
}

export function generateTOTP(base32Secret: string, timeStep: number = 30, atMs: number = Date.now()): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(Math.floor(atMs / 1000) / timeStep);
  return hotp(key, counter);
}

export function verifyTOTP(base32Secret: string, token: string): boolean {
  // Check current and adjacent time windows (±30s clock skew)
  const now = Date.now();
  for (const skew of [-30000, 0, 30000]) {
    try {
      if (generateTOTP(base32Secret, 30, now + skew) === token) return true;
    } catch {
      // invalid secret format — treat as mismatch
    }
  }
  return false;
}
