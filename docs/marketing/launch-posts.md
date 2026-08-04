# Stampbench — Community Launch Posts

One channel per day; never cross-post the same text. Each post is written for its community's norms. All links go to the playground or GitHub, not the pricing page.

## 1. Show HN

**Title:** Show HN: Stampbench – Validate and generate German e-invoices in TypeScript

**Body:**

Hi HN. Germany now mandates structured e-invoicing for domestic B2B: every company has had to be able to receive EN 16931 invoices since January 2025, and must issue them from January 2027 (2028 for companies under €800k turnover). France and others are following. Practically, this means every piece of software that emits an invoice for a German customer needs to produce XRechnung XML that passes ~200 business rules.

I hit this on client work and found the tooling is almost entirely Java: the official KoSIT validator (Schematron pipeline, self-hosted, no API) and the Mustang project. Nothing serious existed for Node/TypeScript, so I spent the last year building it.

Stampbench is two things:

1. An MIT-licensed library, `@stampbench/core` — validates and generates XRechnung (UBL 2.1) locally. The EN 16931 and XRechnung CIUS rules are implemented natively in TypeScript rather than by shelling out to Java; the rule definitions are generated from a structured dataset so the validator and the docs can't drift apart.

2. A hosted API + playground (stampbench.com) — for teams that don't want to embed the library, plus the part I'm most interested in feedback on: plain-language error explanations. The spec's error for a missing buyer reference is literally "BR-DE-15". The playground turns each failure into a sentence, the offending XPath, and a corrected snippet, in English or German.

One design decision worth mentioning: for generation, you supply line items and the library computes all document totals itself, so the arithmetic rules (BR-CO-*) hold by construction — an entire class of the most common validation failures becomes unrepresentable.

Business model is boring on purpose: library free forever, API free for 100 calls/month, paid tiers above that. Solo developer, self-serve only.

Things I know are missing: CII syntax, ZUGFeRD hybrid PDFs, Peppol transmission. Happy to discuss the rule-implementation approach, the compliance landscape, or anything else.

GitHub: github.com/stampbench/core · Playground: stampbench.com

## 2. r/webdev

**Title:** Germany made structured e-invoices mandatory and the entire toolchain was Java — so I built a TypeScript validator/generator for XRechnung

**Body:**

Context for anyone who hasn't hit this yet: if your app issues invoices to German business customers, those invoices must be EN 16931 "e-invoices" (structured XML, usually the XRechnung profile) — receiving is already mandatory since Jan 2025, issuing becomes mandatory Jan 2027. A PDF is not an e-invoice under the law. France is next.

I ran into this on an agency project and the developer experience was grim: the official validator is a self-hosted Java/Schematron pipeline, and failures come back as codes like `BR-DE-15` with a sentence copied from the spec.

So I built Stampbench:

- `npm install @stampbench/core` — MIT, validates + generates XRechnung UBL locally, no Java anywhere
- Hosted API and a playground that explains every failing rule in plain English or German, with the fix
- Generation computes totals for you, so the arithmetic rules can't fail

The library is free forever; the API has a free tier. I'd genuinely value feedback on the DX — especially from anyone who's had to integrate KoSIT or hand-roll UBL. Playground needs no signup: stampbench.com

*(Mod note compliance: my own project, first post about it here. Happy to answer questions either way.)*

## 3. r/selbststaendig (auf Deutsch)

**Titel:** E-Rechnungspflicht 2027/2028: kostenloses Tool zum Prüfen und Erstellen von XRechnungen (Eigenentwicklung)

**Text:**

Hallo zusammen — vorab: Eigenwerbung, aber hoffentlich nützliche. Kurz der Stand, weil dazu immer noch viel Unsicherheit herrscht:

- **Seit 01.01.2025** müssen alle Unternehmen in Deutschland E-Rechnungen **empfangen** können — auch Kleinunternehmer und Solo-Selbstständige. Ein E-Mail-Postfach reicht dafür grundsätzlich aus.
- **Ab 01.01.2027** müssen Unternehmen mit mehr als 800.000 € Vorjahresumsatz E-Rechnungen **ausstellen**.
- **Ab 01.01.2028** gilt die Ausstellungspflicht für alle, also auch für uns Kleine.
- Wichtig: Eine **PDF ist keine E-Rechnung**. Gemeint sind strukturierte Formate wie XRechnung oder ZUGFeRD (Norm EN 16931).

Ich bin selbst Entwickler und habe für dieses Thema ein Tool gebaut: **Stampbench** (stampbench.com). Was davon für euch interessant sein könnte:

- **Kostenloser Online-Check:** XRechnung reinkopieren oder hochladen, und ihr seht sofort, ob sie gültig ist — inklusive **verständlicher Erklärung auf Deutsch** für jeden Fehler. Die offiziellen Fehlermeldungen wie „BR-DE-15" versteht sonst kein Mensch; bei uns steht dann z. B. „Die Leitweg-ID bzw. Käuferreferenz fehlt — dieses Feld muss ergänzt werden."
- Wer Rechnungen aus eigener Software erzeugt (oder einen Entwickler hat): Es gibt eine kostenlose Open-Source-Bibliothek und eine API dazu.

Der Online-Check kostet nichts und erfordert keine Registrierung. Bezahlpläne gibt es nur für die API, also für Software-Anbieter — als Einzelperson braucht ihr die nicht.

Falls die Mods das als zu werblich einstufen, nehme ich den Post natürlich raus. Fragen zur E-Rechnungspflicht beantworte ich hier gern, auch unabhängig vom Tool.

## 4. dev.to article (outline)

**Title:** How to generate a valid XRechnung (German e-invoice) in Node.js

1. **The 90-second regulatory brief** — what EN 16931/XRechnung is, the 2025/2027/2028 dates, why "just send a PDF" stopped being legal advice.
2. **The format** — UBL 2.1 XML, BT/BG term model, what a minimal valid invoice actually contains (annotated 40-line example).
3. **Why validation is the hard part** — ~200 business rules; taxonomy of the rule families (syntax, arithmetic BR-CO, VAT BR-S/E/G, German CIUS BR-DE) with one concrete failing example each.
4. **Doing it in Node** — `npm install @stampbench/core`; generate an invoice from line items; show that totals are computed automatically; validate the output; deliberately break it and show the plain-language error.
5. **Edge cases that will bite you** — reverse charge, Kleinunternehmer VAT exemption (BR-O), credit notes, rounding.
6. **Production checklist** — where to validate in your pipeline (pre-send, on-receive), handling the Leitweg-ID for B2G, storing the XML alongside the PDF you still render for humans.
7. **Closing** — library is MIT; playground link; honest roadmap note (CII/ZUGFeRD pending).

*Series potential: same article re-targeted per framework ("...in Next.js", "...in NestJS") mapping to the docs quickstarts in `seo-strategy.md`.*

## 5. X/Twitter thread (6 tweets)

**1/**
Germany quietly created one of the biggest compliance deadlines in software: from 2027, every domestic B2B invoice must be structured XML (EN 16931 / XRechnung). Receiving is already mandatory since 2025.

If your product creates invoices for German customers, this is now your problem.

**2/**
The state of tooling when I hit this:

- Official validator: Java, Schematron, self-hosted, no API
- Errors look like this: "BR-DE-15"
- That's it. That's the error.

Nothing existed for TypeScript. The most popular invoice-adjacent ecosystem on npm had zero coverage.

**3/**
So I spent a year building Stampbench.

npm install @stampbench/core

Validates + generates XRechnung (UBL) locally. MIT-licensed. No Java, no self-hosting, unlimited use, free forever.

**4/**
The hosted bit (stampbench.com) adds a REST API and the feature I wanted most: every cryptic rule failure explained in plain English or German, with the exact XML fix.

"BR-DE-15" → "The buyer reference (BT-10) is missing. Add this element:"

**5/**
Favourite design decision: you never write invoice totals. You give line items; the library computes every total the spec requires. The arithmetic rules (BR-CO-*) — the most common validation failures in the wild — pass by construction. They can't not.

**6/**
Free tier: 100 API calls/month, no card. Local validation via the OSS lib: unlimited forever.

Playground (no signup): stampbench.com
GitHub: github.com/stampbench/core

Building this solo and self-serve — feedback very welcome.

## 6. LinkedIn post

**Deadline your roadmap probably hasn't priced in: January 2027.**

From that date, German companies must issue structured e-invoices (EN 16931 / XRechnung) for domestic B2B trade — and since January 2025 they've already been required to receive them. France follows in 2026–27. If your software produces invoices for German customers, compliance isn't optional and a PDF doesn't count.

Having hit this on client work, I found the entire toolchain was Java: self-hosted validators, error codes like "BR-DE-15", no APIs. So I built the missing piece for the TypeScript ecosystem.

Stampbench is an open-source library (MIT, free forever) that validates and generates XRechnung locally, plus a hosted API with something the official tools don't have: plain-language explanations, in English and German, for every validation error — with the fix.

For CTOs and engineering leads at invoicing or ERP products: the free tier and playground are the fastest way to scope what the mandate means for your stack. No sales calls — it's entirely self-serve.

stampbench.com

*(Post as founder; 3–5 relevant hashtags maximum: #eRechnung #XRechnung #eInvoicing #SaaS. Reply to every comment within a day.)*
