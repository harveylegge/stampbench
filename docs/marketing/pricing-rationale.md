> **Superseded (2026-08-03):** pricing of record is now Free £0 / Developer £29 / Agency £99 / Platform £299 usage-based — see `docs/roadmap.md` and `apps/web/lib/plans.ts`. The analysis below informed but no longer defines the tiers.
# InvoiceGate — Pricing Rationale

## The tiers

| Tier | Price | API calls/mo | Role |
| --- | --- | --- | --- |
| Free | £0 | 100 | Adoption engine; remove all evaluation friction |
| Starter | £19/mo | 2,500 | First production tier for freelancers/small SaaS |
| Pro | £49/mo | 15,000 + priority support | The intended "most popular" tier |
| Scale | £149/mo | 100,000 | Invoicing/ERP vendors embedding us |
| OSS library | £0 forever | Unlimited local validation | Distribution, trust, and the honest free floor |

## Why this shape

**Usage-based ladder, no seats.** Our value scales with the customer's invoice volume, not their headcount — a two-person invoicing SaaS can push more invoices than a fifty-person agency. Metering API calls aligns price with value delivered and makes every tier boundary objective: you either need more calls or you don't. No "contact sales", no per-seat negotiation a solo founder can't staff.

**The free tier is deliberately generous where it's cheap and capped where it isn't.** 100 hosted calls/month is enough to integrate, demo, and run a small side project — the entire evaluation journey — but not enough to run a production invoicing product. Meanwhile *unlimited* local validation via the MIT library means we never have to police the awkward middle: anyone who just wants validation at volume has a free, sanctioned path that costs us nothing to serve and earns us GitHub stars, npm downloads, and SEO surface instead of infrastructure bills.

**Starter at £19 is the impulse-purchase tier.** It sits below every commercial alternative's floor (Invopop starts at €50/mo, InvoiceXML at $99/mo) and below the "needs a procurement conversation" threshold. A freelance developer can expense it without asking anyone. Its job is to convert the moment the free quota first pinches — see the behavioural triggers in `email-campaigns.md`.

**Pro at £49 is where we want gravity.** 6× the calls of Starter for 2.6× the price makes the upgrade arithmetic obviously favourable, and priority support lands exactly where the buyer's anxiety lives: a compliance deadline with legal consequences. Pro should be visually anchored as "most popular" on the pricing page.

**Scale at £149 exists to make Pro look reasonable and to catch vendors.** An ERP or invoicing vendor doing 100k calls/month is embedding us in their own compliance story; £149 is trivially cheap against building in-house (porting and maintaining ~200 rules against KoSIT releases) and still undercuts Invopop's €300 top tier and InvoiceXML's $399. Above Scale, we quote custom overage rather than publishing an enterprise tier we can't yet support.

## Expansion revenue logic

The mandate itself is our expansion engine, on two clocks:

1. **Per-customer growth.** A customer's API usage tracks their invoice volume, which tracks their revenue. Customers upgrade tiers as they grow without any sales touch — the 429 at the quota ceiling is the only "salesperson". Overage design: soft-warn at 80% (email 3 in the drip), hard-stop on Free, and on paid tiers offer metered overage (e.g. £2 per additional 1,000 calls) so a spike never breaks production invoicing — capped overage that auto-suggests the next tier when overage exceeds the tier-price delta two months running.
2. **Market-wide growth.** Issuing volume ratchets up at fixed dates: January 2027 (most companies) and January 2028 (the rest), then France from late 2026. Accounts acquired cheaply in 2026 on Free/Starter mechanically become Pro/Scale accounts as the deadlines force their invoice flows from "testing" to "all of them". Pricing strategy is therefore: **maximise account acquisition now, even at low ARPU; the regulation does the expansion.**

Secondary expansion levers (later, not now): generation counted at a higher metering weight than validation, AI explanation add-on packs, and Peppol transmission as a per-document priced feature — transmission has per-unit cost and per-unit value, so it meters honestly.

## Anchoring vs competitors

- **Invopop (€50–300/mo)** and **InvoiceXML ($99–399/mo)** validate the market and set the reference frame; we deliberately price each rung ~50–60% below the comparable rung. The pricing page should show this without naming competitors aggressively — the `/vs/` comparison pages (see `seo-strategy.md`) carry the detail.
- **KoSIT (free)** is the real competitor for cost-sensitive buyers, so we never pretend the free option doesn't exist. Our pricing-page copy positions the paid tiers against the *operational* cost of self-hosting Java tooling — deployment, monitoring, rule-release upkeep, no API, no explanations — not against its £0 sticker.
- **Currency note:** prices are set in GBP (founder is UK-based) but the core market pays in euros. Recommendation: display and charge localised prices via Stripe multi-currency — €25/€59/€179 for DE/EU visitors (rounded to clean euro points, not converted live) — because a German Geschäftsführer expensing "£19" adds FX friction and cognitive overhead at exactly the wrong moment. Keep GBP as the accounting base.

## Free-tier abuse guardrails

The generous free tier is safe because the expensive assets are metered, but guard the edges:

1. **Verified email required for an API key**; block disposable-email domains at signup.
2. **Multi-account throttling:** rate-limit key creation per IP/device fingerprint; free tier is per-organisation domain where detectable, and repeated free accounts from one domain get a friendly consolidation email before enforcement.
3. **Hard rate limits on Free** (e.g. 10 req/min) so 100 calls can't be weaponised for load; playground is session-rate-limited and CAPTCHA-free but queue-throttled under load.
4. **AI explanations are the costly unit** — cache explanations by rule ID + error context hash (the same failure explains identically), so marginal AI cost trends toward zero; uncached explanation generation is capped per free account per day.
5. **No card required for Free** (removing signup friction outweighs abuse risk), but automated anomaly alerts on usage patterns that look like resale or scraping.
6. **The pressure valve is the OSS library:** anyone gaming the free API for bulk validation is pointed to the unlimited local option — abuse becomes advocacy.

## Annual discount recommendation

Offer annual billing at **2 months free (~17% discount)** on Starter and Pro — the SaaS-standard rate; steeper discounts read as desperation and this market doesn't need them, because the mandate guarantees multi-year need. Rationale: (a) cash-flow smoothing for a solo founder, (b) churn insulation during the pre-2027 period when some customers' volumes are still low, (c) a natural upsell moment at each January deadline ("lock this year's price"). Hold Scale at monthly-or-annual parity initially — vendors at that tier negotiate anyway, and annual commitments there deserve a conversation, not a checkbox. Show annual as the default toggle state on the pricing page with the monthly price still visible; never hide the monthly option.

## Principles to hold as this evolves

- Price changes never apply retroactively to existing subscribers without 60 days' notice; compliance customers are buying predictability.
- The OSS library's unlimited local validation is a public promise ("free forever" appears in the README and on the pricing page) — it is the trust anchor for everything else and must never be walked back.
- Revisit tier ceilings (not prices) as real usage data accumulates; adjust by widening quotas rather than raising prices while in land-grab mode, at least until the 2027 deadline inflects demand.
