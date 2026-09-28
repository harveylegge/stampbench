-- Migration 004: saved invoices.
-- Apply with:
--   npx wrangler d1 execute stampbench --remote --file=workers/api/migrations/004_saved_invoices.sql
--
-- Safe to re-run: both statements are IF NOT EXISTS.
--
-- One row per invoice a signed-in user chose to save from the generator.
-- `payload` is the builder's draft JSON (the editable form state, NOT
-- generated XML) so a saved invoice reopens exactly as it was left. The
-- summary columns (number, customer, total, currency, market, status) are
-- denormalised copies supplied at save time so the account page can list
-- invoices without parsing every payload.
--
-- Saving is explicitly opt-in — the privacy page discloses this storage the
-- same way it discloses shared reports. Rows are covered by account export
-- (GDPR Art. 20) and deleted with the account (Art. 17).

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

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
