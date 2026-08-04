# Stampbench — SEO Strategy

Search is Stampbench's primary acquisition channel: no founder audience, no sales team, and a market where every buyer's journey starts with a Google search — either a panicked German business query ("e-rechnung pflicht 2027") or a developer query ("xrechnung nodejs"). The strategy has three layers: **programmatic rule pages** (the moat), **developer intent pages**, and **mandate/informational content** that feeds the first two.

## 1. Target keywords (20)

Priority: P1 = build for this now, P2 = next quarter, P3 = opportunistic.

| # | Query | Lang | Intent | Priority | Target page |
| --- | --- | --- | --- | --- | --- |
| 1 | xrechnung validieren | DE | Tool-seeking | P1 | Playground (`/validator`) |
| 2 | xrechnung prüfen kostenlos | DE | Tool-seeking | P1 | Playground (`/validator`) |
| 3 | xrechnung erstellen | DE | Tool-seeking | P1 | Generator page (`/generator`) |
| 4 | xrechnung nodejs | EN | Developer | P1 | Docs quickstart (`/docs/nodejs`) |
| 5 | xrechnung javascript / typescript | EN | Developer | P1 | Docs quickstart |
| 6 | generate xrechnung programmatically | EN | Developer | P1 | Blog + docs |
| 7 | en 16931 validation api | EN | Developer/buyer | P1 | API landing (`/api`) |
| 8 | xrechnung validator api | EN | Developer/buyer | P1 | API landing |
| 9 | br-de-15 (and every other rule ID) | DE/EN | Error-driven | P1 | `/rules/br-de-15` et al. |
| 10 | e-rechnung pflicht 2027 | DE | Informational | P1 | Mandate guide (`/e-rechnung-pflicht`) |
| 11 | e-rechnung pflicht 2028 kleinunternehmer | DE | Informational | P2 | Mandate guide section |
| 12 | e-rechnungspflicht b2b deutschland | DE | Informational | P2 | Mandate guide |
| 13 | xrechnung ubl oder cii | DE | Informational/dev | P2 | Blog: UBL vs CII |
| 14 | zugferd oder xrechnung unterschied | DE | Informational | P2 | Blog: format comparison |
| 15 | leitweg-id was ist das | DE | Informational | P2 | Glossary (`/glossar/leitweg-id`) |
| 16 | kosit validator alternative | EN/DE | Comparison | P2 | Comparison page (`/vs/kosit`) |
| 17 | germany e-invoicing mandate 2027 api | EN | Buyer | P2 | Mandate guide (EN) |
| 18 | xrechnung beispiel xml | DE | Developer | P2 | Example library (`/beispiele`) |
| 19 | peppol bis vs xrechnung | EN | Informational/dev | P3 | Blog |
| 20 | ubl invoice library typescript | EN | Developer | P3 | GitHub README + docs |

Notes:

- Row 9 is not one keyword — it is **~200 keywords** (every BR, BR-DE, BR-CO, BR-S/E/G/O rule ID). Individually tiny volume, collectively the highest-converting traffic we can get: someone searching a rule ID has a failing invoice *right now*.
- German queries convert to playground use; English developer queries convert to `npm install`. Both funnel to API signup.

## 2. Programmatic SEO: the rule pages (`/rules/{rule-id}`)

**This is the moat.** The official sources for rule definitions are PDFs and Schematron files; nobody has built a good, linkable, plain-language page per rule in both German and English. We generate one page per rule from a structured dataset (the same dataset the library uses — single source of truth, pages can never drift from the validator's behaviour).

### Page anatomy (every rule page)

1. **H1:** `BR-DE-15 — Buyer reference (BT-10) is missing` (localised; DE and EN versions via subpaths or hreflang).
2. **Plain-language explanation** — what the rule means, why it exists, who typically hits it (2–3 sentences, generated once with AI, then human-reviewed and frozen).
3. **The official rule text** — quoted exactly, cited to EN 16931 / XRechnung CIUS with version number.
4. **Failing XML snippet → fixed XML snippet** — minimal diff, syntax-highlighted.
5. **Fix in TypeScript** — the `@stampbench/core` code that makes this rule pass (for generation-side rules like BR-CO, note that Stampbench satisfies it by construction).
6. **CTA:** "Paste your invoice into the validator to see every failing rule explained" → playground, pre-filtered to this rule.
7. **Related rules** — same business group (e.g. all BR-CO arithmetic rules cross-link).

### Rollout

- Phase 1 (launch): the ~25 BR-DE rules (German CIUS — highest German search intent) + the ~15 BR-CO arithmetic rules (our "by construction" story).
- Phase 2: all core EN 16931 BR rules (~50) and VAT category rules (BR-S, BR-E, BR-G, BR-O, ~60).
- Phase 3: Peppol BIS rules; field pages (`/fields/bt-10` for every BT term) using the same generator.
- Each page ships with JSON-LD (`TechArticle` + `FAQPage` for the "what does X mean" question), hreflang pairs (de/en), and a stable URL that the API itself returns in error payloads — **every validation error the API emits links to its rule page**, so customers' own logs and error messages become an acquisition channel.

### Supporting programmatic surfaces

- `/beispiele` — a library of minimal valid XRechnung examples (freelancer invoice, reverse charge, credit note, B2G with Leitweg-ID). Each example page targets "xrechnung beispiel {case}".
- `/glossar/{term}` — Leitweg-ID, ZUGFeRD, Peppol, CIUS, BT/BG terms. Short pages, heavy internal linking.

## 3. Editorial content plan

- **Cadence:** 2 posts/month minimum; prioritise per `blog-ideas.md`.
- **Two pillar guides**, maintained as living documents with visible "last updated" dates:
  1. *E-Rechnungspflicht 2025–2028: der komplette Zeitplan* (German) — targets rows 10–12; updated whenever regulation moves. Deadline queries spike as each date approaches; being the freshest page wins.
  2. *Germany's e-invoicing mandate for SaaS builders* (English) — targets row 17; the page we want linked from HN, dev.to, newsletters.
- **Comparison pages** (`/vs/kosit`, `/vs/invopop`, `/vs/mustang`) — honest, feature-table format, generous to the alternative. "KoSIT is the reference implementation and it's free; here's when you'd want an API instead."
- **Docs as SEO:** every docs quickstart page targets a "{framework} xrechnung" query (Node, Next.js, NestJS, Express, Bun). Docs are indexable, fast, and canonical.

## 4. Internal linking plan

Hub-and-spoke with three hubs:

1. **Mandate guide (DE + EN)** → links out to: playground, pricing, top-10 rule pages, format-comparison posts. Every blog post links *up* to the relevant pillar guide.
2. **Rules index (`/rules`)** → links to every rule page, grouped by business group (arithmetic, VAT, German CIUS). Each rule page links to 3–5 sibling rules, the playground, and one relevant blog post.
3. **Docs home** → quickstarts, API reference, and — from every "errors" section — the relevant rule pages.

Mechanical rules:

- Every mention of a rule ID anywhere on the site (blog, docs, changelog) auto-links to its `/rules/` page (build-time transform — same pattern as the mono chip styling in `brand.md`).
- Playground results link each failing rule to its rule page; rule pages link back to the playground. This loop is the core engagement circuit.
- Footer: pillar guides, rules index, `/vs/` pages, GitHub. Keep the footer under 20 links.
- Blog posts get 2–4 contextual internal links minimum, at least one to a rule page and one to a product surface.

## 5. Off-page

- **GitHub is a ranking asset:** README targets "xrechnung typescript"; keep the npm package description keyword-accurate ("Validate and generate EN 16931 / XRechnung e-invoices in TypeScript").
- Answer XRechnung questions on Stack Overflow (`xrechnung`, `en16931`, `ubl` tags) with real answers that link to the relevant rule page where genuinely helpful.
- Submit the library to awesome-lists (awesome-typescript, awesome-e-invoicing), Öffentliche Vergabe/e-invoicing directories, and the OpenPeppol community pages where listing is permitted.
