/**
 * Billing Plans — definitions, limits, and price configuration
 *
 * Plans: Free → Starter → Professional → Enterprise
 * Each plan has limits on users, contacts, deals, AI requests, etc.
 */

export type PlanId = 'free' | 'starter' | 'professional' | 'enterprise';

export interface PlanLimits {
  maxUsers: number;
  maxContacts: number;
  maxDeals: number;
  maxAiRequestsPerDay: number;
  maxPipelines: number;
  maxStorageGB: number;
  features: string[];
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  price: number; // Monthly price in cents
  yearlyPrice: number; // Yearly price in cents (discount)
  currency: string;
  stripePriceId?: string; // Stripe Price ID (monthly)
  stripeYearlyPriceId?: string; // Stripe Price ID (yearly)
  limits: PlanLimits;
  isPopular?: boolean;
  trialDays: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Безкоштовний',
    description: 'Для ознайомлення з CRM',
    price: 0,
    yearlyPrice: 0,
    currency: 'usd',
    trialDays: 0,
    limits: {
      maxUsers: 1,
      maxContacts: 100,
      maxDeals: 20,
      maxAiRequestsPerDay: 50,
      maxPipelines: 1,
      maxStorageGB: 1,
      features: [
        'contacts',
        'deals',
        'tasks',
        'basic_ai',
      ],
    },
  },
  starter: {
    id: 'starter',
    name: 'Стартовий',
    description: 'Для малого бізнесу',
    price: 1900, // $19/mo
    yearlyPrice: 19000, // $190/yr (save ~17%)
    currency: 'usd',
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
    stripeYearlyPriceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
    trialDays: 14,
    limits: {
      maxUsers: 3,
      maxContacts: 1000,
      maxDeals: 200,
      maxAiRequestsPerDay: 500,
      maxPipelines: 3,
      maxStorageGB: 5,
      features: [
        'contacts',
        'deals',
        'tasks',
        'ai_full',
        'pipelines',
        'tags',
        'activity_log',
      ],
    },
  },
  professional: {
    id: 'professional',
    name: 'Професійний',
    description: 'Для команд продажів',
    price: 4900, // $49/mo
    yearlyPrice: 49000, // $490/yr (save ~17%)
    currency: 'usd',
    stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    stripeYearlyPriceId: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID,
    trialDays: 14,
    isPopular: true,
    limits: {
      maxUsers: 10,
      maxContacts: 10000,
      maxDeals: 2000,
      maxAiRequestsPerDay: 1500,
      maxPipelines: 10,
      maxStorageGB: 25,
      features: [
        'contacts',
        'deals',
        'tasks',
        'ai_full',
        'pipelines',
        'tags',
        'activity_log',
        'automations',
        'reports',
        'email_integration',
        'telegram_bot',
      ],
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Підприємство',
    description: 'Для великих компаній',
    price: 9900, // $99/mo
    yearlyPrice: 99000, // $990/yr (save ~17%)
    currency: 'usd',
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    stripeYearlyPriceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    trialDays: 30,
    limits: {
      maxUsers: -1, // unlimited
      maxContacts: -1, // unlimited
      maxDeals: -1, // unlimited
      maxAiRequestsPerDay: 5000,
      maxPipelines: -1, // unlimited
      maxStorageGB: 100,
      features: [
        'contacts',
        'deals',
        'tasks',
        'ai_full',
        'pipelines',
        'tags',
        'activity_log',
        'automations',
        'reports',
        'email_integration',
        'telegram_bot',
        'custom_fields',
        'api_access',
        'priority_support',
        'sso',
      ],
    },
  },
};

/**
 * Get plan by ID
 */
export function getPlan(planId: PlanId): Plan {
  return PLANS[planId] || PLANS.free;
}

/**
 * Get default plan for new tenants
 */
export function getDefaultPlan(): Plan {
  return PLANS.free;
}

/**
 * Get all plans as array
 */
export function getAllPlans(): Plan[] {
  return Object.values(PLANS);
}

/**
 * Parse plan limits from JSON string
 */
export function parsePlanLimits(limitsJson: string | null): PlanLimits {
  if (!limitsJson) return PLANS.free.limits;
  try {
    return JSON.parse(limitsJson) as PlanLimits;
  } catch {
    return PLANS.free.limits;
  }
}

/**
 * Check if a tenant is within a specific limit
 */
export function checkLimit(
  current: number,
  limit: number
): { allowed: boolean; percentage: number; remaining: number } {
  if (limit === -1) {
    return { allowed: true, percentage: 0, remaining: -1 }; // unlimited
  }
  const percentage = limit > 0 ? Math.round((current / limit) * 100) : 100;
  return {
    allowed: current < limit,
    percentage,
    remaining: Math.max(0, limit - current),
  };
}

/**
 * Get plan upgrade recommendations based on current usage
 */
export function getUpgradeRecommendation(
  currentPlan: PlanId,
  usage: { users: number; contacts: number; deals: number; aiRequests: number }
): PlanId | null {
  const current = PLANS[currentPlan];
  if (!current) return null;

  // Check if current plan limits are exceeded
  if (current.limits.maxUsers !== -1 && usage.users >= current.limits.maxUsers) {
    return getNextPlan(currentPlan);
  }
  if (current.limits.maxContacts !== -1 && usage.contacts >= current.limits.maxContacts) {
    return getNextPlan(currentPlan);
  }
  if (current.limits.maxDeals !== -1 && usage.deals >= current.limits.maxDeals) {
    return getNextPlan(currentPlan);
  }

  return null;
}

function getNextPlan(current: PlanId): PlanId | null {
  const order: PlanId[] = ['free', 'starter', 'professional', 'enterprise'];
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}
