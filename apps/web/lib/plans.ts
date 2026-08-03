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

/**
 * Pricing philosophy: the open-source library is free forever with FULL rules.
 * Paid tiers sell what code alone can't promise — always-current rules without
 * dependency upgrades, volume, client-project leverage (Agency), and the
 * compliance posture platforms need (Platform). Internal ids keep their
 * original names (starter/pro/scale) so Stripe env vars stay stable.
 */
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceGbp: 0,
    monthlyQuota: 100,
    rateLimitPerMinute: 10,
    features: [
      '100 hosted API calls / month',
      'Unlimited local validation (open-source library)',
      'XRechnung validation + generation',
      'Playground with AI explanations',
      'Community support',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Developer',
    priceGbp: 29,
    monthlyQuota: 5_000,
    rateLimitPerMinute: 60,
    features: [
      '5,000 documents / month',
      'Always-current rules — no dependency upgrades',
      'Version-pinned validation results',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Agency',
    priceGbp: 99,
    monthlyQuota: 25_000,
    rateLimitPerMinute: 120,
    features: [
      '25,000 documents / month',
      'Unlimited client projects',
      'White-label validation reports (coming)',
      'Priority support',
      'Early access to new formats (Factur-X, Peppol BIS)',
    ],
  },
  scale: {
    id: 'scale',
    name: 'Platform',
    priceGbp: 299,
    monthlyQuota: 100_000,
    rateLimitPerMinute: 300,
    features: [
      '100,000 documents / month, usage-based beyond',
      'DPA/AVV + EU data residency (rolling out)',
      'Rule-update SLA: new KoSIT releases within days',
      'Version pinning per integration',
      'Direct line to the team',
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
