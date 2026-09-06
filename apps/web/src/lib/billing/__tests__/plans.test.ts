/**
 * Tests for Billing Plans
 */

import { describe, it, expect } from 'vitest';
import {
  PLANS,
  getPlan,
  getDefaultPlan,
  getAllPlans,
  parsePlanLimits,
  checkLimit,
  getUpgradeRecommendation,
  type PlanId,
} from '../plans';

describe('Billing Plans', () => {
  it('should have 4 plans defined', () => {
    const plans = getAllPlans();
    expect(plans.length).toBe(4);
  });

  it('should have all required fields', () => {
    Object.values(PLANS).forEach((plan) => {
      expect(plan.id).toBeDefined();
      expect(plan.name).toBeDefined();
      expect(plan.description).toBeDefined();
      expect(plan.price).toBeGreaterThanOrEqual(0);
      expect(plan.yearlyPrice).toBeGreaterThanOrEqual(0);
      expect(plan.limits).toBeDefined();
      expect(plan.limits.maxUsers).toBeGreaterThanOrEqual(-1);
      expect(plan.limits.maxContacts).toBeGreaterThanOrEqual(-1);
      expect(plan.limits.maxDeals).toBeGreaterThanOrEqual(-1);
      expect(plan.limits.features).toBeInstanceOf(Array);
    });
  });

  it('free plan should have zero price', () => {
    expect(PLANS.free.price).toBe(0);
    expect(PLANS.free.yearlyPrice).toBe(0);
  });

  it('yearly price should be less than 12x monthly (discount)', () => {
    Object.values(PLANS).forEach((plan) => {
      if (plan.price > 0) {
        expect(plan.yearlyPrice).toBeLessThan(plan.price * 12);
      }
    });
  });

  it('professional should be marked as popular', () => {
    expect(PLANS.professional.isPopular).toBe(true);
  });

  it('getPlan should return correct plan', () => {
    expect(getPlan('free').name).toBe('Безкоштовний');
    expect(getPlan('starter').name).toBe('Стартовий');
    expect(getPlan('professional').name).toBe('Професійний');
    expect(getPlan('enterprise').name).toBe('Підприємство');
  });

  it('getPlan should return free for unknown plan', () => {
    expect(getPlan('unknown' as PlanId).id).toBe('free');
  });

  it('getDefaultPlan should return free', () => {
    expect(getDefaultPlan().id).toBe('free');
  });
});

describe('parsePlanLimits', () => {
  it('should parse valid JSON', () => {
    const json = JSON.stringify({ maxUsers: 5, maxContacts: 100, maxDeals: 20, maxAiRequestsPerDay: 500, maxPipelines: 3, maxStorageGB: 5, features: ['test'] });
    const limits = parsePlanLimits(json);
    expect(limits.maxUsers).toBe(5);
    expect(limits.maxContacts).toBe(100);
  });

  it('should return free limits for null', () => {
    const limits = parsePlanLimits(null);
    expect(limits.maxUsers).toBe(PLANS.free.limits.maxUsers);
  });

  it('should return free limits for invalid JSON', () => {
    const limits = parsePlanLimits('not-json');
    expect(limits.maxUsers).toBe(PLANS.free.limits.maxUsers);
  });
});

describe('checkLimit', () => {
  it('should allow when under limit', () => {
    const result = checkLimit(5, 10);
    expect(result.allowed).toBe(true);
    expect(result.percentage).toBe(50);
    expect(result.remaining).toBe(5);
  });

  it('should block when at limit', () => {
    const result = checkLimit(10, 10);
    expect(result.allowed).toBe(false);
    expect(result.percentage).toBe(100);
    expect(result.remaining).toBe(0);
  });

  it('should block when over limit', () => {
    const result = checkLimit(15, 10);
    expect(result.allowed).toBe(false);
    expect(result.percentage).toBe(150);
    expect(result.remaining).toBe(0);
  });

  it('should always allow unlimited (-1)', () => {
    const result = checkLimit(1000, -1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(-1);
  });
});

describe('getUpgradeRecommendation', () => {
  it('should recommend starter when free users exceeded', () => {
    const result = getUpgradeRecommendation('free', { users: 1, contacts: 50, deals: 10, aiRequests: 20 });
    expect(result).toBe('starter');
  });

  it('should recommend professional when starter contacts exceeded', () => {
    const result = getUpgradeRecommendation('starter', { users: 2, contacts: 1000, deals: 100, aiRequests: 200 });
    expect(result).toBe('professional');
  });

  it('should return null when within limits', () => {
    const result = getUpgradeRecommendation('professional', { users: 5, contacts: 1000, deals: 100, aiRequests: 200 });
    expect(result).toBeNull();
  });

  it('should return null for enterprise (highest plan)', () => {
    const result = getUpgradeRecommendation('enterprise', { users: 100, contacts: 100000, deals: 10000, aiRequests: 5000 });
    expect(result).toBeNull();
  });
});
