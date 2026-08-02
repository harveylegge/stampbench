# InvoiceGate

**E-invoicing compliance, minus the pain.** Validate and generate XRechnung / EN 16931
e-invoices with a TypeScript-first library and hosted API — with AI-written, plain-language
explanations for cryptic rule violations.

Germany requires every company to be able to *receive* e-invoices since January 2025 and to
*issue* them from January 2027 (2028 for the smallest businesses). France and other EU states
follow. InvoiceGate is the developer-facing layer for that mandate wave.

## Repository layout

```
packages/core     @invoicegate/core — MIT-licensed library (npm)
                  UBL parsing · EN 16931 + BR-DE rule engine · XRechnung generation ·
                  auto-computed totals (BR-CO arithmetic passes by construction)
apps/web          invoicegate.dev — Next.js 15 SaaS
                  landing · playground · docs · auth · API keys · usage metering ·
                  Stripe billing · AI error explanations (Claude) · admin
docs/             architecture, deployment, roadmap, marketing launch pack
```

## Quickstart (local)

```bash
npm install
npm run db:push        # creates SQLite dev database
npm run dev            # http://localhost:3000
```

Zero secrets required: billing, AI, and distributed rate limiting all degrade gracefully
until their env vars are set (see `apps/web/.env.example`).

```bash
npm test               # core rule-engine tests + web tests
npm run build          # full production build
```

## The library

```ts
import { validateUblXml, generateXRechnungUbl, withComputedTotals } from '@invoicegate/core';

const result = validateUblXml(xml, { profile: 'xrechnung' });
// → { valid, violations: [{ ruleId: "BR-DE-15", severity: "error", message: "…" }] }

const invoice = withComputedTotals({ seller, buyer, lines, … });
const xml = generateXRechnungUbl(invoice); // XRechnung 3.0 UBL
```

## The API

```bash
curl -s https://invoicegate.dev/api/v1/validate \
  -H "Authorization: Bearer ig_live_…" \
  -H "Content-Type: application/xml" \
  --data-binary @invoice.xml
```

Endpoints: `POST /api/v1/validate`, `POST /api/v1/generate`, `POST /api/ai/explain`.
Full reference: [/docs](https://invoicegate.dev/docs) (or `apps/web/app/docs/page.tsx`).

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment guide](docs/deployment.md) — Vercel + Neon + Stripe + Anthropic
- [Roadmap](docs/roadmap.md)
- [Marketing launch pack](docs/marketing/)

## Positioning honesty

InvoiceGate is developer tooling, not legal advice. Rule coverage is a documented subset of
EN 16931 + XRechnung (see the docs page); for certification-grade sign-off also run the
official KoSIT validator — InvoiceGate's job is that by the time you run it, it passes.

## License

`packages/core` is MIT. The `apps/web` application is proprietary.
