# Stampbench — Cold Outreach Templates

Ground rules: every email under 120 words, plain text, no images, no tracking-heavy footers. One idea, one CTA — and the CTA is always *try something self-serve* (playground or free tier), never "book a call". Personalisation slots in `{braces}`; an email goes out only if every slot is genuinely filled. Send from the founder's real address. Include a one-line unsubscribe ("Reply 'no' and I won't email again") — required under UK PECR/GDPR and it builds trust.

## Template A — Invoicing SaaS vendors

**To:** engineering lead or CTO (not sales).
**Subject:** XRechnung support in {product} before the 2027 mandate
**Alt subject:** {product} + Germany's e-invoicing deadline

Hi {first_name},

From January 2027 your German customers must issue structured e-invoices (XRechnung/EN 16931) — so invoicing tools without export support risk churn to ones that have it. I noticed {product} {personalisation: currently exports PDF invoices / mentions German customers on your site / has an open feature request for e-invoicing}.

I built Stampbench: a TypeScript library (MIT) and REST API that generates and validates XRechnung. Totals are computed automatically so the arithmetic rules always pass, and every validation error comes with a plain-language explanation.

You can scope the integration without talking to anyone — the playground and 100 free API calls/month are at stampbench.com.

Worth a look for your roadmap?

{name} — reply "no" and I won't email again.

## Template B — German web agencies (bilingual opener, German body)

**To:** technical director / Geschäftsführer of agencies building custom software or shops.
**Subject:** E-Rechnungspflicht: XRechnung-Integration für Ihre Kundenprojekte
**Alt subject:** XRechnung in Node.js — für {agency} interessant?

Hallo {first_name},

ab 2027 müssen die Geschäftskunden Ihrer Kunden E-Rechnungen ausstellen — jedes Projekt mit Rechnungsfunktion braucht also XRechnung-Export. Ich habe gesehen, dass {agency} {Personalisierung: viel mit Node/TypeScript arbeitet / E-Commerce-Projekte betreut / auf Ihrer Referenzseite ein Faktura-Projekt zeigt}.

Stampbench ist die erste TypeScript-Lösung dafür: Open-Source-Bibliothek (MIT) zum Erstellen und Validieren von XRechnungen, plus API mit verständlichen deutschen Fehlererklärungen statt kryptischer Codes wie „BR-DE-15".

Für Agenturen praktisch: einmal integrieren, in jedem Kundenprojekt wiederverwenden. Playground und 100 API-Aufrufe/Monat sind kostenlos: stampbench.com

Wäre das für Ihre Projekte relevant?

{name} — ein kurzes „nein" genügt, dann schreibe ich nicht mehr.

## Template C — ERP consultancies

**To:** partner/practice lead for finance modules.
**Subject:** A faster answer to "is this XRechnung valid?" for client work
**Alt subject:** {firm} — e-invoicing validation without hosting KoSIT

Hi {first_name},

Consultancies implementing the e-invoicing mandate tell me the slow part isn't mapping fields — it's diagnosing why an invoice fails validation. The official KoSIT tooling means self-hosted Java and errors like "BR-DE-15" with no explanation.

Stampbench gives {firm} a hosted validation API and playground that explains every failure in plain German or English, with the exact XML fix. Your consultants paste a client's invoice and read the answer. Since you {personalisation: list SAP/Dynamics/Odoo migrations on your site / work with Mittelstand manufacturers}, this may fit your 2026–27 project pipeline.

Free tier, no card, no sales process: stampbench.com

Useful for your team?

{name} — reply "no" to opt out.

## Follow-up sequence

Same thread (reply to your own email). Stop immediately on any reply or a "no". Two follow-ups maximum, then the address goes on the do-not-contact list.

### Day 0

Send Template A/B/C.

### Day 3 — the useful nudge (add value, don't repeat)

**Subject:** (same thread)

Hi {first_name} — one addition since my last note: we publish a documented page for every XRechnung validation rule, e.g. stampbench.com/rules/br-de-15. Teams use them to decode failures even without our API — they're free, no signup.

If e-invoicing isn't on your 2026 roadmap, a one-word "no" saves us both time.

{name}

*(~60 words. German version for Template B: same structure — verweisen Sie auf die Regelseiten, z. B. stampbench.com/rules/br-de-15, und bieten Sie das kurze „nein" an.)*

### Day 10 — the close-out

**Subject:** (same thread)

Hi {first_name} — last note from me. If the mandate becomes relevant later, the two links that matter: the playground (stampbench.com, validates any XRechnung free) and the library (github.com/ohjl777/stampbench, MIT).

I won't follow up again. Good luck with {personalisation: current product / the 2027 timeline}.

{name}

*(~50 words. No guilt, no "just bumping this". The goal is to be remembered kindly when the deadline forces the issue — for most of this market, timing does the selling.)*

## List-building notes

- **Vendors (A):** invoicing/billing tools listed on OMR Reviews, Capterra DE, and GitHub topic `invoicing`; prioritise those with public changelogs showing no e-invoicing support yet.
- **Agencies (B):** German agencies in Node/TS ecosystems — Next.js/Vercel partner lists, Shopware/Shopify agency directories, t3n job posts mentioning TypeScript.
- **Consultancies (C):** partner directories of DATEV, SAP Business One, Dynamics BC, Odoo; attendees/speakers at E-Rechnungs-Gipfel.
- Volume discipline: 20–30/day maximum, hand-personalised. This channel seeds the flywheel; SEO carries the volume (see `seo-strategy.md`).
