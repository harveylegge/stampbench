# Stampbench — Blog Pipeline (15 posts, prioritised by SEO value)

Priority bands: **P1** = high volume or high commercial intent, write first. **P2** = solid supporting content. **P3** = community/link-building value more than search volume. German-language posts noted `[DE]` — they are written in German, not translated afterthoughts. Every post links to at least one rule page and one product surface (see internal linking plan in `seo-strategy.md`).

## P1 — write in the first two months

**1. E-Rechnungspflicht 2025–2028: alle Fristen und was sie konkret bedeuten [DE]**
The definitive German timeline: receiving since 2025, issuing from 2027, small businesses 2028, with a decision tree for "which deadline applies to me". Maintained as a living pillar page with a visible last-updated date — the highest-volume query cluster in our market.

**2. How to generate a valid XRechnung in Node.js (2026 guide)**
Step-by-step from `npm install` to a validated UBL invoice, with the full annotated XML output. Targets "xrechnung nodejs/javascript/typescript" — the highest-converting developer query we can own, since no competing content exists.

**3. XRechnung validieren: Fehler verstehen und beheben [DE]**
Walks through validating an invoice and decoding the ten most common rule failures (BR-DE-15, BR-CO-15, BR-S-08…) in plain German. Funnels "xrechnung validieren/prüfen" searchers straight into the playground and the rule pages.

**4. Was ist eine Leitweg-ID — und wann brauche ich sie? [DE]**
Explains the routing ID for B2G invoices, its structure, and where BT-10 goes in the XML. "Leitweg-ID" is a steady, high-volume German query with weak existing answers and a natural link into BR-DE rule pages.

**5. UBL vs CII: which XRechnung syntax should you generate?**
The two permitted syntaxes compared honestly — tooling support, Peppol alignment, real-world receiver behaviour — with a clear recommendation (UBL) and when CII is unavoidable. Targets "ubl vs cii" and "xrechnung ubl oder cii" in both languages.

## P2 — months two to five

**6. ZUGFeRD oder XRechnung: der Unterschied in 5 Minuten [DE]**
Hybrid PDF vs pure XML, when each is legally acceptable, and how the profiles relate to EN 16931. Very high German search volume; ranks us for a format we don't ship yet, so it must be scrupulously honest and states our roadmap.

**7. The BR-CO rules: why invoice arithmetic fails validation (and how to make it impossible)**
Deep-dive on the calculation rules — rounding, allowance/charge maths, VAT breakdown sums — with real failing examples. Ends on our strongest technical differentiator: totals computed by construction.

**8. Germany's e-invoicing mandate: a technical guide for SaaS founders**
The English-language pillar: who's affected, dates, formats, penalties, and an integration-effort estimate for a typical invoicing stack. Written to be the page HN comments and newsletters link to.

**9. Anatomy of an XRechnung: every required field, explained**
Field-by-field tour of a minimal valid invoice mapped to BT terms, with copyable XML. Long-tail magnet for dozens of "xrechnung {field}" queries and the natural hub linking to `/fields/` pages.

**10. Self-hosting the KoSIT validator vs using an API: an honest comparison**
What running the official Java validator actually involves (deployment, Schematron updates, no explanations) versus a hosted endpoint, with a fair "when self-hosting wins" section. Targets "kosit validator alternative" and comparison-shopping developers.

**11. Reverse Charge, Kleinunternehmer, Gutschriften: XRechnung-Sonderfälle richtig abbilden [DE]**
The three edge cases German freelancers and small firms actually hit, each with the correct VAT category codes and a valid example invoice. Converts well because searchers arrive with a concrete failing document.

## P3 — ongoing / opportunistic

**12. What is Peppol, and does the German mandate require it?**
Clears up the most common conflation in the space: the network vs the format, BIS vs XRechnung, and when Peppol access actually becomes necessary. Positions us early for the transmission features on our roadmap.

**13. Implementing EN 16931 business rules in TypeScript: what we learnt porting 200 Schematron rules**
Engineering write-up on translating Schematron/XPath into a typed rule engine, testing against the official corpus, and keeping pace with rule releases. Low search volume, high credibility — built for HN, Reddit, and newsletter links.

**14. France, Belgium, Poland: the e-invoicing mandates coming after Germany**
A tracker of EU rollout dates (France from September 2026) and what they share via EN 16931. Establishes topical breadth for the post-German expansion story and earns recurring update traffic.

**15. Why we made invoice totals impossible to get wrong**
Short design-philosophy piece on correct-by-construction APIs, using BR-CO failures as the case study. Product marketing disguised as engineering opinion; pairs with post 7 and gives the HN/dev.to audience something to argue about.

## Production notes

- Posts 1, 8 and 14 are living documents — recheck dates and legislation quarterly; freshness is the ranking edge on deadline queries.
- Every German post gets a shorter English sibling (and vice versa) only when search data justifies it; hreflang pairs, never machine-translated filler.
- Each post ships with one custom diagram or annotated XML screenshot in brand style (`brand.md`) — these get lifted into social posts and earn image-search traffic.
