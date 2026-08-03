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
      GitHub Action: pending repo publish.
- [x] Playground: drag-and-drop + CII auto-detect (waitlist unnecessary — CII shipped).
- [x] Version-pinned results (`meta.specVersions` in every response).

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
