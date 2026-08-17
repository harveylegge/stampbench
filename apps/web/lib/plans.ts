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
      'Playground with plain-language explanations',
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

/**
 * Whether `id` names a real plan.
 *
 * `id in PLANS` is not this check — `in` walks the prototype chain, so
 * 'constructor', 'toString' and friends all pass it and then index PLANS to
 * something from Object.prototype rather than a Plan. Every caller here takes
 * the plan id from a request body or a database column, so the distinction is
 * load-bearing rather than theoretical.
 */
export function isPlanId(id: unknown): id is PlanId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PLANS, id);
}

export function planFor(id: string | null | undefined): Plan {
  return isPlanId(id) ? PLANS[id] : PLANS.free;
}

/**
 * Metered account features. 'api' is the hosted REST API (the number the
 * pricing page promises). 'share' stores a validation report server-side and
 * returns a link. 'regress' is the future-ruleset check in the playground.
 *
 * The local library and the playground's validate/generate/fix stay unlimited
 * and unmetered — that promise ("unlimited local validation, free forever")
 * is load-bearing marketing and must never gain a quota here.
 *
 * -1 = unlimited. Quotas are per calendar month (UTC).
 */
export type FeatureId = 'api' | 'share' | 'regress' | 'ai';

export const FEATURE_LIMITS: Record<PlanId, Record<FeatureId, number>> = {
  free: { api: 100, share: 10, regress: 5, ai: 5 },
  starter: { api: 5_000, share: 100, regress: -1, ai: 100 },
  pro: { api: 25_000, share: 500, regress: -1, ai: 400 },
  scale: { api: 100_000, share: 2_000, regress: -1, ai: 1_500 },
};

/**
 * The "credit jar" lid for AI explanations: the total across ALL users per
 * calendar month. Per-user quotas above cap individuals; this caps Harvey's
 * Anthropic bill no matter how many users sign up. Counted in the same usage
 * table under the reserved user id '__global__'.
 */
export const AI_GLOBAL_MONTHLY_CAP = 10_000;

export function featureLimit(plan: string | null | undefined, feature: FeatureId): number {
  return FEATURE_LIMITS[planFor(plan).id][feature];
}

/** The usage-table period key for now, e.g. "2026-08". */
export function currentPeriodKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Start of the current calendar month (UTC) — the quota window. */
export function currentPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
