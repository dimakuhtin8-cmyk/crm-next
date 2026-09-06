/**
 * Tests for Data Encryption Utilities
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncrypted, encryptFields, decryptFields } from '@/lib/encryption';

describe('Encryption', () => {
  it('should encrypt and decrypt a string', () => {
    const plaintext = 'AIzaSyD-test-api-key-12345';
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(isEncrypted(encrypted)).toBe(true);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const plaintext = 'test-key';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);

    // Different ciphertext due to random IV
    expect(enc1).not.toBe(enc2);
    // But both decrypt to same value
    expect(decrypt(enc1)).toBe(plaintext);
    expect(decrypt(enc2)).toBe(plaintext);
  });

  it('isEncrypted should detect encrypted strings', () => {
    const plaintext = 'not-encrypted';
    const encrypted = encrypt(plaintext);

    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted(plaintext)).toBe(false);
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted('short')).toBe(false);
  });

  it('decrypt should throw on plaintext (not encrypted)', () => {
    expect(() => decrypt('some-plaintext-key')).toThrow(
      'Ключ не в ожидаемом зашифрованном формате'
    );
  });

  it('should encrypt/decrypt empty string', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('should handle special characters', () => {
    const plaintext = 'Кирилиця! @#$%^&*() test123';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });
});

describe('encryptFields / decryptFields', () => {
  it('should encrypt specified fields in an object', () => {
    const data = {
      name: 'Test',
      phone: '+380123456789',
      notes: 'Some notes',
      email: 'test@example.com',
    };

    const encrypted = encryptFields(data, ['phone', 'notes']);

    expect(encrypted.name).toBe('Test');
    expect(encrypted.email).toBe('test@example.com');
    expect(encrypted.phone).not.toBe('+380123456789');
    expect(encrypted.notes).not.toBe('Some notes');
    expect(isEncrypted(encrypted.phone)).toBe(true);
    expect(isEncrypted(encrypted.notes)).toBe(true);
  });

  it('should decrypt specified fields in an object', () => {
    const data = {
      name: 'Test',
      phone: encrypt('+380123456789'),
      notes: encrypt('Some notes'),
    };

    const decrypted = decryptFields(data, ['phone', 'notes']);

    expect(decrypted.name).toBe('Test');
    expect(decrypted.phone).toBe('+380123456789');
    expect(decrypted.notes).toBe('Some notes');
  });

  it('should not modify fields not in the list', () => {
    const data = {
      firstName: 'Ivan',
      lastName: 'Petrenko',
      phone: '+380123456789',
    };

    const encrypted = encryptFields(data, ['phone']);

    expect(encrypted.firstName).toBe('Ivan');
    expect(encrypted.lastName).toBe('Petrenko');
    expect(isEncrypted(encrypted.phone)).toBe(true);
  });
});
