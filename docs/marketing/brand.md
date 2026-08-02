# InvoiceGate — Brand Guide

## 1. Brand voice

InvoiceGate speaks like a senior engineer explaining a regulation to a colleague: precise, calm, and useful. We sell certainty in a domain full of anxiety (compliance deadlines, cryptic validators, legal risk) — so the voice never adds to the anxiety. It removes it.

### Principles

1. **Concrete over clever.** Name the rule, the deadline, the format. "BR-DE-15 means the buyer reference is missing" beats "we demystify compliance".
2. **Show the code.** Wherever a claim can be demonstrated with a snippet, use the snippet. Code is our most persuasive asset.
3. **Respect the reader's time.** Front-load the answer. No throat-clearing paragraphs, no "in today's fast-paced world".
4. **Honest about scope.** We say what we don't do (no Peppol transmission yet, no ZUGFeRD hybrid PDF yet — if true at the time). Developers reward candour and punish overreach.
5. **Calm about deadlines.** The 2027/2028 mandate is our tailwind, but we state it as fact, not fear. Never "don't get fined!" — always "here's the date, here's what it requires, here's the fix".

### Do / Don't

| Do | Don't |
| --- | --- |
| "Validates against all 200+ EN 16931 and XRechnung business rules, locally, in milliseconds." | "Blazingly fast, enterprise-grade compliance engine." |
| "Free for 100 API calls a month. The open-source library is free forever." | "Start your journey today!" |
| "The official KoSIT validator is excellent — but it's Java, self-hosted, and its errors assume you've read the spec." | Trash-talking competitors. |
| "Totals are computed for you, so the BR-CO arithmetic rules pass by construction." | "AI-powered next-generation invoice intelligence." |
| Sentence case headings. Full stops. British English. | Title Case Everywhere, exclamation marks, Americanisms. |

### Words we use / avoid

- **Use:** validate, generate, rule, mandate, deadline, locally, open source, deterministic, by construction, plain language.
- **Avoid:** revolutionise, seamless, empower, unlock, supercharge, game-changing, "AI magic". ("AI-powered" is acceptable once, factually, when describing error explanations — never as a headline noun.)

## 2. Positioning statement

> For developers who must make their product issue or accept German e-invoices, **InvoiceGate** is the TypeScript-first validation and generation toolkit that turns EN 16931 / XRechnung compliance into an `npm install` — unlike the Java-centric official tooling, which requires self-hosting the KoSIT validator and decoding rule IDs like BR-DE-15 by hand.

## 3. One-liner

> **German e-invoicing compliance, as a TypeScript library and an API.**

Alternates (for character-limited contexts):

- "Validate and generate XRechnung e-invoices from Node.js."
- "EN 16931 compliance without the Java."
- "The e-invoicing toolkit for TypeScript developers."

## 4. Boilerplate

### Short (~30 words)

InvoiceGate validates and generates EN 16931 / XRechnung e-invoices. Open-source TypeScript library for local validation, hosted API for scale, and plain-language explanations for every cryptic validation error.

### Medium (~70 words)

InvoiceGate is the TypeScript-first toolkit for Germany's e-invoicing mandate. The open-source `@invoicegate/core` library validates and generates XRechnung (UBL) invoices locally — free forever, MIT-licensed. The hosted API at invoicegate.dev adds validation and generation endpoints, a web playground, and AI-generated plain-language explanations for errors like BR-DE-15. Totals are computed automatically, so the EN 16931 arithmetic rules pass by construction.

### Long (~140 words)

Since January 2025, every German company must be able to receive structured e-invoices; by January 2027 (2028 for the smallest), they must issue them. France and other EU states follow. That obligation lands on every piece of software that produces an invoice — and the existing tooling is almost entirely Java: the official KoSIT validator, the Mustang project, self-hosted Schematron pipelines.

InvoiceGate brings e-invoicing compliance to the TypeScript ecosystem. The MIT-licensed `@invoicegate/core` library validates and generates EN 16931 / XRechnung (UBL) invoices locally, with unlimited use, free forever. The hosted platform at invoicegate.dev adds a REST API, a web playground, usage dashboards, and AI-generated plain-language explanations that turn errors like "BR-DE-15" into a sentence and a fix. Generated invoices compute their own totals, so the BR-CO arithmetic rules pass by construction. Built by an independent developer in the UK.

## 5. Colour palette

Dark, premium, restrained — Linear-adjacent. One electric accent doing all the work; everything else stays quiet.

### Core

| Token | Hex | Use |
| --- | --- | --- |
| `bg-base` | `#0B0B10` | Page background (near-black, faint violet cast) |
| `bg-raised` | `#12121A` | Cards, panels, code blocks |
| `bg-overlay` | `#1A1A26` | Modals, dropdowns, hover states |
| `border-subtle` | `#23232F` | Hairline borders, dividers |
| `border-strong` | `#33334A` | Input borders, focused cards |
| `text-primary` | `#EDEDF2` | Headings, body on dark |
| `text-secondary` | `#9C9CB0` | Supporting copy, labels |
| `text-tertiary` | `#63637A` | Placeholders, timestamps |

### Accent — "Volt Indigo"

| Token | Hex | Use |
| --- | --- | --- |
| `accent` | `#6E5BFF` | Primary buttons, links, active states, logo mark |
| `accent-hover` | `#8577FF` | Hover/focus on accent elements |
| `accent-muted` | `#6E5BFF` at 12% alpha | Selected rows, badges, subtle highlights |
| `accent-deep` | `#4B3DD6` | Pressed states, gradients (pair with `accent`) |

Signature gradient (hero glows, OG images): `#6E5BFF → #B44BFF`, used sparingly at low opacity on `bg-base`.

### Semantic

| Token | Hex | Use |
| --- | --- | --- |
| `success` | `#2FD180` | Valid invoice, passing rule |
| `warning` | `#F5B83D` | Warnings (rules that flag but don't fail) |
| `error` | `#F4506A` | Failed rules, invalid XML |
| `info` | `#4CC3FF` | Notices, docs callouts |

Validation UI convention: passing rules get `success` ticks, failures get `error` with the rule ID set in JetBrains Mono — the red monospace rule ID is a recurring visual signature across product, docs, and marketing screenshots.

## 6. Typography

- **Inter** — all UI and marketing text. Weights: 400 (body), 500 (UI labels, nav), 600 (headings), 700 (hero only). Tight tracking on large headings (−0.02em). Use tabular numerals (`font-feature-settings: "tnum"`) in dashboards and pricing tables.
- **JetBrains Mono** — code, XML snippets, rule IDs (BR-DE-15), API keys, amounts in validation output. Weight 400; 500 for inline emphasis. Never italic.

Rule of thumb: if it could appear in a terminal or an XML file, it's JetBrains Mono; everything else is Inter. Inline rule IDs in body copy are always mono with an `accent-muted` background chip.

## 7. Logo concept

**The Gate mark.** Two vertical strokes joined by a raised crossbar — a stylised gate that reads equally as a pair of brackets and as the Π-like frame of a checkpoint. Inside the gate sits a single checkmark tick, slightly overlapping the right stroke, as if an invoice has just passed through validation. Geometry drawn on a square grid with the same stroke weight throughout; corners softly rounded (radius ≈ 1/8 stroke width) to match Inter's character.

- **Colour:** mark in `accent` (#6E5BFF) on dark; the tick in `success` (#2FD180) is permitted in product UI contexts, but the marketing/default lock-up is monochrome accent for restraint.
- **Wordmark:** "InvoiceGate" set in Inter SemiBold, single colour `text-primary`, no camel-case colour split. Mark sits left of the wordmark at cap height.
- **Favicon / avatar:** the gate mark alone on `bg-base`.
- **Feel:** the mark should feel like a linting checkmark and a border checkpoint at once — validation as passage, not obstruction.
