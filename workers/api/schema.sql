-- Stampbench account store (Cloudflare D1).
-- Apply with: npx wrangler d1 execute stampbench --remote --file=workers/api/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash    TEXT NOT NULL,
  pw_salt    TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'free',
  created_at INTEGER NOT NULL,
  -- Stripe linkage; NULL until the account first checks out.
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  -- PayPal linkage; NULL until a subscription activates, and cleared again
  -- when one stops entitling the account.
  paypal_subscription_id TEXT,
  -- SHA-256 hash of the account's inbound payment-webhook token (auto-invoicing).
  -- NULL until the user generates one; the token itself is never stored.
  payment_hook_hash TEXT
  ,terms_accepted_at INTEGER
  ,terms_version TEXT
);

-- Fixed-window abuse counters keyed by "<action>:<client ip>". Disposable:
-- deleting rows only resets counts. See migrations/002 for the rationale.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  key_hash   TEXT NOT NULL UNIQUE,
  prefix     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used  INTEGER
);

-- One row per user × feature × calendar month ("2026-08").
CREATE TABLE IF NOT EXISTS usage (
  user_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  period  TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, feature, period)
);

CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Invoices a signed-in user chose to save from the generator. `payload` is
-- the builder's draft JSON (editable form state, not XML); the other columns
-- are denormalised summary fields for listing without parsing payloads.
CREATE TABLE IF NOT EXISTS invoices (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  number     TEXT NOT NULL DEFAULT '',
  customer   TEXT NOT NULL DEFAULT '',
  total      TEXT NOT NULL DEFAULT '',
  currency   TEXT NOT NULL DEFAULT '',
  market     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'draft',
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS upgrade_requests (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  email      TEXT NOT NULL,
  plan       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);

-- Privacy-preserving page-view counts (workers/api/src/analytics.ts). Aggregate
-- only: one row per (UTC day, path), no IP/cookie/visitor data of any kind.
CREATE TABLE IF NOT EXISTS page_views (
  day   TEXT NOT NULL,
  path  TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_paypal_subscription ON users(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_payment_hook ON users(payment_hook_hash);
