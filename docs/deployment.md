# Deployment guide (Vercel)

The repo is a npm-workspaces monorepo; the deployable app is `apps/web`.

## 1. Database — Neon (or Vercel Postgres)

1. Create a Neon project → copy the pooled connection string.
2. In `apps/web/prisma/schema.prisma` change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Push the schema once from your machine:
   ```bash
   cd apps/web
   DATABASE_URL="postgres://…" npx prisma db push
   ```

> SQLite stays the default in the repo so local dev needs zero setup. The provider line is
> the single switch. (Prisma migrations can replace `db push` once the schema stabilises.)

## 2. Vercel project

- **Root Directory**: `apps/web` (Vercel detects the npm-workspace monorepo automatically).
- **Build command**: default (`npm run build` — runs `prisma generate && next build`).
- Node 20+.

### Environment variables (Production)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon pooled string |
| `SESSION_SECRET` | ✅ | `openssl rand -hex 32` — auth refuses to run without it |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://stampbench.com` |
| `ANTHROPIC_API_KEY` | recommended | enables live AI explanations |
| `STRIPE_SECRET_KEY` | for billing | sk_live_… |
| `STRIPE_WEBHOOK_SECRET` | for billing | from the webhook endpoint below |
| `STRIPE_PRICE_STARTER/PRO/SCALE` | for billing | price ids (see §3) |
| `UPSTASH_REDIS_REST_URL/TOKEN` | recommended | distributed rate limiting across instances |
| `ADMIN_EMAIL` | optional | this email gets the admin role on registration |

## 3. Stripe

1. Create three recurring monthly Prices — Developer £29, Agency £99, Platform £299 — under
   one or three Products → copy the `price_…` ids into the env vars (the env var names keep
   the internal tier ids: STARTER=Developer, PRO=Agency, SCALE=Platform).
2. Add a webhook endpoint `https://<domain>/api/stripe/webhook` with events:
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copy the signing secret.
3. Enable the customer portal (Billing → Portal) so plan changes/cancellations self-serve.

## 4. Post-deploy checklist

- [ ] Register the founder account first (first user = admin), or set `ADMIN_EMAIL` before.
- [ ] `curl -s https://<domain>/api/v1/validate -H "Content-Type: application/xml" --data-binary @invoice.xml` returns violations JSON.
- [ ] Playground validate + generate + AI explain all work.
- [ ] Stripe test-mode checkout completes and the webhook flips the plan (check /admin).
- [ ] `X-Quota-*` headers present on API responses.
- [ ] robots.txt + sitemap.xml resolve.

## 5. Publishing the npm library (the funnel)

```bash
cd packages/core
npm run build && npm test
npm publish --access public        # name @stampbench/core is verified available
```

Alternatively publish the unscoped `stampbench` name as an alias package later.

## Rate-limit note

Without Upstash, rate limiting is per-serverless-instance (in-memory). Fine for launch
traffic; add Upstash before any traffic spike (two env vars, no code change).
