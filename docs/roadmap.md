# Roadmap

Strategy of record (2026-08): win the **trust layer** of European e-invoicing for
developers — open-source and provably correct — then charge platforms for staying
current, at volume, with liability posture. Sequenced so nothing markets before it
can be trusted. Supersedes the previous launch-first ordering.

## Phase 0 — The One Founder Session (single 3-hour block; the only credential-gated step)
- [ ] Publish `@invoicegate/core` (+ `invoicegate` alias) to npm
- [ ] Deploy to Vercel (Frankfurt/fra1) + Neon (Frankfurt); domain
- [ ] Legal posture for the German market: Impressum, AVV/DPA template, explicit
      no-retention statement for invoice payloads, AI-explanation opt-in note
- [ ] Stripe live (Developer £29 / Agency £99 / Platform £299)
- After this session, every remaining step is agent-executable.

## Phase 1 — Trust (weeks 1–4). Nothing markets until this ships.
- [x] **CII / ZUGFeRD / Factur-X parsing** — shipped: `validateXml()` auto-detects
      UBL vs CII; full semantic mapping incl. format-102 dates, VA/FC tax schemes.
- [x] **VAT-category rule families** (BR-S / BR-E / BR-AE / BR-Z / BR-K / BR-G /
      BR-O + BR-CO-04) — shipped, with per-rate S arithmetic.
- [ ] **KoSIT parity harness**: dual-run our validator and the official validator over
      the public XRechnung test suite in CI; publish a live zero-divergence page.
      This page IS the launch asset. (Harness in tools/parity; full dual-run in CI.)
- [x] `npx invoicegate validate` CLI — shipped (packages/cli, CI exit codes).
- [x] **GitHub Action + line-level PR annotations** — shipped (`action.yml`,
      `--format github|sarif`). Activates once `invoicegate` is on npm, since the
      Action runs `npx invoicegate@<version>`.
- [x] Playground: drag-and-drop + CII auto-detect (waitlist unnecessary — CII shipped).
- [x] Version-pinned results (`meta.specVersions` in every response).

## Differentiator of record — regression testing (SHIPPED 2026-08-03)
Market check (2 research agents, 68 searches across Invopop, InvoiceXML, Storecove,
Avalara, Sovos, Fonoa, Vertex, Basware, Pagero, ecosio, KoSIT, Mustang, phive):
**nobody sells future-ruleset regression testing.** Incumbents are explicitly
reactive — InvoiceXML: *"your pipeline starts catching regressions the moment they
take effect"* (i.e. in production, on the switchover date). The gap exists because
it contradicts the managed-compliance pitch ("you don't need to test, we handle it").
- [x] Versioned, registerable rulesets (`en16931@2017`, `xrechnung@3.0`, + custom)
- [x] `compareRulesets()` — per-document transitions + rules ranked by blast radius
- [x] `invoicegate regress` / `invoicegate rulesets`, exit 1 on regression for CI
- [ ] Hosted batch endpoint (corpus upload) — CLI is local-first by design; API next
- [ ] Register each new published spec release as a `candidate` ruleset on release day

Also verified and *rejected* as differentiators: Peppol participant lookup (free from
OpenPeppol + 6 vendors — bundle it into validation or skip), per-rule explainer pages
(Invoice Navigator already has 1,388 with failing/fixed XML — generate ours from the
rule engine as a by-product, don't treat as an SEO moat). Still open: rule-indexed
invalid fixture generation.

## In-place repair (SHIPPED 2026-08-04)

`invoicegate fix` — see `docs/fixing.md`. Every competitor tells you the document is
invalid; this answers "what do I change" for the class of failures with exactly one
computable answer (the EN 16931 arithmetic chain), by editing that value in the
user's own file.

**The architectural point, and why it is not trivially copied.** Repair is a *text
edit* at a position computed by `packages/core/src/locate/`, not a regeneration.
Measured: `parse → generate` retains only **74.1%** of elements over the 45 UBL
corpus documents (72 element names lose content, incl. whole `SubInvoiceLine`
trees), so any tool that "fixes" by rebuilding the document destroys a quarter of
it. Doing this safely requires per-element source positions — which is the same
machinery the CI annotations needed, and which a Schematron/XPath engine or a
hosted API that never sees the caller's bytes does not have.

Measured on the official suite: corrupt one derived figure in each of the 83 clean
documents → **248/248 repaired to valid, 186 (75%) byte-identical to the pristine
original**, mean 1.0 passes. Guarded by `packages/core/tests/fix.corpus.test.ts`.

Two invariants are load-bearing and must not be relaxed: never regenerate the
document, and never invent business data (a missing VAT ID has no derivable value;
guessing one converts "invalid" into "quietly wrong", which is worse because it then
passes validation). After editing, the result is re-validated and the whole attempt
discarded if the error count did not fall.

## CI line-level PR annotations (SHIPPED 2026-08-03)

`invoicegate validate --format github|sarif` plus a composite GitHub Action
(`action.yml`). Violations are anchored to the line and column of the offending
element via a source-position index over the raw XML (`packages/core/src/locate/`).
Measured by deleting one required field at a time from all 86 corpus documents
(9,983 mutations → 6,149 violations): **100% anchored to a real element, 27.1%
to the exact element or attribute, 0% falling back to the document root.**
Approximate anchors are labelled as such in every output format.

⚠️ **Correction to an earlier claim — do not restate it.** The previous wording here
was "GitHub Marketplace has *zero* invoice-validation Actions". Adversarial research
(2026-08-03) refuted it in substance:

- **`hernaninverso/validate-einvoice-action` exists** and validates Peppol BIS,
  EN 16931, XRechnung, Factur-X, UBL and CII in CI. It is not *Marketplace-listed*,
  so the literal sentence survives on a technicality — but `uses: owner/repo@v1`
  works from any public repo, so Marketplace listing is not what gates adoption.
  The claim reads as false to any informed reader.
- The Marketplace search index genuinely returns 0 results for invoice, e-invoice,
  xrechnung, peppol and zugferd (control query `lint` returns 597, so the zeroes
  are real) — but that measures a directory, not the competitive landscape.
- The **DIY recipe is published**: torrocus.com has a hand-written workflow that
  curls the KoSIT jar and runs it in ~5 steps. Mustang's CLI does the same. The
  barrier to "validate invoices in CI" is already near zero.

**Say instead:** line-level PR annotations with per-rule remediation, computed
locally, versus today's options — a hand-rolled KoSIT jar workflow or a wrapper
that uploads your invoices to someone else's API. That is defensible and true.

### ⚠️ Direct competitor discovered: eleata.io (Inverso Hub S.R.L.)

Shipped ~2026-06-30, occupying nearly the identical position: hosted validation API,
web validator, MIT CLI (`npx @eleata/validate-einvoice`), GitHub Action, an MCP
server, a Go SDK, an error-code explainer site, and the same "every error comes with
the fix" messaging. Free tier 200 validations/month.

What we still hold, pending verification: their Action is a **thin wrapper that
streams files to `api.eleata.io`** and its documented outputs are
`results-json` / `total-files` / `total-errors` — no evidence of line-level
annotations. Our two remaining edges are therefore (a) local-first validation, no
invoice bytes leaving the build, and (b) line/column anchoring. **Verify (b)
against their Action before claiming it.** Every eleata repo is at 0 stars, so this
is a positional threat, not yet a distributional one.

## Phase 2 — Monetise urgency (months 2–3)
- [ ] Launch cascade (Show HN → dev.to → r/webdev → German channels), parity page front and centre
- [ ] Agency motion: white-label validation reports; outreach to German agencies/ERP
      consultancies (the only segment buying in 2026)
- [ ] Factur-X *generation* (embed XML in PDF/A-3) — the "PDF invoice + compliance" segment
- [ ] Programmatic /rules/[id] SEO pages — only now, when coverage is defensible
- [ ] EUR prices + annual billing (2 months free)

## Phase 3 — Platform (months 4–6)
- [ ] Usage-based per-document pricing beyond the Platform tier's included volume
- [ ] DPA/AVV signable self-serve; EU-residency statement; SLA + public status page
- [ ] Country #2: France (Factur-X mandate 2026–27) — the multi-country compounding story begins
- [ ] AI mapping assistant: arbitrary invoice JSON/CSV → semantic model (the one AI
      feature with compounding integration-cost value; structured outputs)
- [ ] Integration partnerships: commerce/invoicing template + Shopware app authors
      embed the free core; Platform tier is the upsell

## Phase 4 — The wave (2027)
- [ ] Peppol delivery via access-point partnership — from validating documents to
      carrying them (the recurring, load-bearing layer)
- [ ] GoBD-compliant 10-year archival + audit trails — validator → system of record
- [ ] Country #3+: Italy FatturaPA, Poland KSeF, Spain Verifactu — one CIUS per quarter

## Dormant (built, deliberately parked — do not delete, do not extend)
- SaaS billing/auth/dashboard shell (activates when free users ask to pay)
- Admin panel (a DB client suffices until ~100 customers)
- /api/ai/explain as a public endpoint (playground-only; German procurement treats
  an AI subprocessor of invoice data as a blocker)

## Explicitly killed
- SMB cold email, paid ads, social posting cadence, Product Hunt before parity+CII
