export type PlanId = 'free' | 'starter' | 'pro' | 'scale';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in GBP; 0 = free. */
  priceGbp: number;
  /** API calls (validate + generate + AI explain) per calendar month. */
  monthlyQuota: number;
  /** Requests per minute per API key. */
  rateLimitPerMinute: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceGbp: 0,
    monthlyQuota: 100,
    rateLimitPerMinute: 10,
    features: [
      '100 API calls / month',
      'XRechnung + EN 16931 validation',
      'XRechnung generation',
      'AI error explanations',
      'Community support',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceGbp: 19,
    monthlyQuota: 2_500,
    rateLimitPerMinute: 60,
    features: [
      '2,500 API calls / month',
      'Everything in Free',
      'Usage analytics',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceGbp: 49,
    monthlyQuota: 15_000,
    rateLimitPerMinute: 120,
    features: [
      '15,000 API calls / month',
      'Everything in Starter',
      'Priority support',
      'Early access to new formats (Factur-X, Peppol BIS)',
    ],
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    priceGbp: 149,
    monthlyQuota: 100_000,
    rateLimitPerMinute: 300,
    features: [
      '100,000 API calls / month',
      'Everything in Pro',
      'Higher rate limits',
      'Direct line to the founder',
    ],
  },
};

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'free'] ?? PLANS.free;
}

/** Start of the current calendar month (UTC) — the quota window. */
export function currentPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
