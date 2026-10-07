export type PlanId = 'free' | 'starter' | 'pro' | 'scale';

/** Which of the two Stampbench experiences a plan is sold into. */
export type Audience = 'business' | 'developer';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in GBP; 0 = free. */
  priceGbp: number;
  /** API calls (validate + generate + AI explain) per calendar month. */
  monthlyQuota: number;
  /** Requests per minute per API key. */
  rateLimitPerMinute: number;
  /**
   * The whole feature list, business and developer items together. Kept for
   * compact summaries (the account page shows the first three); the pricing
   * page reads the per-audience lists below instead, because "50 invoices" and
   * "5,000 API calls" in one column is the confusion that made the old page
   * unreadable to both audiences at once.
   */
  features: string[];
  /** Which audiences this plan is offered to, and how it is described to each. */
  audiences: Audience[];
  /** One line of "is this me?", written per audience. */
  forWhom: Partial<Record<Audience, string>>;
  /** The features that matter to each audience, in that audience's language. */
  perAudience: Partial<Record<Audience, string[]>>;
}

/**
 * Pricing philosophy: the open-source library is free forever with FULL rules.
 * Paid tiers sell what code alone can't promise: always-current rules without
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
      'PDF invoices with a small "Made with Stampbench" line',
      'Backs up your last 10 invoices to your account',
      'Community support',
    ],
    audiences: ['business', 'developer'],
    forWhom: {
      business: 'Invoicing occasionally, and happy with a small Stampbench line on the PDF.',
      developer: 'Trying the hosted API, or running everything locally for free.',
    },
    perAudience: {
      business: [
        '5 invoices a month',
        'Every invoice checked automatically before download',
        'PDF and e-invoice file downloads',
        'Small "Made with Stampbench" line on the PDF',
        'Your last 10 invoices backed up to your account',
      ],
      developer: [
        '100 hosted API calls / month',
        'Unlimited local validation with the open-source library',
        'Validation, generation and repair in the playground',
        '10 shared reports · 5 future-ruleset checks / month',
        'Community support',
      ],
    },
  },
  starter: {
    id: 'starter',
    name: 'Developer',
    priceGbp: 29,
    monthlyQuota: 5_000,
    rateLimitPerMinute: 60,
    features: [
      'Clean PDFs: no Stampbench line',
      'Every invoice backed up, on every device',
      '5,000 documents / month',
      'Always-current rules: no dependency upgrades',
      'Version-pinned validation results',
      'Email support',
    ],
    audiences: ['business', 'developer'],
    forWhom: {
      business: 'Invoicing regularly, and wanting the PDF to carry only your own branding.',
      developer: 'One product or integration calling the hosted API.',
    },
    perAudience: {
      business: [
        'Unlimited invoices every month',
        'Recurring invoices that build themselves',
        'Invoices that mark themselves paid when the money arrives',
        'Your customer book, filled in from past invoices',
        'Mark invoices paid and see what is overdue',
        'The Stampbench assistant, on every page',
        'Clean PDFs: no Stampbench line',
        'Every invoice backed up, on every device you sign in to',
        'Email support',
      ],
      developer: [
        '5,000 documents / month',
        '60 requests / minute',
        'Always-current rules: no dependency upgrades',
        'Version-pinned validation results',
        'Email support',
      ],
    },
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
    audiences: ['developer'],
    forWhom: {
      developer: 'Building for several clients, each with their own integration.',
    },
    perAudience: {
      developer: [
        '25,000 documents / month',
        '120 requests / minute',
        'Unlimited client projects',
        'White-label validation reports (coming)',
        'Early access to new formats (Factur-X, Peppol BIS)',
        'Priority support',
      ],
    },
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
    audiences: ['developer'],
    forWhom: {
      developer: 'Embedding Stampbench in a product your own customers rely on.',
    },
    perAudience: {
      developer: [
        '100,000 documents / month, usage-based beyond',
        '300 requests / minute',
        'DPA/AVV + EU data residency (rolling out)',
        'Rule-update SLA: new KoSIT releases within days',
        'Version pinning per integration',
        'Direct line to the team',
      ],
    },
  },
};

/** The plans offered to an audience, cheapest first. */
export function plansFor(audience: Audience): Plan[] {
  const order: PlanId[] = ['free', 'starter', 'pro', 'scale'];
  return order.map((id) => PLANS[id]).filter((plan) => plan.audiences.includes(audience));
}

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'free'] ?? PLANS.free;
}

/**
 * Metered account features. 'api' is the hosted REST API (the number the
 * pricing page promises). 'share' stores a validation report server-side and
 * returns a link. 'regress' is the future-ruleset check in the playground.
 *
 * The local library and the playground's validate/generate/fix stay unlimited
 * and unmetered: that promise ("unlimited local validation, free forever")
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

/**
 * How many invoices an account keeps backed up. Deliberately NOT a monthly
 * meter: backup is a rolling archive, so on the free plan the oldest entries
 * fall off quietly rather than saves failing. The browser-local list is never
 * limited: this caps only the account copy, which is the upgrade hook.
 */
export const BACKUP_LIMITS: Record<PlanId, number> = {
  free: 10,
  starter: 500,
  pro: 2_000,
  scale: 10_000,
};

export function backupLimit(plan: string | null | undefined): number {
  return BACKUP_LIMITS[planFor(plan).id];
}

/** The usage-table period key for now, e.g. "2026-08". */
export function currentPeriodKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Start of the current calendar month (UTC): the quota window. */
export function currentPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
