# Session handoff — read this first

**Last updated:** 2026-08-11 · **Repo:** `C:\Users\harvey\Downloads\invoicegate` (git, clean) ·
**LIVE:** `stampbench@0.1.0` + `@stampbench/core@0.1.1` on npm; https://stampbench.com on
Cloudflare Pages (wrangler is authed: `npx wrangler pages deploy out --project-name=stampbench`
from `apps/web` after `node scripts/build-static.mjs`).

**Founder-attribution pass 2026-08-05** (commit `8d3d9f2`, for AI/search visibility of
"Harvey Legge, founder of Stampbench"): `author` fields in all three package.json files,
"Created by Harvey Legge" bylines in all three READMEs, Person/Organization/SoftwareApplication
JSON-LD `@graph` + `author`/`creator` meta on stampbench.com (deployed, verified live).
**⏳ One step pending: `npm publish` of `@stampbench/core@0.1.2` and `stampbench@0.1.1`**
(versions already bumped, tests green) so npm shows the author field — blocked on npm's
browser OTP, which only Harvey can complete:
`npm publish -w @stampbench/core --access public && npm publish -w stampbench --access public`

---

## MEDUSA PLUGIN (2026-08-11)

Context: Harvey emailed Medusa about Stampbench; Nicolas (Medusa support) replied
"if you are interested in creating a plugin to have it featured in our integrations
directory, follow these docs" (docs.medusajs.com → Learn → Fundamentals → Plugins).
Built: **`@stampbench/medusa`** in `integrations/medusa/` — a Medusa v2 plugin that
turns Medusa orders into validated XRechnung/EN 16931 UBL.

- **Deliberately outside the npm workspaces** (`packages/*`, `apps/*` untouched):
  its devDeps pull the whole Medusa framework (~1100 packages), which must not tax
  root `npm install`/CI. It has its own install, tests, and build.
- **Shape** (per Medusa's plugin docs, verified against `@medusajs/utils`
  `getResolvedPlugins` — consuming apps read `.medusa/server/src/**`, which is why
  tsconfig sets `rootDir: "."`):
  `src/modules/stampbench/` (service + pure `order-to-invoice.ts` mapper),
  `src/workflows/generate-e-invoice.ts` (`useQueryGraphStep` → generate step),
  `src/api/admin/orders/[id]/e-invoice/route.ts` (XML download, `?format=json`),
  `src/api/admin/e-invoices/validate/route.ts`,
  `src/admin/widgets/e-invoice.tsx` (order-page card: download + compliance badge).
- **Mapping**: line net = `total − tax_total` (promotions stay in the line), shipping
  → BG-21 charges, `metadata.vat_id`/`buyer_reference`/`leitweg_id` honored, delivery
  from shipping address; totals via `withComputedTotals` so BR-CO passes by
  construction. 11 vitest tests incl. a round trip with **0 rule-engine errors** and
  a compiled-CJS smoke test.
- **Core fix that rode along**: `@stampbench/core` exports map only declared
  `"import"`, so CJS consumers (= every Medusa app) couldn't `require()` it even on
  Node ≥20.19 (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Added `"default"` condition in
  `packages/core/package.json` — ships with the already-pending 0.1.2 publish.
  Plugin engines: `node >=20.19` (first line with `require(esm)`).
- **Keywords for the integrations directory** are set (`medusa-plugin-integration`,
  `medusa-v2`, …) per their docs.

**⏳ Publish order (blocked on Harvey's npm OTP, same as before):**
1. `npm publish -w @stampbench/core --access public` (0.1.2 — the plugin depends on `^0.1.2`)
2. In `integrations/medusa/`: `npm install && npm run build && npm publish --access public`
3. Reply to Nicolas with the npm link so it gets featured.

Until core 0.1.2 is on npm, local dev in `integrations/medusa` needs
`npm pkg set 'dependencies.@stampbench/core=file:../../packages/core'` before
`npm install` (revert before committing — README "Local development" documents it).

---

## GENERATOR IS NOW THE DOCUMENT (2026-08-10, second pass)

Harvey asked for the invoice-generator.com shape: type on the invoice, actions in
a right rail. The form-beside-preview layout is gone — the fields now sit where
their values print, and there is one document rather than two views to drift
apart. **248 tests** (136 library / 50 CLI / 62 web).

- **Layout**: document left, rail right on `lg`; below that the rail **stacks
  first** (`order-first lg:order-none`) so "Create invoice" is never buried
  under a full invoice. Page prose moved *below* the editor on
  `/invoice-generator` and the four market pages. Nav label is "Create invoice".
- **Compliance fields live in `<DocDetails>` disclosures** under the block they
  belong to (VAT ids, contact, electronic address, payment). Each shows a warning
  dot when the chosen ruleset needs something inside it that is missing.
- **Tax is one document-level rate** that rewrites every standard-rated line;
  lines that disagree make it read "Mixed" rather than silently flattening them.
  **There is deliberately no flat-amount toggle**: BR-S-09 requires tax to equal
  taxable × rate, so a lump sum could not be a valid EN 16931 document. The
  screenshot's ⇄ moved to Discount, where percent↔amount *is* supported.
- **Discount and Shipping are real** BG-20/BG-21 allowance/charge entries, so
  they join the VAT group before tax is computed (verified: VAT lands on the
  post-discount taxable amount, not the raw subtotal). **Amount paid** is BT-113
  and drives BT-115 balance due.
- **⚠️ BG-13 delivery added to the engine** (`model` + UBL writer *and* parser +
  tests) so "Ship to" is structured data rather than another print-only field.
  `cac:Delivery` sits between the parties and PaymentMeans — UBL sequences are
  ordered, and there is a test pinning that position.
- **AI assist** (`/api/ai/draft`) turns plain English into line items only. The
  system prompt forbids tax rates, VAT numbers, addresses and dates, and the
  handler re-validates the shape server-side. Same dormant key and credit jar as
  the explainer, so it is off until `ANTHROPIC_API_KEY` is set — and the button
  says so rather than pretending.
- **Migration guard**: `loadDraft()` merges a saved draft over a fresh one. A
  draft written by the previous build has no `discount`, and the totals code
  reaches into `discount.enabled` — without this it throws on mount and takes
  the editor with it. Tested.
- Logo upload is data-URL, capped at 400 kB, and labelled print-only (EN 16931
  has no logo field).

---

## INVOICE GENERATOR (2026-08-10) — Stampbench now creates as well as checks

`/invoice-generator` (+ `/invoice-generator/{uk,germany,eu,us}`) is a real
create → validate → repair → export loop, not a PDF form. All client-side, free,
no account. **237 tests green** (132 library / 50 CLI / 55 web).

- **Exact money, in the engine.** `packages/core/src/money/` does integer
  minor-unit arithmetic with half-away-from-zero rounding and — importantly —
  scales by shifting the decimal *string* exponent, because `1.005 * 100` is
  `100.49999999999999` and rounds a VAT amount a cent low. Prices are held at
  `PRICE_SCALE` (4dp) so a genuine €0.335 unit price is not flattened to €0.34
  before multiplying. The builder's on-screen totals and the XML's BT-106 come
  from this one code path, and a test asserts they agree.
- **`generateUblInvoice(invoice, { profile })` / `withProfileDefaults`** —
  BT-24 now follows the profile instead of always claiming the XRechnung
  customization id. `generateXRechnungUbl` is unchanged and byte-identical
  (tested), so nothing existing moved.
- **⚠️ Fixed a documented-but-absent API parameter.** `/api/v1/validate` and
  `/api/v1/generate` hard-coded `profile: 'xrechnung'` while /docs documented a
  `profile` parameter. The worker now reads it (body or query), rejects unknown
  values, and still defaults to `xrechnung` so existing integrations are
  unaffected. The docs' stale `rulesRun: 42 / 2026-08.1` example is now 56 /
  2026-08.2.
- **The honesty surface is the product here.** `lib/invoice/formats.ts` lists
  ZUGFeRD/Factur-X, Peppol BIS and FatturaPA as **not implemented with the
  reason** (the engine has a UBL writer and no CII writer) rather than omitting
  them; `commercial` is a real format with `validationProfile: null` that gets
  JSON + print and explicitly **no verdict**. US sales tax is typed in, never
  determined. Tests enforce this: a non-`supported` format without a stated
  limitation fails, as does a `'context'` capability without a note.
- **The compliance rail is derived from real rules.** `requirementChecks()`
  mirrors the VAT-category `-02`/`-10` families and the BR-DE requirements, so
  each checklist row names the rule that will fire. Selecting reverse charge
  greys the rate, demands the buyer's VAT id and an exemption reason — all
  three enforced by the engine, none invented by a designer.
- **Repair is honest about being idle.** Because the generator computes totals
  by construction, arithmetic rules cannot fail on a document it built — so the
  panel says exactly that and points back to the editor, rather than dangling a
  Fix button that always reports nothing to do.
- **Six templates, all fictional companies, all validating.** A test generates
  every one and asserts zero errors under its own ruleset. Writing them found a
  real property worth knowing: **every VAT category's `-02` rule requires the
  seller to carry BT-31 or BT-32**, so a genuinely unregistered trader cannot
  produce a valid EN 16931 invoice without a tax reference — the freelance
  template uses category O plus a UTR and says so.
- **PDF is the browser's print-to-PDF** via a print stylesheet in globals.css
  (A4, everything hidden except `#invoice-preview`). No rendering library was
  added to be able to claim the feature.
- **Known gap, deliberate:** the semantic model has no BG-13 delivery
  information, so the delivery-date field says on its own hint that it prints
  but is not written into the XML. Add BT-72 to the model to close it.
- **Not built:** saved invoice history, versioning, bulk CSV, recurring
  invoices, webhooks. All need D1 schema + authed worker endpoints; drafts are
  localStorage-only today (and say so). Analytics still deliberately absent —
  see the privacy note below.

---

## PAYPAL (2026-08-11) — link path shipped; Subscriptions is the real answer

Harvey set up PayPal instead of activating Stripe. **The dormant Stripe stack
(checkout / signed webhook / portal) is Stripe-only and does not work with
PayPal** — so PayPal is wired into the *manual* upgrade loop instead.

**Shipped and live behind one secret.** Set any of these as Pages secrets on
the `stampbench` project and PayPal turns on with no redeploy:
- `PAYPAL_ME` — a PayPal.me handle (`harveylegge`, `@harveylegge` or the full
  URL all work). The plan price is appended: `.../29GBP`.
- `PAYPAL_LINK_STARTER` / `_PRO` / `_SCALE` — per-plan payment or subscription
  links; these win over `PAYPAL_ME` where set.

What it changes: `POST /api/upgrade` now returns `payUrl`, the account page
shows a **Pay £N with PayPal** button immediately instead of "we'll email
you", `/api/billing/status` reports `{ enabled, paypal }`, and the operator
email says *check PayPal first* with both PowerShell and bash activation
commands. Activation is still a human step — a PayPal.me payment carries no
reliable buyer reference, so nothing auto-grants a plan. That is deliberate.

**The decision that matters (researched 2026-08-11, 4 agents against PayPal's
published OpenAPI spec):** of the four PayPal products, **only PayPal
Subscriptions actually recurs**. Payment links, PayPal.me, Invoicing and
Standard Checkout are all *manual-repeat* — the customer must consciously pay
again every month, and none of them emit a usable cancellation signal, so
churn has to be inferred from absence with a cron job. For a £29/£99 self-serve
tier that halves LTV versus card-on-file.

If/when we want real MRR through PayPal, the target is:
`POST /v1/catalogs/products` → `POST /v1/billing/plans` (×3, GBP, one currency
per plan) → `/activate`; then a Worker route that calls
`POST /v1/billing/subscriptions` with **`custom_id` = the Stampbench user id**
(this is the only reliable link from a PayPal event back to an account) and
302s the browser to the `approve` link. Grant on the webhook, never on
`return_url`. Events: `BILLING.SUBSCRIPTION.ACTIVATED` (grant),
`.CANCELLED` / `.SUSPENDED` / `.EXPIRED` (revoke),
`PAYMENT.SALE.COMPLETED` (renewal — note it is SALE, not CAPTURE; capture is
Orders v2 and several 2026 blogs get this wrong), `BILLING.SUBSCRIPTION.PAYMENT.FAILED`.
Signature verification: `POST /v1/notifications/verify-webhook-signature` is
an outbound call per webhook (fine on Workers, ~200-400ms); the local-crypto
alternative needs hand-rolled CRC32 + X.509→SPKI parsing because WebCrypto
`importKey` only takes `spki`. Requires a **Business** account; sandbox and
live have entirely separate credentials, plan ids and webhook ids.

Fees to model honestly: ~2.9% + £0.30 domestic UK, **plus 1.29% (EEA) or 1.99%
(rest of world)** — a dev tool sold in GBP takes a lot of US traffic, so budget
~5%, not 2.9%. Worse than Stripe UK. Not a reason to avoid PayPal, but a reason
not to assume it is cheap.

---

## MARKET-AWARE UX (2026-08-10) — Stampbench is no longer "the German validator"

The product read as Germany-only to anyone who was not German, which cost us every
UK/US visitor at first glance. The fix was information architecture, not paint.

**The one idea:** the engine has always had two profiles — `en16931` (**40** rules,
the European core) and `xrechnung` (**56** = those plus 16 BR-DE rules) — and the UI
hard-coded `xrechnung` everywhere. Markets are now the user-facing name for that
choice, so "is this for my business?" has a real answer instead of a guess.

- **`apps/web/lib/markets.ts` is the single source of truth**: five markets, the
  profile each maps to, and an honest capability matrix including what is *not*
  implemented (no UK/US ruleset, no tax-rate determination, no Peppol transmission —
  anywhere). Rule counts are duplicated there as constants so the engine does not get
  bundled into the landing page; **`tests/web.test.ts` asserts them against
  `rulesForProfile()`**, so the marketing numbers cannot silently drift. A `'context'`
  status without an explanatory note is a test failure.
- **Homepage**: English hero is market-neutral ("Make your invoices pass. In whichever
  market you bill."), followed immediately by a market-picker band. **`/de` is
  untouched in framing** — it keeps the XRechnung hero, the BR-DE-15 demo and its
  German SEO, because a reader who arrived in German already answered the market
  question. The hero demo's two rule ids now come from copy for exactly that reason.
- **New routes, all additive**: `/markets` (the full comparison matrix, gaps included)
  and `/markets/{uk,us,eu,germany}`. `/markets/germany` is where XRechnung/ZUGFeRD
  keywords live in English. Every pre-existing URL still returns 200 — verified.
- **Playground**: market switcher, profile follows the market, the result states
  *"Checked against …"* (ruleset, rule count, spec version, ruleset version), and
  BT-24 detection **offers** a switch when the document declares XRechnung but a
  non-German market is selected — it never re-rules the document silently. `/playground`
  defaults to EU, `/de/playground` to Germany; the choice persists in `localStorage`
  (`sb_market`), no account involved. Generation now sets BT-24 from the market instead
  of always claiming the German customization id.
- **Numbers refreshed to measured values**: 192 tests (113 library / 50 CLI / 29 web),
  growth chart extended to Aug 10 with the same `git grep` method its comment
  documents. The docs page's stale `rulesRun: 42 / 2026-08.1` example is now 56 / 2026-08.2.
- **Deliberately NOT done: analytics.** /privacy states plainly that we run no
  analytics scripts at all. Market-selection events would be genuinely useful, but not
  at the cost of contradicting a published privacy promise — if Harvey wants them,
  privacy has to change first, deliberately. Same reasoning as the playground-usage
  measurement gap.
- **Deliberately NOT done: an AI invoice assistant.** The dormant AI explainer is
  unchanged. The generate tab now states which fields are never invented, which is the
  honest place for it to grow later; nothing markets an AI feature that is switched off.

---

## ACCOUNTS ARE LIVE (2026-08-07) — architecture changed, read this

The static site now has working accounts WITHOUT the dormant Next.js server. A
Cloudflare Pages "Advanced mode" worker (`out/_worker.js`, source `workers/api/`,
bundled by `node workers/api/build.mjs` AFTER the static build) serves `/api/*` on
stampbench.com; `_routes.json` keeps static assets off the worker. Storage is D1
(`stampbench`, id 4f806127-8134-4b60-9722-afa13a0a46c7, schema `workers/api/schema.sql`).
Secrets (JWT_SECRET, ADMIN_SECRET) are bound to the Pages project; Harvey's copy is in
`.env.local` (gitignored). A second worker `stampbench-mailer` (send_email binding, no
route) emails harveypro3@gmail.com on upgrade requests via service binding MAILER.

**Deploy sequence now:** `node apps/web/scripts/build-static.mjs` →
`node workers/api/build.mjs` → `npx wrangler pages deploy out --project-name=stampbench`
(from apps/web). Forgetting the worker step deploys a site with no API.
Same sequence also runs in CI: `.github/workflows/deploy.yml` deploys on every
push to main (or manually via the Actions tab) once the `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID` repository secrets are set.

What exists: /signup /signin /account (keys, usage bars, upgrade requests), mobile
hamburger nav, playground Fix-automatically (free, client-side), Share-report
(metered: free 10/mo) with public viewer at /report?id=…, future-ruleset check
(metered: free 5/mo), hosted REST API /api/v1/validate|generate|fix (Bearer
sb_live_… keys, free 100/mo per pricing page). Quotas in `apps/web/lib/plans.ts`
FEATURE_LIMITS — the worker imports that file, single source of truth.

**Stripe self-serve billing BUILT 2026-08-09, DORMANT** (same pattern as the AI jar).
Upgrade-only: the account must exist, then `/api/billing/checkout` starts a Checkout
session and the **signed webhook** at `/api/stripe/webhook` is the only thing that
changes a plan — the browser can never grant entitlement. `/api/billing/portal` gives
customers self-serve card changes and cancellation. Plan mapping reads
`metadata.plan_id` off the Stripe price (already set on the three test-mode products),
so there are no price ids in env vars. `past_due` drops to free. To activate: complete
Stripe onboarding (the live account is **not** activated — `charges_enabled: false`),
mirror the three products into live mode, then set Pages secrets `STRIPE_SECRET_KEY`
and `STRIPE_WEBHOOK_SECRET` and register the webhook endpoint for
`checkout.session.completed` + `customer.subscription.*`. Until both secrets exist,
`/api/billing/status` reports `enabled:false` and the pricing/account pages fall back
to the manual Request path automatically.

**The manual path still exists** as the fallback: user clicks Request → D1 row + email
to Harvey → Harvey arranges payment → activates with the admin command in `.env.local`.
The legacy Next.js (auth)/dashboard/api tree is now SUPERSEDED by this worker (it
still builds for `npm run dev` but nothing links to it; retire it when convenient).

**AI "credit jar" built 2026-08-08, DORMANT.** /api/ai/explain + /api/ai/status exist;
one shared Anthropic key (Pages secret ANTHROPIC_API_KEY, unset), per-user 'ai' quotas
in FEATURE_LIMITS (5/100/400/1500), global cap 10,000/mo (usage row user_id='__global__'),
both meters refunded on upstream failure. Default model claude-haiku-4-5 (AI_MODEL env
overrides). Playground's "Explain with AI" button renders only when status says enabled.
Uses @anthropic-ai/sdk (root dep); worker bundling externalizes node:* and the Pages
project runs compatibility_flags=["nodejs_compat"] — REMOVING that flag breaks the
worker. To activate: set the secret via the Pages API/dashboard, redeploy.

**Security + GDPR pass 2026-08-09.** Rate limiting on login (per IP *and* per email),
register, checkout and admin, in a new `rate_limits` D1 table (fails open on DB error
so a blip cannot lock everyone out). Login now hashes against a dummy credential when
the email is unknown — previously the *timing* leaked which addresses were customers
even though the message was neutral. Admin secret compared in constant time; the
same-origin guard covers every state-changing method (not just POST) and no longer
carries a blanket `localhost` allowance; HSTS + `base-uri`/`object-src`/`form-action`
added. **GDPR:** `/api/account/export` (Art. 20), `DELETE /api/account` (Art. 17,
cancels any live subscription first and refuses rather than orphaning it), and
per-report deletion — all surfaced in a "Your data" section on /account.
**The worker is now typechecked**: it had no tsconfig, so esbuild was stripping types
unchecked; `workers/api/build.mjs` now runs `tsc --noEmit` and refuses to bundle on
error. Migration `workers/api/migrations/002_security_and_billing.sql` is **already
applied to remote D1**.

Known gaps, deliberate: no email verification, no self-serve password reset (mailto
support), no per-minute rate limiting on the hosted API (monthly quota only), German
/de playground shows the three new panels in English, upgrade-email deliverability to
harveypro3 not yet eyeball-confirmed (mailer reports mailed:true; Gmail MCP here is
connected to HarveyJLegge@gmail.com so the destination inbox is not visible).
**Legal pages filled 2026-08-07** with Harvey's answers (sole trader Harvey Legge t/a
Stampbench, England & Wales, £100 cap, no VAT, hello@ everywhere) and corrected to the
real architecture (no Stripe/Vercel/Neon claims; shared-report storage disclosed).
**Still outstanding, Harvey-only: (1) postal address + phone — he is arranging a
virtual office; the only `<Fill>`s left are those two, in all three pages; (2) a
solicitor review before actively promoting signups/paid plans in Germany.**

---

## 1. What this is, in one paragraph

A developer-first **e-invoicing compliance** business. An MIT-licensed TypeScript library
(`@stampbench/core`) plus a CLI (`stampbench`) validate and generate structured e-invoices
(EN 16931 / XRechnung / ZUGFeRD-Factur-X), with a Next.js SaaS on top (playground, hosted API,
accounts, metering, Stripe billing, AI error explanations). Chosen over 39 other ideas by a
15-agent research workflow because demand is **legally forced** (Germany: receiving mandatory
since Jan 2025, issuing from Jan 2027; France follows), the TypeScript lane is genuinely empty
(the ecosystem is Java — KoSIT, Mustang, phive), and distribution is `npm publish` rather than
an app-store gauntlet.

**Harvey's actual goal:** recurring revenue with near-zero ongoing personal involvement.
He has two prior finished-but-never-launched products, so *every* founder-gated manual step is
a real risk — the plan is built to batch them into one session.

---

## 2. Current state — what exists and works

| Package | What | Tests |
|---|---|---|
| `packages/core` | Rule engine: UBL **and** CII parsing, EN 16931 + VAT families + BR-DE rules, XRechnung generation, auto-computed totals, versioned rulesets + regression diff, source-position index + violation→line locator (`src/locate/`), **in-place repair** (`src/fix/`) | 110 ✅ |
| `packages/cli` | `validate`, **`fix`**, `generate`, `regress`, `rulesets` — CI exit codes, `--format github\|sarif`, multi-file, `--fail-on` | 49 ✅ |
| `apps/web` | Landing, playground, docs, auth, API keys, metering, Stripe, trust/security/legal pages | 6 ✅ |
| `action.yml` | Composite GitHub Action wrapping the CLI | — |
| `tools/parity` | KoSIT parity harness (pinned validator 1.6.2 + XRechnung 3.0.2 corpus) | — |

**165 tests green. Production build clean. All flows browser-verified locally.**
(Root `npm test` now includes the CLI workspace — it previously skipped it.)

**Two facts to reuse, both measured, both load-bearing:**
- `parse → generate` retains only **74.1%** of elements (45 UBL corpus docs; 72
  element names lose content). Never "repair" or round-trip a customer document by
  regenerating it — edit the original text using `src/locate/` positions.
- Repair on the official suite: **248/248 corrupted derived figures restored to
  valid, 186 (75%) byte-identical** to the pristine original.

### Verified facts (do not re-derive; these are on the public /trust page)
- 68 tests total (44 core / 18 CLI / 6 web)
- **86 official XRechnung 3.0.2 test-suite instances** run (45 UBL, 41 CII): **83 accepted,
  3 flagged, 0 crashes**. The 3: `05.01a-INVOICE_ubl` (BR-CO-16), and both
  `01.05_minimal_test` UBL+CII (BR-DE-16) — published openly as divergence candidates.
- 56 rules in the `xrechnung` profile, 40 in `en16931`. Ruleset `2026-08.2`.
- KoSIT **parity dual-run has NOT run** (needs Java; CI-only). **Never claim a parity %.**

### Run it
```bash
npm test                    # all suites
npm run dev                 # http://localhost:3000
npx stampbench regress ./invoices --from en16931@2017 --to xrechnung@3.0
```

---

## 3. Strategy of record (CEO plan, 2026-08-03)

**Win the trust layer, then charge for staying current.** Sequenced so nothing markets
before it can be trusted. Full detail in `docs/roadmap.md`.

- **Library-first, not SaaS-first.** Developers adopt the npm package; they will not send
  invoice bytes to a stranger's API. The SaaS shell is built but deliberately dormant.
- **Pricing of record:** Free £0 / **Developer £29** / **Agency £99** (unlimited client
  projects — the only segment with 2026 urgency) / **Platform £299** usage-based with
  DPA+SLA. Internal plan ids stay `starter`/`pro`/`scale` so Stripe env vars don't churn.
- **Honesty as strategy.** We publish our own divergences and say plainly what we haven't
  proven. This is the one thing free/incumbent competitors structurally won't copy.
- **The differentiator (verified gap, shipped):** future-ruleset **regression testing** —
  "which of my invoices break when the next spec lands?" 68 searches across Invopop,
  InvoiceXML, Storecove, Avalara, Sovos, Fonoa, Vertex, Basware, Pagero, ecosio, KoSIT,
  Mustang, phive found **nobody selling it**; incumbents are explicitly reactive.
- **Rejected after research** (don't rebuild): Peppol participant lookup (free from
  OpenPeppol + 6 vendors), per-rule explainer pages (a competitor already ships 1,388).

---

## 4. ✅ The rebrand — RESOLVED 2026-08-04: **Stampbench**

**Stampbench** was chosen (stampbench.com + npm `stampbench` + `@stampbench/core` all verified free at decision time). The repo folder on disk is still `Downloadsinvoicegate`; only the product/package names changed. History below kept for the record. Two research rounds done; the checking method is proven and reusable.

### Method (reuse it — it works)
`scratchpad/rdap-check.mjs` queries **Verisign RDAP** (authoritative for `.com`):
404 = available, 200 = taken. Validated against controls. Then web-screen survivors for
company/product/trademark/linguistic collisions.

### Round 1 — 208 generated → 41 available .com → 16 screened → **5 clean**
`.com` **and** npm both free for all five (re-verified):
**Kodrel** ⭐ (`kod` = "code" in PL/SV/TR — free dev semantics), **Naxeri** (blankest slate),
**Zelkiro**, **Okvela**, **Ovreka**.

### Round 2 — 150 generated → **48 available .com, NOT YET SCREENED**
Screening died on a usage limit. The 48:
`audrek bokren deklis doknis dokren doksim dutren emtrik faktel faktrel faktun fatren fidnis
fidven kodlen kodnis kodrem kwiten kwitum narmant nodrim nodsem nodven nomrik numrek numrel
ordnis prufant prufel regtum regvel reknel rekner reknim reknis sekren sigdem skedim skemant
skemin sumrek sumrel tokdim tokren tregant tregum vatken`
Strongest 16 by brand fit (the batch that didn't finish): Faktel, Kodrem, Prufel, Rekner,
Skemin, Tokren, Emtrik, Sekren, Fidven, Numrel, Regtum, Ordnis, Audrek, Doksim, Kwitum, Sumrel.

### Names killed by screening — do not resurrect
Kvarno (**Slovenian for "harmfully/corruptly"** + Kvarn X fintech), Nastren (**NASTRAN**, NASA
trademark), Ekvano (**active Norwegian company**), Kivaren (Swedish "the quarreler" + **Kivra**,
Swedish invoice platform), Tekalor (**tecalor GmbH** homophone, German market), Zaltrik
(`trik` = "trick" in HR/SI), Vekril (pharma `-ril` stem), Tabren (Tabs/Tabby fintech),
Kondrax, Elmarik, Delkaro, Loketra, Norkiva, Halkur, Lavriko, Ilvenko, Serdako, Kolvano,
Nekvara. Round-1 word-names also all blocked (Certo, Prova, Faktum, Kodex, Verto, Ordo…).

**Caveat:** RDAP proves *unregistered*, not *unpriced*; and none of this is formal trademark
clearance. Budget a paid EUIPO/DPMA search in Nice classes 9/35/36/42 before filing.

---

## 5. What's left — in leverage order

### Blocked on Harvey (one ~3-hour session; batch them all)
1. Pick the name → buy domain
2. `npm publish` `@stampbench/core` + `stampbench` (both names verified free).
   **This also switches on the GitHub Action**, which runs `npx stampbench@<version>` —
   the Action is written and tested but cannot resolve the package until it is published.
3. Deploy: Vercel + Neon Postgres (switch the `provider` line in `prisma/schema.prisma`,
   set `SESSION_SECRET` + `DATABASE_URL`). **Vercel MCP can deploy directly — no GitHub needed.**
4. Fill the amber `<Fill>` placeholders in `/terms`, `/privacy`, `/impressum`, then have a
   solicitor review (Impressum is legally required for the German market)
5. Stripe live keys + 3 prices; `ANTHROPIC_API_KEY` for live AI explanations
6. GitHub repo → unlocks the CI parity run (needs Java) and the GitHub Action

### Agent-executable (no credentials needed)
- ~~CI PR annotations~~ — **SHIPPED 2026-08-03.** See `docs/ci-annotations.md`.
  Measured 100% of violations anchored to a real element (27.1% exact), 0% falling back
  to the document root, over 9,983 field-deletion mutations of the official corpus.
  **Two corrections came out of building it — read `docs/roadmap.md` before repeating
  the old pitch:** (1) the "GitHub Marketplace has zero invoice-validation Actions"
  claim is refuted in substance by `hernaninverso/validate-einvoice-action`; (2)
  **eleata.io is a direct competitor** occupying nearly the identical position since
  ~2026-06-30 (hosted API + MIT CLI + Action + MCP server + same messaging).
- Rule-indexed **invalid-fixture generation** (`give me an XRechnung violating BR-DE-15`)
- **JSON-Patch remediation** with per-hunk rule provenance (nobody returns a reviewable patch)
- Factur-X **PDF generation**; France as country #2; hosted batch regression endpoint

---

## 6. Gotchas that will bite a new session

- **Prisma DLL lock:** `npm run build -w web` fails with `EPERM … query_engine-windows.dll.node`
  while the dev server runs. Stop the preview server first. Not a code bug.
- **`.env`** in `apps/web` is gitignored; local dev needs `DATABASE_URL="file:./dev.db"`.
- **CSP + dev:** `next.config.ts` adds `'unsafe-eval'` only in development — webpack needs it.
  Removing it silently breaks React hydration (buttons stop working, no console error).
- **Never claim** KoSIT parity %, SOC 2, uptime, or customer counts. The `/trust` page's
  credibility rests on this.
- Marketing pack in `docs/marketing/` predates the CEO plan; `pricing-rationale.md` is marked
  superseded. Trust `docs/roadmap.md` + `apps/web/lib/plans.ts` as current.

---

## 7. Suggested opening message for the new chat

> Continuing Stampbench (`C:\Users\harvey\Downloads\stampbench`). Read `docs/HANDOFF.md`
> first, then `docs/roadmap.md`. Next task: **<pick one — finish the name screen / build CI PR
> annotations / prep the 3-hour founder session checklist>**.
