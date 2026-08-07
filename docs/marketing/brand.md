# Stampbench — Brand Guide

## 1. Brand voice

Stampbench speaks like a senior engineer explaining a regulation to a colleague: precise, calm, and useful. We sell certainty in a domain full of anxiety (compliance deadlines, cryptic validators, legal risk) — so the voice never adds to the anxiety. It removes it.

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

> For developers who must make their product issue or accept German e-invoices, **Stampbench** is the TypeScript-first validation and generation toolkit that turns EN 16931 / XRechnung compliance into an `npm install` — unlike the Java-centric official tooling, which requires self-hosting the KoSIT validator and decoding rule IDs like BR-DE-15 by hand.

## 3. One-liner

> **German e-invoicing compliance, as a TypeScript library and an API.**

Alternates (for character-limited contexts):

- "Validate and generate XRechnung e-invoices from Node.js."
- "EN 16931 compliance without the Java."
- "The e-invoicing toolkit for TypeScript developers."

## 4. Boilerplate

### Short (~30 words)

Stampbench validates and generates EN 16931 / XRechnung e-invoices. Open-source TypeScript library for local validation, hosted API for scale, and plain-language explanations for every cryptic validation error.

### Medium (~70 words)

Stampbench is the TypeScript-first toolkit for Germany's e-invoicing mandate. The open-source `@stampbench/core` library validates and generates XRechnung (UBL) invoices locally — free forever, MIT-licensed. The hosted API at stampbench.com adds validation and generation endpoints, a web playground, and AI-generated plain-language explanations for errors like BR-DE-15. Totals are computed automatically, so the EN 16931 arithmetic rules pass by construction.

### Long (~140 words)

Since January 2025, every German company must be able to receive structured e-invoices; by January 2027 (2028 for the smallest), they must issue them. France and other EU states follow. That obligation lands on every piece of software that produces an invoice — and the existing tooling is almost entirely Java: the official KoSIT validator, the Mustang project, self-hosted Schematron pipelines.

Stampbench brings e-invoicing compliance to the TypeScript ecosystem. The MIT-licensed `@stampbench/core` library validates and generates EN 16931 / XRechnung (UBL) invoices locally, with unlimited use, free forever. The hosted platform at stampbench.com adds a REST API, a web playground, usage dashboards, and AI-generated plain-language explanations that turn errors like "BR-DE-15" into a sentence and a fix. Generated invoices compute their own totals, so the BR-CO arithmetic rules pass by construction. Built by an independent developer in the UK.

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

### Accent — "Stampbench Purple"

| Token | Hex | Use |
| --- | --- | --- |
| `accent` | `#6D4AF2` | Primary buttons, links, active states, logo mark |
| `accent-hover` | `#5333CC` | Hover/focus/pressed on accent elements |
| `accent-muted` | `#6D4AF2` at 12% alpha (solid: `#E9E3FC`) | Selected rows, badges, subtle highlights, lavender panels |
| `accent-deep` | `#5B2EE8` | Gradient end, dark-on-purple pairings |

Signature gradient (the logo mark, hero glows, OG images): `#8B63F9 → #5B2EE8`, top-left to bottom-right. On the marketing site the accent family maps to the light-theme tokens `--color-accent` / `--color-accent-hi` / `--color-accent-dim` in `apps/web/app/globals.css`.

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

## 7. Logo

**The S monogram.** A geometric "S" built from two interlocking hooks on a square grid: the upper hook in the accent gradient (`#8B63F9 → #5B2EE8`), the lower hook in ink (near-black on light, white on dark). The bar terminals and the seam where the two hooks meet are cut on the same diagonal, so the halves read as two stamped strokes locking together — validation as two parts fitting. Reference sheet: `docs/marketing/brand-sheet.png`.

### Lock-ups

- **Primary:** mark left of the wordmark "Stampbench" set in Inter SemiBold, single colour (ink on light, white on dark), no camel-case colour split. Mark sits at cap height.
- **Tagline lock-up:** wordmark with "E-invoicing Compliance API" beneath, letter-spaced caps, `text-secondary`. Marketing hero and OG images only — never in product UI.
- **Stacked:** mark centred above the wordmark, for square-ish placements.
- **App icon / avatar:** the mark at 70% on a `#0B0B10` rounded square (radius ≈ 14/64). This is also the favicon (`apps/web/app/icon.svg`).

### Colour rules

- On light backgrounds: gradient top hook + `#16161D` bottom hook.
- On dark backgrounds: gradient top hook + white bottom hook.
- On accent-purple or busy backgrounds: solid white, both hooks.
- Never recolour the hooks individually beyond these three treatments; never outline the mark.

### Assets

SVG masters live in `apps/web/public/brand/`:

| File | Use |
| --- | --- |
| `stampbench-mark.svg` | Mark on light backgrounds |
| `stampbench-mark-dark.svg` | Mark on dark backgrounds |
| `stampbench-mark-white.svg` | Solid white mark for purple/photo backgrounds |
| `stampbench-icon.svg` | App icon / avatar tile |

In the web app the mark is inlined as the `LogoMark` component (`apps/web/components/nav-links.tsx`) so its fills follow the theme tokens.
