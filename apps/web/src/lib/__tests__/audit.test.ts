import { describe, it, expect } from 'vitest';
import { computeDiff } from '@/lib/audit';

describe('Audit - computeDiff', () => {
  it('should detect changed fields', () => {
    const old = { name: 'Old Name', email: 'old@test.com' };
    const newVal = { name: 'New Name', email: 'old@test.com' };

    const diff = computeDiff(old, newVal);
    expect(diff.old).toEqual({ name: 'Old Name' });
    expect(diff.new).toEqual({ name: 'New Name' });
  });

  it('should skip unchanged fields', () => {
    const old = { name: 'Same', email: 'same@test.com' };
    const newVal = { name: 'Same', email: 'same@test.com' };

    const diff = computeDiff(old, newVal);
    expect(Object.keys(diff.old)).toHaveLength(0);
    expect(Object.keys(diff.new)).toHaveLength(0);
  });

  it('should handle new fields (additions)', () => {
    const old = {};
    const newVal = { name: 'Added' };

    const diff = computeDiff(old, newVal);
    expect(diff.old).toEqual({});
    expect(diff.new).toEqual({ name: 'Added' });
  });

  it('should handle removed fields', () => {
    const old = { name: 'Removed' };
    const newVal = {};

    const diff = computeDiff(old, newVal);
    expect(diff.old).toEqual({ name: 'Removed' });
    expect(diff.new).toEqual({});
  });

  it('should skip sensitive fields (password, apiKey)', () => {
    const old = { name: 'Test', password: 'old-pass', apiKey: 'old-key' };
    const newVal = { name: 'Test', password: 'new-pass', apiKey: 'new-key' };

    const diff = computeDiff(old, newVal);
    expect(diff.old).toEqual({});
    expect(diff.new).toEqual({});
  });

  it('should handle mixed changes with sensitive fields', () => {
    const old = { name: 'Old', password: 'old' };
    const newVal = { name: 'New', password: 'new' };

    const diff = computeDiff(old, newVal);
    expect(diff.old).toEqual({ name: 'Old' });
    expect(diff.new).toEqual({ name: 'New' });
    expect(diff.old).not.toHaveProperty('password');
  });

  it('should handle empty objects', () => {
    const diff = computeDiff({}, {});
    expect(diff.old).toEqual({});
    expect(diff.new).toEqual({});
  });

  it('should handle complex nested values', () => {
    const old = { tags: ['a', 'b'], meta: { x: 1 } };
    const newVal = { tags: ['a', 'c'], meta: { x: 2 } };

    const diff = computeDiff(old, newVal);
    expect(diff.old.tags).toEqual(['a', 'b']);
    expect(diff.new.tags).toEqual(['a', 'c']);
  });
});
