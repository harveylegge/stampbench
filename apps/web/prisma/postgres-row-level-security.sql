-- Run after migrating the Prisma schema to PostgreSQL.
-- The application role must NOT own these tables and must not have BYPASSRLS.
-- Each request transaction must first run:
--   SELECT set_config('app.user_id', '<authenticated user id>', true);

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageEvent" FORCE ROW LEVEL SECURITY;

CREATE POLICY session_owner ON "Session"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY api_key_owner ON "ApiKey"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY usage_event_owner ON "UsageEvent"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

REVOKE ALL ON "User", "Session", "ApiKey", "UsageEvent" FROM PUBLIC;
