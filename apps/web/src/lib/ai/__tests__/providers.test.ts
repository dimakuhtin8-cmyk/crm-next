/**
 * Tests for AI Usage Tracking
 */

import { describe, it, expect } from 'vitest';
import { AI_PROVIDERS, getProvider, getDefaultProvider } from '../providers';

describe('AI Providers', () => {
  it('should have 7 providers defined', () => {
    expect(AI_PROVIDERS.length).toBe(7);
  });

  it('should have all required fields for each provider', () => {
    AI_PROVIDERS.forEach((provider) => {
      expect(provider.id).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(provider.description).toBeDefined();
      expect(provider.keyUrl).toBeDefined();
      expect(provider.keyPlaceholder).toBeDefined();
      expect(provider.models).toBeDefined();
      expect(provider.models.length).toBeGreaterThan(0);

      provider.models.forEach((model) => {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.description).toBeDefined();
      });
    });
  });

  it('getProvider should return correct provider', () => {
    const gemini = getProvider('gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.name).toBe('Google Gemini');
  });

  it('getProvider should return undefined for unknown provider', () => {
    expect(getProvider('unknown')).toBeUndefined();
  });

  it('getDefaultProvider should return first provider (gemini)', () => {
    const defaultProvider = getDefaultProvider();
    expect(defaultProvider.id).toBe('gemini');
  });

  it('should have unique provider IDs', () => {
    const ids = AI_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have unique model IDs within each provider', () => {
    AI_PROVIDERS.forEach((provider) => {
      const modelIds = provider.models.map((m) => m.id);
      expect(new Set(modelIds).size).toBe(modelIds.length);
    });
  });
});

describe('Provider Key Validation', () => {
  it('gemini key should start with AIza', () => {
    const gemini = getProvider('gemini');
    expect(gemini?.keyPrefix).toBe('AIza');
  });

  it('openai key should start with sk-', () => {
    const openai = getProvider('openai');
    expect(openai?.keyPrefix).toBe('sk-');
  });

  it('anthropic key should start with sk-ant-', () => {
    const anthropic = getProvider('anthropic');
    expect(anthropic?.keyPrefix).toBe('sk-ant-');
  });

  it('groq key should start with gsk_', () => {
    const groq = getProvider('groq');
    expect(groq?.keyPrefix).toBe('gsk_');
  });
});
