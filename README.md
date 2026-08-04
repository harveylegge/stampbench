# Stampbench

**E-invoicing compliance, minus the pain.** Validate and generate XRechnung / EN 16931
e-invoices with a TypeScript-first library and hosted API — with AI-written, plain-language
explanations for cryptic rule violations.

Germany requires every company to be able to *receive* e-invoices since January 2025 and to
*issue* them from January 2027 (2028 for the smallest businesses). France and other EU states
follow. Stampbench is the developer-facing layer for that mandate wave.

## Repository layout

```
packages/core     @stampbench/core — MIT-licensed library (npm)
                  UBL + CII (ZUGFeRD/Factur-X) parsing · EN 16931 rule engine incl.
                  VAT category families (BR-S/E/AE/Z/K/G/O) + BR-DE · XRechnung
                  generation · auto-computed totals (BR-CO passes by construction)
packages/cli      stampbench — `npx stampbench validate invoice.xml` (CI-friendly
                  exit codes) and `generate` from JSON
tools/parity      KoSIT parity harness — dual-runs our validator against the official
                  reference validator over the public XRechnung test suite
apps/web          stampbench.com — Next.js 15 SaaS
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
import { validateXml, generateXRechnungUbl, withComputedTotals } from '@stampbench/core';

const result = validateXml(xml); // auto-detects UBL or CII (ZUGFeRD/Factur-X)
// → { valid, syntax: "cii", violations: [{ ruleId: "BR-DE-15", severity: "error", … }] }

const invoice = withComputedTotals({ seller, buyer, lines, … });
const ubl = generateXRechnungUbl(invoice); // XRechnung 3.0 UBL
```

## The CLI

```bash
npx stampbench validate invoice.xml     # exit 0 = valid, 1 = errors — CI-ready
npx stampbench validate ./invoices      # a whole folder
npx stampbench generate invoice.json -o invoice.xml
```

## Repair — not just "your invoice is invalid"

Every validator tells you a document is wrong. `fix` answers the next question:

```bash
npx stampbench fix ./invoices --write
```

```
rechnung-2026-08.xml
  fix   line 77    BR-CO-17, BR-S-09  99.99 → 22.04
  fix   line 91    BR-CO-16  999.00 → 336.90
  keep            BR-DE-15  no derivable correct value — this needs a human decision, not arithmetic
2 fixes applied, 1 error needing a person
```

It edits the wrong value **in your file** and nothing else — formatting,
comments, namespace prefixes and every element we don't model stay byte-for-byte
intact. It never regenerates the document (that would discard 26% of it), and it
never invents business data: a missing VAT ID has no computable answer, so it is
reported, not guessed.

Measured on the official XRechnung suite — corrupt a derived figure in each of
the 83 clean documents: **248/248 repaired to valid, 186 of them byte-identical
to the pristine original.** [How it works, and its limits](docs/fixing.md).

## In CI — on the failing line

```yaml
- uses: actions/checkout@v4
- uses: stampbench/stampbench@v1
  with:
    paths: ./invoices
```

Violations are anchored to the line **and column** of the offending element, so a
broken invoice annotates the pull request where the problem is instead of dumping
a log:

```
  78 |       <cbc:TaxAmount currencyID="EUR">99.99</cbc:TaxAmount>
     |       ^ BR-CO-17 — tax amount should be 22.04 (314.86 × 7%) but is 99.99.
```

Most rules fire because a field is *missing*, and a missing element has no line —
so those annotations point at the nearest enclosing element and **say that they
are approximate**. Measured across 9,983 single-field deletions over the official
XRechnung corpus: 100% of violations anchor to a real element, 27.1% to the exact
element or attribute, none to the document root.

`--format sarif` uploads to GitHub code scanning; `--format json` gives the same
locations for any other pipeline. See [CI annotations](docs/ci-annotations.md).

## Regression testing — the bit nobody else does

Rule sets change on a published schedule, and the artefacts are released *before* they
become binding. So test the future rather than being switched onto it:

```bash
npx stampbench regress ./invoices --from en16931@2017 --to xrechnung@3.0
```

```
3 documents would START failing under XRechnung 3.0.

Fix these rules first (most documents affected):
  BR-DE-15     3 documents  Missing buyer reference (BT-10)…
  BR-DE-2      3 documents  XRechnung requires a seller contact (BG-6)…

5 checked · 3 regressions · 0 improvements · 2 unchanged pass · 0 unchanged fail
```

Exits `1` on any regression, so CI fails the build the day a new rule set lands — not on
the enforcement date. Register a new specification release with `registerRuleset()` the
day it is published; superseded rule sets stay available so you can re-check historical
invoices against the rules that were in force when you issued them.

## The API

```bash
curl -s https://stampbench.com/api/v1/validate \
  -H "Authorization: Bearer ig_live_…" \
  -H "Content-Type: application/xml" \
  --data-binary @invoice.xml
```

Endpoints: `POST /api/v1/validate`, `POST /api/v1/generate`, `POST /api/ai/explain`.
Full reference: [/docs](https://stampbench.com/docs) (or `apps/web/app/docs/page.tsx`).

## Documentation

- [Architecture](docs/architecture.md)
- [Repair](docs/fixing.md) — what `fix` will and will not change, and why
- [CI annotations](docs/ci-annotations.md) — the GitHub Action, SARIF, and how precise the line numbers are
- [Deployment guide](docs/deployment.md) — Vercel + Neon + Stripe + Anthropic
- [Roadmap](docs/roadmap.md)
- [Marketing launch pack](docs/marketing/)

## Positioning honesty

Stampbench is developer tooling, not legal advice. Rule coverage is a documented subset of
EN 16931 + XRechnung (see the docs page); for certification-grade sign-off also run the
official KoSIT validator — Stampbench's job is that by the time you run it, it passes.

## License

`packages/core` is MIT. The `apps/web` application is proprietary.
