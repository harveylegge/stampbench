# Session handoff — read this first

**Last updated:** 2026-08-03 · **Repo:** `C:\Users\harvey\Downloads\invoicegate` (git, clean,
10 commits) · **Nothing is deployed or published yet.**

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
