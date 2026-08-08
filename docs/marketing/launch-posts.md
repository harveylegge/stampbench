# Stampbench — Community Launch Posts

One channel per day; never cross-post the same text. Each post is written for its
community's norms. All links go to the playground or GitHub, not the pricing page.

> **Accuracy rules for everything in this file.** Stampbench's entire positioning is
> "the validator that doesn't overstate" — the trust page publishes our own divergences
> from the official validator. Launch copy that oversells destroys the one advantage
> free and incumbent competitors structurally won't copy. Therefore:
>
> - **No timeline claims.** The first commit is 2026-08-02. Do not imply months or years
>   of work. If asked directly, answer honestly (see FAQ below).
> - **No invented origin story.** No "I hit this on client work" — that didn't happen.
>   The mandate itself is sufficient motivation and is verifiably real.
> - **Never claim the TypeScript lane is empty.** eleata.io ships an MIT CLI, a hosted
>   API, a GitHub Action and an MCP server. Acknowledge it before someone else does.
> - **Do not promise the hosted API.** It is built but dormant; there is no working
>   signup on the live site. Advertise the library and the playground only.
> - **Correct links:** github.com/harveylegge/stampbench · npmjs.com/package/stampbench ·
>   stampbench.com/playground

## 1. Show HN

**Title:** Show HN: Stampbench – Validate and repair German e-invoices in TypeScript

**Body:**

Germany mandates structured e-invoicing for domestic B2B: every company has had to be
able to receive EN 16931 invoices since January 2025, and must issue them from January
2027 (2028 under €800k turnover). France follows. In practice, any software that emits
an invoice for a German customer has to produce XRechnung XML that satisfies ~200
business rules, and a PDF no longer counts.

The tooling is almost entirely Java — the official KoSIT validator is a self-hosted
Schematron pipeline — and the failures it returns look like `BR-DE-15` with a sentence
copied from the spec. Stampbench is a TypeScript implementation of that rule set:

    npx stampbench validate invoice.xml

It parses UBL and CII (ZUGFeRD/Factur-X), runs the EN 16931 core rules plus the VAT
category families and the German BR-DE CIUS, and does it in-process — the invoice bytes
never leave your machine. MIT licensed.

Two things I think are actually new:

**It repairs, rather than just judging.** `stampbench fix` says which element to change
and edits the original document in place. Two invariants I won't relax: it never
regenerates the document (a parse→generate round-trip retains only 74.1% of elements in
my corpus, so regeneration silently drops data), and it never invents business data —
guessing a missing VAT ID would turn "invalid" into "quietly wrong", which is worse
because it then passes validation. On the official suite, repair restored 248/248
corrupted derived figures, 186 of them byte-identical to the pristine original.

**It anchors violations to source lines**, so CI can annotate the exact line of a PR.
Measured over 9,983 field-deletion mutations of the official corpus: 100% of violations
anchored to a real element, 27.1% to the exact one, 0% falling back to the document root.

What I want to be upfront about, because a compliance tool that oversells is worthless:

- This is new. Judge it on the published evidence, not on my say-so — stampbench.com/trust
  lists the test counts, the corpus, and the three documents (out of 86 official test
  instances) where we currently disagree with the reference validator. I'd rather publish
  those than have you find them.
- It is not certification-grade. For anything you'd stake money on, also run KoSIT.
- I'm not the only one here: eleata.io shipped into a similar position recently, with a
  hosted API and an MIT CLI. The differences are that we validate locally rather than
  uploading your invoices, and that we repair.
- The hosted API and paid plans on the site aren't open yet. The library and the
  playground are free and need no signup.

GitHub: github.com/harveylegge/stampbench · Playground: stampbench.com/playground

Happy to go into the rule-implementation approach, the locator index, or the compliance
landscape generally.

### Prepared answers for likely HN comments

- **"How long did this take / is this AI-generated?"** — Answer honestly: it was built
  quickly and with heavy AI assistance, which is exactly why the trust page exists and
  publishes the disagreements with the reference validator. Invite them to check the
  evidence rather than the process. Do not dodge; the repo history is public and someone
  will look.
- **"Why not just use KoSIT?"** — You should, for certification. This is for the inner
  loop: local, fast, in CI, with line-level annotations and repair.
- **"How is this different from eleata?"** — Local-first (no upload) and in-place repair.
  Say it without disparaging them; their repos are legitimate work.
- **"~200 rules — do you actually implement them all?"** — No. Be specific about the
  profile coverage and point at the trust page rather than rounding up.

## 2. r/webdev

**Title:** Germany made structured e-invoices mandatory and the toolchain is all Java — so I built a TypeScript validator for XRechnung

**Body:**

Context if you haven't hit this: invoices to German business customers must be EN 16931
structured XML (usually the XRechnung profile). Receiving has been mandatory since Jan
2025, issuing becomes mandatory Jan 2027. A PDF is not an e-invoice under the law.
France is next.

The official validator is a self-hosted Java/Schematron pipeline and its failures come
back as codes like `BR-DE-15`. So I wrote a TypeScript one:

- `npm install @stampbench/core` — MIT, validates UBL and CII locally, no Java
- `npx stampbench fix invoice.xml` — edits the original document to correct what it can,
  and refuses to guess business data it can't derive
- A GitHub Action that annotates the failing line in a PR
- Playground with no signup: stampbench.com/playground

Being straight about the state of it: it's new, it's not certification-grade (run KoSIT
for that), and stampbench.com/trust lists the three official test documents where we
currently disagree with the reference validator. There's also an existing player,
eleata.io, if you want to compare — the main difference is that we validate locally
instead of uploading your invoices.

Feedback on the DX especially welcome from anyone who's integrated KoSIT or hand-rolled UBL.

*(Mod note: my own project, first post about it here.)*

## 3. r/selbststaendig (auf Deutsch)

**Titel:** E-Rechnungspflicht 2027/2028: kostenloses Tool zum Prüfen von XRechnungen (Eigenentwicklung)

**Text:**

Hallo zusammen — vorab: Eigenwerbung, aber hoffentlich nützliche. Kurz der Stand, weil
dazu immer noch viel Unsicherheit herrscht:

- **Seit 01.01.2025** müssen alle Unternehmen in Deutschland E-Rechnungen **empfangen**
  können — auch Kleinunternehmer und Solo-Selbstständige. Ein E-Mail-Postfach reicht
  dafür grundsätzlich aus.
- **Ab 01.01.2027** müssen Unternehmen mit mehr als 800.000 € Vorjahresumsatz
  E-Rechnungen **ausstellen**.
- **Ab 01.01.2028** gilt die Ausstellungspflicht für alle.
- Wichtig: Eine **PDF ist keine E-Rechnung**. Gemeint sind strukturierte Formate wie
  XRechnung oder ZUGFeRD (Norm EN 16931).

Ich bin Entwickler und habe dafür ein Werkzeug gebaut: **Stampbench**
(stampbench.com/playground). Was davon nützlich sein könnte:

- **Kostenloser Online-Check:** XRechnung hochladen, und ihr seht sofort, ob sie gültig
  ist — mit **verständlicher Erklärung auf Deutsch** zu jedem Fehler. Statt „BR-DE-15"
  steht dann z. B. „Die Käuferreferenz (Leitweg-ID) fehlt."
- Die Prüfung läuft **komplett im Browser** — eure Rechnungsdaten werden nicht hochgeladen.
- Für alle, die Rechnungen aus eigener Software erzeugen, gibt es die Open-Source-Bibliothek.

Ehrlich dazusagen muss ich: Das Projekt ist neu, und es ersetzt **keine
zertifizierte Prüfung** — für rechtlich verbindliche Fälle bitte zusätzlich den
offiziellen KoSIT-Validator nutzen. Auf stampbench.com/trust steht offen, bei welchen
drei offiziellen Testdokumenten unser Ergebnis derzeit vom Referenzvalidator abweicht.

Der Check kostet nichts und erfordert keine Registrierung. Fragen zur E-Rechnungspflicht
beantworte ich hier gern, auch unabhängig vom Tool. Falls die Mods das als zu werblich
einstufen, nehme ich den Post natürlich raus.

## 4. dev.to article (outline)

**Title:** How to generate a valid XRechnung (German e-invoice) in Node.js

1. **The 90-second regulatory brief** — what EN 16931/XRechnung is, the 2025/2027/2028
   dates, why "just send a PDF" stopped being legal advice.
2. **The format** — UBL 2.1 XML, BT/BG term model, what a minimal valid invoice actually
   contains (annotated 40-line example).
3. **Why validation is the hard part** — the rule families (syntax, arithmetic BR-CO,
   VAT BR-S/E/G, German CIUS BR-DE) with one concrete failing example each.
4. **Doing it in Node** — `npm install @stampbench/core`; generate from line items; show
   that totals are computed automatically; validate; deliberately break it and show the
   plain-language error.
5. **Why you should never round-trip a customer document** — the 74.1% element-retention
   measurement, and what that implies for anyone building repair tooling.
6. **Edge cases that will bite you** — reverse charge, Kleinunternehmer VAT exemption
   (BR-O), credit notes, rounding.
7. **Production checklist** — where to validate in your pipeline, the Leitweg-ID for B2G,
   storing XML alongside the human-readable PDF.
8. **Closing** — MIT library; playground link; honest limitations (not certification-grade,
   published divergences).

*Series potential: same article re-targeted per framework, mapping to the docs
quickstarts in `seo-strategy.md`.*

## 5. X/Twitter thread (6 tweets)

**1/**
Germany quietly created one of the biggest compliance deadlines in software: from 2027,
every domestic B2B invoice must be structured XML (EN 16931 / XRechnung). Receiving has
been mandatory since 2025.

If your product creates invoices for German customers, this is now your problem.

**2/**
The state of the tooling:

- Official validator: Java, Schematron, self-hosted
- Errors look like this: "BR-DE-15"
- That's it. That's the error.

**3/**
So I built Stampbench.

npx stampbench validate invoice.xml

Validates UBL + CII against EN 16931 and the German CIUS, locally. MIT licensed. No Java.
Your invoice bytes never leave the machine.

**4/**
The part I care most about: it doesn't just judge, it repairs. `stampbench fix` edits the
original document and tells you what it changed.

It will never invent business data — guessing a missing VAT ID turns "invalid" into
"quietly wrong", which then passes validation.

**5/**
Design decision I like: you never write invoice totals. You give line items and the
library computes every total the spec requires, so the arithmetic rules (BR-CO-*) pass
by construction.

**6/**
It's new, and it's not certification-grade — for anything binding, also run KoSIT.
stampbench.com/trust publishes the three official test documents where we currently
disagree with the reference validator.

Playground (no signup): stampbench.com/playground
GitHub: github.com/harveylegge/stampbench

## 6. LinkedIn post

**Deadline your roadmap probably hasn't priced in: January 2027.**

From that date, German companies must issue structured e-invoices (EN 16931 / XRechnung)
for domestic B2B trade — and since January 2025 they've already been required to receive
them. France follows. If your software produces invoices for German customers,
compliance isn't optional and a PDF doesn't count.

The tooling for this is almost entirely Java, and its error messages are spec codes like
"BR-DE-15". So I built the missing TypeScript piece.

Stampbench is an open-source library (MIT) that validates, repairs and generates
XRechnung locally — your invoice data stays on your own infrastructure. Every validation
failure comes with a plain-language explanation, in English or German, and where possible
an automatic in-place fix.

It's early, and I'd rather say so than oversell: it isn't a replacement for certified
validation, and the trust page publishes the cases where we currently disagree with the
official validator.

If you're scoping what the mandate means for your stack, the playground needs no signup:
stampbench.com/playground

*(Post as founder; 3–5 hashtags maximum: #eRechnung #XRechnung #eInvoicing. Reply to
every comment within a day.)*
