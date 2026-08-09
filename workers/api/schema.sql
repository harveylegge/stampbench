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
  stripe_subscription_id TEXT
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

CREATE TABLE IF NOT EXISTS upgrade_requests (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  email      TEXT NOT NULL,
  plan       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
