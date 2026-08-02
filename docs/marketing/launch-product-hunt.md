# InvoiceGate — Product Hunt Launch

## Name and tagline

- **Name:** InvoiceGate
- **Tagline (≤60 chars):** `German e-invoice compliance, as an API and a TS library`

Alternates:

- `Validate and generate XRechnung e-invoices from code`
- `EN 16931 e-invoicing for developers — no Java required`

## Topics

Developer Tools, APIs, SaaS, Fintech, Open Source

## Description (gallery text)

Germany requires all B2B invoices to be structured e-invoices (EN 16931 / XRechnung) — receiving since 2025, issuing by 2027. France follows. Every product that creates an invoice has to comply, and the existing tooling is Java-only, self-hosted, and cryptic.

InvoiceGate is the TypeScript-first fix:

- **Open-source library** — `npm install @invoicegate/core`. Validate and generate XRechnung (UBL) locally. MIT, unlimited, free forever.
- **REST API** — validate and generate from any language; 100 calls/month free.
- **Plain-language errors** — the spec says "BR-DE-15". We say "the buyer reference (BT-10) is missing — here's the element to add", in English or German.
- **Correct by construction** — generated invoices compute their own totals, so the EN 16931 arithmetic rules always pass.
- **Playground** — paste XML, see every failing rule explained, fix it live.

Built by a solo developer for every team that just found this requirement in their backlog.

## First comment (from the maker)

Hi Product Hunt — I'm the developer behind InvoiceGate.

Last year I was building invoicing for a client with German customers and hit a wall: Germany now mandates structured e-invoices (XRechnung, based on EN 16931) for all B2B trade. Receiving has been mandatory since January 2025; issuing becomes mandatory in January 2027 (2028 for the smallest companies). France and other EU countries are on the same path.

The tooling shock: everything is Java. The official KoSIT validator is solid but self-hosted, has no API, and reports errors like `BR-DE-15` with a sentence lifted straight from the spec. There was no serious option for the Node/TypeScript ecosystem at all. So I built one.

What I'd love feedback on:

1. The plain-language error explanations — paste any broken XRechnung into the playground and tell me if the explanation would actually have saved you time.
2. The API shape — one POST to validate, one POST to generate. Is there anything missing for your stack?
3. Pricing — the library is MIT and free forever; the API has a free tier of 100 calls/month, then £19/£49/£149. Does that scale sensibly for an invoicing product?

Honest scope notes: today it's XRechnung UBL (the dominant German profile). CII and ZUGFeRD hybrid PDFs are on the roadmap, as is Peppol transmission. I'd rather ship a correct core than a broad shallow one.

Everything is self-serve — no demo calls, no "contact sales". Ask me anything, I'll be here all day.

## Gallery captions (6 images)

1. **Hero:** "Validate and generate German e-invoices from TypeScript. One library, one API." *(dark hero, gate mark, code snippet showing `validate(xml)`)*
2. **Playground:** "Paste an invoice. Every failing rule, explained in plain language — not spec-speak." *(playground with BR-DE-15 expanded into a human sentence + fix)*
3. **Code:** "`npm install @invoicegate/core` — MIT-licensed, validates locally, no Java, no self-hosting." *(terminal + minimal generate example)*
4. **By construction:** "Totals are computed for you. The BR-CO arithmetic rules can't fail." *(diagram: line items → computed totals → green ticks)*
5. **API:** "One POST to validate, one POST to generate. Errors link to a documented page per rule." *(API request/response with rule URL in payload)*
6. **Pricing:** "Free: 100 API calls/month. Local validation with the open-source library: unlimited, forever." *(pricing tiers)*

## Launch-day checklist

### Before (T-7 to T-1)

- [ ] Ship the playground in a state where a visitor can succeed in under 60 seconds without signing up (preloaded broken example invoice).
- [ ] Prepare all 6 gallery images at 1270×760, plus a 30–45s silent screen-capture video of the playground fixing a real invoice.
- [ ] Set up the "coming soon" teaser page on PH and collect followers for launch-day notification.
- [ ] Write and schedule the companion posts (see `launch-posts.md`) — Show HN goes the *next* day, not the same day; don't split attention.
- [ ] Verify signup → first API call flow end to end, including Stripe test-mode upgrade. Rate-limit alarms on.
- [ ] Draft 10 likely questions with answers (pricing, ZUGFeRD support, data handling/GDPR — invoices contain personal data; note validation can run fully locally via the OSS lib, and API payloads are not retained).
- [ ] Add a `?ref=producthunt` landing state with a small "hello Product Hunt" banner and the free-tier CTA.

### Launch day (12:01 am PT, Tuesday or Wednesday)

- [ ] Publish; post the maker comment within the first 5 minutes.
- [ ] Update GitHub README, npm description, and site header with a discreet PH badge/link.
- [ ] Reply to every comment within 30 minutes for the first 12 hours; keep answers concrete, link to docs/rule pages rather than repeating marketing copy.
- [ ] Post once in relevant communities where self-promo is allowed (Indie Hackers launch thread, r/SideProject) — no vote solicitation anywhere; PH penalises it and it's against the rules.
- [ ] Monitor error rates and free-tier abuse (see `pricing-rationale.md` guardrails); keep an eye on playground uptime.
- [ ] Log every feature request and objection in a single doc — this is the cheapest user research of the year.

### After (T+1 to T+7)

- [ ] Post Show HN (T+1 or T+2 morning US time).
- [ ] Personal thank-you reply to every substantive commenter; convert the best Q&A into an FAQ page.
- [ ] Write a short "what we learnt launching on PH" changelog entry; email the day's signups with the top three questions answered (see `email-campaigns.md` welcome flow).
- [ ] Add "Featured on Product Hunt" to the site footer only if the badge is earned (top 10); otherwise skip it.
