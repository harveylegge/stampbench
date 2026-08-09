-- Migration 002: abuse controls, GDPR erasure support, and Stripe billing.
-- Apply with:
--   npx wrangler d1 execute stampbench --remote --file=workers/api/migrations/002_security_and_billing.sql
--
-- Safe to run once. SQLite has no "ADD COLUMN IF NOT EXISTS", so re-running
-- reports "duplicate column name" on the ALTERs — that error means it already
-- ran, not that anything broke.

-- Fixed-window counters keyed by "<action>:<client ip>". The row IS the limit:
-- the guarded UPSERT below is atomic, so two racing requests cannot both take
-- the last unit. Rows are disposable — deleting the table only resets counts.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Stripe linkage. Nullable: an account that never pays keeps both NULL, and
-- the webhook resolves a payment back to a user by customer id.
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
