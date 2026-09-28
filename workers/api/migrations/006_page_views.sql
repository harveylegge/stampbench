-- Privacy-preserving page-view counting (aggregate only — no personal data).
-- Apply to remote D1 BEFORE deploying the worker code that writes to it:
--   npx wrangler d1 execute stampbench --remote --file=workers/api/migrations/006_page_views.sql
-- Verify:
--   SELECT name FROM sqlite_master WHERE type='table' AND name='page_views';
CREATE TABLE IF NOT EXISTS page_views (
  day   TEXT NOT NULL,
  path  TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
);
CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day);
