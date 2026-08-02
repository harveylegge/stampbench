/**
 * Central environment access. Every optional integration degrades gracefully:
 * the app must build, run, and demo with ZERO secrets configured.
 */

function required(name: string, fallback: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  return fallback;
}

export const env = {
  appUrl: required('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  /** Session token signing/pepper. MUST be set in production. */
  sessionSecret: required('SESSION_SECRET', 'dev-only-insecure-secret-change-me'),
  isProd: process.env.NODE_ENV === 'production',

  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePrices: {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    scale: process.env.STRIPE_PRICE_SCALE,
  },
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  adminEmail: process.env.ADMIN_EMAIL,
};

export const features = {
  /** True when Stripe is fully configured and live billing can run. */
  billing: Boolean(env.stripeSecretKey && env.stripeWebhookSecret),
  /** True when AI explanations use the live Anthropic API (else deterministic fallback). */
  liveAi: Boolean(env.anthropicApiKey),
  /** True when rate limiting is backed by Upstash (else in-memory). */
  distributedRateLimit: Boolean(env.upstashUrl && env.upstashToken),
};

/**
 * True when running production auth on the known dev secret — checked at the
 * moment a session is hashed (not at module load, which would break builds).
 */
export function insecureProductionSecret(): boolean {
  return env.isProd && env.sessionSecret === 'dev-only-insecure-secret-change-me';
}
