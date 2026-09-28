-- Migration 003: PayPal Subscriptions (self-serve recurring billing).
-- Apply with:
--   npx wrangler d1 execute stampbench --remote --file=workers/api/migrations/003_paypal_subscriptions.sql
--
-- Safe to run once. SQLite has no "ADD COLUMN IF NOT EXISTS", so re-running
-- reports "duplicate column name" on the ALTER — that error means it already
-- ran, not that anything broke.

-- The account's PayPal subscription (`I-…`). Nullable: an account that never
-- subscribes keeps it NULL, and it is cleared again the moment a subscription
-- stops entitling the account.
--
-- This is a *secondary* lookup key, not the primary one. A PayPal event is
-- attributed to a user by `custom_id` (the user id, set when the subscription
-- is created); this column exists so a cancellation has an id to act on, and
-- so an event whose custom_id is missing can still find its account.
ALTER TABLE users ADD COLUMN paypal_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_paypal_subscription ON users(paypal_subscription_id);
