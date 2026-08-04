# Architecture

## System overview

```
                       ┌──────────────────────────────────────────────┐
                       │              apps/web (Next.js 15)           │
 Browser ────────────► │  Landing · Playground · Docs · Dashboard     │
                       │  (App Router, server components, Tailwind 4) │
                       └──────┬───────────────┬───────────────────────┘
                              │               │
 curl / SDKs ───────────────► │  /api/v1/*    │  /api/stripe/*  /api/keys  /api/ai/*
                              ▼               ▼
                       ┌─────────────┐  ┌───────────┐   ┌────────────┐
                       │ @stampbench│  │  Prisma   │   │  Stripe    │
                       │   /core     │  │ SQLite/PG │   │  Anthropic │
                       └─────────────┘  └───────────┘   └────────────┘
```

## packages/core — the rule engine

Pure TypeScript, zero I/O, no framework dependencies. Four parts:

1. **Semantic model** (`model/invoice.ts`) — EN 16931 business terms (BT-x) as typed fields.
2. **Parser** (`parse/ubl.ts`) — UBL 2.1 XML → model via fast-xml-parser (namespace-stripped,
   values kept as strings and converted deliberately). CII documents are detected and
   rejected with a helpful message (roadmap item).
3. **Rule engine** (`validate/`) — each rule is `{ id, severity, profile, check(invoice) }`.
   Registries: `EN16931_RULES` (BR-*, BR-CO-*, IG-* diagnostics) and `XRECHNUNG_RULES`
   (BR-DE-*). Adding a rule = appending one object; the API and docs pick it up automatically.
4. **Generator** (`generate/`) — model → XRechnung 3.0 UBL with schema-ordered elements and
   full escaping. `computeTotals` derives BG-22/BG-23 from lines so BR-CO arithmetic passes
   by construction. `withXRechnungDefaults` keeps model-validation verdicts identical to
   generated-XML verdicts.

Design invariant proven by tests: **generate → parse → validate round-trips clean.**

## apps/web — the SaaS

- **Auth**: email+password (bcrypt cost 12), DB-backed sessions, HttpOnly SameSite=Lax
  cookies, token hashed (SHA-256 + server pepper) at rest. First registered user becomes
  admin. Login/register rate-limited per IP; constant-time email-existence behaviour.
- **API keys**: `ig_live_` + 24 random bytes, SHA-256-hashed at rest, shown once, revocable,
  display prefix stored separately. Auth via `Authorization: Bearer` or `x-api-key`.
- **Metering**: every API call writes a `UsageEvent`; monthly quota = count since UTC month
  start, compared against the plan (lib/plans.ts). 402 with upgrade link when exceeded.
- **Rate limiting**: fixed-window counter; Upstash REST when configured (distributed,
  serverless-safe), in-memory fallback otherwise. Anonymous trial traffic limited per IP.
- **Billing**: Stripe Checkout (subscription mode) + customer portal + webhook that maps
  price ids back to plans. Fully feature-flagged: without keys, the app runs and the billing
  UI explains itself.
- **AI explanations**: `lib/ai.ts` calls Claude (`claude-opus-5`, server-side refusal
  fallbacks enabled) with a compliance-tuned system prompt; deterministic template fallback
  when no key or on any API error — the feature can never hard-fail.
- **Logging**: structured JSON lines to stdout (`lib/log.ts`) — Vercel-native; swap the sink
  later without touching call sites.
- **Security headers**: CSP (script-src 'self' + inline only; dev adds unsafe-eval for
  webpack), frame-ancestors none, nosniff, referrer-policy. XML parsing has no DTD/entity
  resolution (fast-xml-parser), so XXE is structurally absent. 2 MB body cap.

## Data model (Prisma)

`User (plan, role, stripe ids)` → `Session (tokenHash)` · `ApiKey (keyHash, prefix)` ·
`UsageEvent (kind, profile, ok, createdAt)` — indexed on `(userId, createdAt)` for quota
counts and the dashboard.

SQLite locally (zero config); Postgres (Neon) in production — see deployment.md.

## Key decisions & trade-offs

| Decision | Why | Revisit when |
|---|---|---|
| Own rule engine vs wrapping KoSIT/Schematron | TS-native is the differentiator; Java sidecar kills serverless deploys | Rule count makes hand-porting uneconomical |
| Subset coverage, documented | Honest + shippable now; registry makes additions cheap | Certification demand appears |
| DB sessions vs JWT | Instant revocation, simpler mental model | Horizontal scale makes DB reads hot |
| Monthly count(*) quota vs counters | Correct and simple at current scale | >10⁶ events/user/month |
| Custom auth vs Clerk/Auth.js | No third-party signup blockers, full control, fewer moving parts | Team accounts / SSO needed |
