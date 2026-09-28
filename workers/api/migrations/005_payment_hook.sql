-- Per-account inbound payment webhook (auto-invoicing).
--
-- The token itself is never stored — only its SHA-256 hash, exactly like API
-- keys. A user has at most one hook; rotating replaces the hash, deleting
-- nulls it. Apply to remote D1 BEFORE deploying worker code that uses it:
--   npx wrangler d1 execute stampbench --remote --file=workers/api/migrations/005_payment_hook.sql
-- and verify with:
--   SELECT name FROM pragma_table_info('users') WHERE name = 'payment_hook_hash';
ALTER TABLE users ADD COLUMN payment_hook_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_users_payment_hook ON users(payment_hook_hash);
