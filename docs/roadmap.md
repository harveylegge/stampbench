# Roadmap

Ordered by revenue impact per unit of effort.

## Now → launch (week 1–2)
- [ ] Publish `@invoicegate/core` to npm (funnel top). Add README badges + GitHub repo.
- [ ] Deploy to Vercel + Neon; connect domain (invoicegate.dev).
- [ ] Stripe live prices + webhook.
- [ ] Programmatic SEO: `/rules/[id]` page per implemented rule (BR-DE-15 etc.) generated
      from the rule registry — the moat described in docs/marketing/seo-strategy.md.
- [ ] Launch posts (Show HN, r/webdev, dev.to, German channels) — drafts in docs/marketing.

## Near (month 1–2)
- [ ] CII syntax support (parse ZUGFeRD/Factur-X XML) — biggest inbound request expected,
      since German *received* invoices are often CII.
- [ ] Expand BR rule coverage toward the full EN 16931 set; per-rule docs page auto-grows.
- [ ] CLI: `npx invoicegate validate invoice.xml` (free, drives npm installs).
- [ ] GitHub Action for CI validation (`invoicegate/validate-action`).
- [ ] Annual billing + EUR prices (Stripe multi-currency).
- [ ] Resend transactional email: welcome, quota 80%/100% nudges (drafts already written).

## Mid (month 3–6)
- [ ] Factur-X *generation*: embed XML in PDF/A-3 (pdf-lib) — unlocks the huge
      "PDF invoice + compliance" segment.
- [ ] Peppol BIS profile + validation; FatturaPA (Italy) as the second country wedge.
- [ ] AI mapping assistant: paste arbitrary invoice JSON/CSV → suggested semantic-model
      mapping (the second genuinely-AI feature; Claude structured outputs).
- [ ] Team accounts (invite by email), usage charts, webhook notifications.
- [ ] Official KoSIT validator parity harness in CI: run both on a corpus, publish the
      delta as a trust page.

## Later
- [ ] France (Factur-X mandate 2026–27), Belgium, Poland KSeF, Spain Verifactu — one
      country CIUS at a time, each a new SEO surface and pricing tier.
- [ ] E-invoice *sending* (Peppol access point partnership) — moves up the value chain
      from validation to delivery.
- [ ] SOC 2 lite / security page when first enterprise lead asks.
