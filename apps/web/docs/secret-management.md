# Production secret management

Store private values in the hosting provider's encrypted secret store. Never put
them in Git, a `NEXT_PUBLIC_*` variable, build arguments, screenshots, support
messages, or browser storage.

Private server-only values:

- `SESSION_SECRET`
- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_TOKEN`

`NEXT_PUBLIC_APP_URL` is intentionally public and contains no credential.
Stripe price identifiers are identifiers rather than secrets, but keeping them
server-side avoids coupling the browser to billing configuration.

Use separate credentials for preview and production. Grant the application
database role only the permissions in `prisma/postgres-row-level-security.sql`;
it must not own tables or have `BYPASSRLS`. Keep migration/admin credentials in
a separate deployment-only secret that the running application cannot access.

Rotate a credential immediately if it appears in source, logs or a screenshot.
Rotate `SESSION_SECRET` to invalidate all sessions after a suspected session
token leak. Stripe, Anthropic and Upstash keys should be restricted at the
provider and rotated there; updating the hosting secret must be followed by a
fresh deployment.

The application stores customer API keys only as SHA-256 hashes. The plaintext
is returned once when created and cannot be recovered from the database.
