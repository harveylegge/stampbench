/**
 * Markets — the single source of truth for "where does your business operate?"
 *
 * Stampbench is invoice infrastructure that happens to have unusually deep
 * German coverage, not a German validator. This file is what keeps that
 * distinction honest: every market declares which ruleset actually runs for it
 * and, just as importantly, which capabilities are *not* implemented. Nothing
 * here may claim coverage the engine does not have — a market page that
 * overstates is worse than no market page, because the whole product rests on
 * never overstating (see /trust).
 *
 * The engine has exactly two profiles today:
 *
 *   en16931   40 rules  EN 16931-1:2017 core — the European semantic standard
 *   xrechnung 56 rules  the above plus 16 German BR-DE rules (XRechnung 3.0)
 *
 * So a market's "capability" is really the answer to two questions: which of
 * those two rulesets is the sensible default, and what does Stampbench
 * genuinely not do for you here. Both are answered per market below.
 *
 * Rule counts are duplicated here as constants rather than imported from
 * @stampbench/core, because this module is pulled into the landing-page bundle
 * and the engine is not something a marketing page should ship. A test in
 * tests/web.test.ts asserts these numbers against the real engine, so they
 * cannot drift silently.
 */

export const MARKET_IDS = ['uk', 'us', 'eu', 'germany', 'multi'] as const;
export type MarketId = (typeof MARKET_IDS)[number];

/** The profile ids the engine accepts. Mirrors `Profile` in @stampbench/core. */
export type MarketProfile = 'en16931' | 'xrechnung';

/** Rule counts per profile — asserted against the engine by test. */
export const RULE_COUNTS: Record<MarketProfile, number> = {
  en16931: 40,
  xrechnung: 56,
};

/** BT-24 specification identifiers, mirrored from @stampbench/core codes. */
export const SPEC_IDS = {
  en16931: 'urn:cen.eu:en16931:2017',
  xrechnung: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
} as const;

export const RULESETS: Record<MarketProfile, { id: string; label: string; spec: string }> = {
  en16931: { id: 'en16931@2017', label: 'EN 16931 core', spec: 'EN 16931-1:2017' },
  xrechnung: { id: 'xrechnung@3.0', label: 'XRechnung 3.0 (German CIUS)', spec: 'XRechnung 3.0' },
};

/**
 * How a capability stands in a given market.
 *
 * 'yes'      — implemented and it applies here today.
 * 'context'  — implemented, but only relevant in a specific named situation.
 * 'no'       — not implemented. Said plainly, never softened into a maybe.
 */
export type CapabilityStatus = 'yes' | 'context' | 'no';

export const CAPABILITY_IDS = [
  'validate',
  'syntaxes',
  'repair',
  'generate',
  'xrechnung',
  'tooling',
  'domestic',
  'rates',
  'network',
] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export interface CapabilityRow {
  id: CapabilityId;
  name: string;
  /** What the capability actually does — no adjectives, just behaviour. */
  detail: string;
}

/** The rows every market is scored against, in display order. */
export const CAPABILITIES: CapabilityRow[] = [
  {
    id: 'validate',
    name: 'Invoice validation',
    detail: `${RULE_COUNTS.en16931} EN 16931 core rules, including the full BR-S/E/AE/Z/G/O VAT category families. Every violation carries the rule id, the business term and the line it failed on.`,
  },
  {
    id: 'syntaxes',
    name: 'Reads both XML syntaxes',
    detail:
      'UBL 2.1 and UN/CEFACT CII (the syntax ZUGFeRD and Factur-X carry), auto-detected from the document.',
  },
  {
    id: 'repair',
    name: 'Deterministic repair',
    detail:
      'Totals and VAT amounts that disagree with the figures they are computed from have exactly one right answer, so Stampbench corrects them in your file. Anything it cannot derive is handed back to a person.',
  },
  {
    id: 'generate',
    name: 'Invoice creation from JSON',
    detail:
      'Send lines with quantities, prices and VAT categories; Stampbench computes the totals and the VAT breakdown, then emits UBL 2.1.',
  },
  {
    id: 'xrechnung',
    name: 'German XRechnung profile',
    detail: `A further ${RULE_COUNTS.xrechnung - RULE_COUNTS.en16931} BR-DE rules on top of the European core — the Leitweg-ID, buyer reference and contact requirements German public buyers enforce.`,
  },
  {
    id: 'tooling',
    name: 'CLI, hosted API and CI',
    detail:
      'The same engine as an npm library, a CLI, a hosted REST API and a GitHub Action that annotates the failing line in a pull request.',
  },
  {
    id: 'domestic',
    name: 'A domestic ruleset for this country',
    detail:
      'A national customisation of EN 16931 (a CIUS) with its own rules, on top of the European core.',
  },
  {
    id: 'rates',
    name: 'Deciding which tax rate to charge',
    detail:
      'Stampbench checks that the tax figures in a document are internally consistent and correctly declared. It does not decide which rate applies to a transaction.',
  },
  {
    id: 'network',
    name: 'Sending invoices over a network',
    detail:
      'Transmission through Peppol or a national exchange. Stampbench validates and produces documents; delivering them is someone else’s job today.',
  },
];

export interface MarketCapability {
  status: CapabilityStatus;
  /** Market-specific qualifier. Required whenever status is 'context'. */
  note?: string;
}

export interface Market {
  id: MarketId;
  /** Country/region code used by the flag component. */
  flag: 'gb' | 'us' | 'eu' | 'de' | 'globe';
  /** Full name, e.g. "United Kingdom". */
  name: string;
  /** Short label for chips and table columns, e.g. "UK". */
  short: string;
  /** Adjectival form, so buttons read "a German invoice" not "a Germany invoice". */
  adjective: string;
  /** One line on the homepage card. */
  tagline: string;
  /** Which profile the playground defaults to for this market. */
  profile: MarketProfile;
  /** Page headline. */
  headline: string;
  /** The honest position, first paragraph. Sets expectations before features. */
  stance: string;
  /** The one thing this market should do next. */
  primaryUse: string;
  capabilities: Record<CapabilityId, MarketCapability>;
  /** Whether a /markets/<id> page exists. */
  hasPage: boolean;
}

/** Capabilities every market shares, because they are properties of the engine. */
const ENGINE_BASELINE = {
  validate: { status: 'yes' } as MarketCapability,
  syntaxes: { status: 'yes' } as MarketCapability,
  repair: { status: 'yes' } as MarketCapability,
  generate: { status: 'yes' } as MarketCapability,
  tooling: { status: 'yes' } as MarketCapability,
  rates: { status: 'no' } as MarketCapability,
  network: { status: 'no' } as MarketCapability,
};

export const MARKETS: Record<MarketId, Market> = {
  uk: {
    id: 'uk',
    flag: 'gb',
    name: 'United Kingdom',
    short: 'UK',
    adjective: 'UK',
    tagline: 'EN 16931 validation for the invoices your customers and their portals ask for.',
    profile: 'en16931',
    headline: 'Stampbench for UK businesses',
    stance:
      'Stampbench does not implement a UK-specific ruleset, and we will not pretend otherwise. What it gives a UK business today is the European semantic standard — EN 16931 — plus the format-agnostic tooling around it: reading both invoice XML syntaxes, repairing what is arithmetically wrong, generating documents whose totals cannot be wrong, and the CLI, API and CI integration.',
    primaryUse:
      'If a customer, a public body or their portal asks you for an EN 16931-compliant e-invoice, this is the ruleset that checks it — before they reject it.',
    capabilities: {
      ...ENGINE_BASELINE,
      xrechnung: {
        status: 'context',
        note: 'Available when you invoice a German buyer — switch the market to Germany and the same document is checked against 56 rules instead of 40.',
      },
      domestic: {
        status: 'no',
        note: 'There is no UK ruleset in the engine. If a UK customisation of EN 16931 is published, the ruleset registry is the extension point it would be added to — but nothing is implemented today.',
      },
    },
    hasPage: true,
  },

  us: {
    id: 'us',
    flag: 'us',
    name: 'United States',
    short: 'US',
    adjective: 'US',
    tagline: 'Structured invoicing and validation for US businesses billing across borders.',
    profile: 'en16931',
    headline: 'Stampbench for US businesses',
    stance:
      'Stampbench implements no US rules and no sales-tax logic. It is structured-invoice infrastructure: it reads and writes the XML formats European customers and their portals expect, checks a document against the European standard, and repairs what is provably wrong. If your invoicing is entirely domestic US, most of that is not yet useful to you — better to hear it now.',
    primaryUse:
      'The common case: you bill customers in Europe, one of them asks for an e-invoice in a format you have never heard of, and you need to produce and check one.',
    capabilities: {
      ...ENGINE_BASELINE,
      xrechnung: {
        status: 'context',
        note: 'Available when you invoice a German buyer — switch the market to Germany for the additional 16 German rules.',
      },
      domestic: {
        status: 'no',
        note: 'No US ruleset, and no sales-tax determination: Stampbench checks that the tax figures in a document are consistent, not which rate should have been applied.',
      },
    },
    hasPage: true,
  },

  eu: {
    id: 'eu',
    flag: 'eu',
    name: 'European Union',
    short: 'EU',
    adjective: 'European',
    tagline: 'The EN 16931 core, plus the German CIUS in full depth.',
    profile: 'en16931',
    headline: 'Stampbench for the European Union',
    stance:
      'This is where Stampbench is deepest. Every invoice is checked against EN 16931-1:2017, the semantic standard the member-state formats are customisations of, and both syntaxes are read: UBL 2.1 and CII, the syntax ZUGFeRD and Factur-X carry. One national customisation is implemented in full — Germany’s XRechnung 3.0. The others are not, and are listed as such rather than implied.',
    primaryUse:
      'Validate against the European core, then switch to a national profile when the buyer’s country has one implemented.',
    capabilities: {
      ...ENGINE_BASELINE,
      xrechnung: { status: 'yes' },
      domestic: {
        status: 'context',
        note: 'Germany (XRechnung 3.0) is the one national CIUS implemented today. France, Italy and the rest are validated against the European core only — Factur-X profiles, FatturaPA and Peppol BIS rules are not implemented.',
      },
    },
    hasPage: true,
  },

  germany: {
    id: 'germany',
    flag: 'de',
    name: 'Germany',
    short: 'Germany',
    adjective: 'German',
    tagline: 'XRechnung 3.0 and ZUGFeRD, 56 rules, with the failing line pointed at.',
    profile: 'xrechnung',
    headline: 'Stampbench for Germany — XRechnung and ZUGFeRD',
    stance:
      'The deepest coverage in the product. The German CIUS runs 56 rules: the 40 European core rules plus 16 BR-DE rules covering the Leitweg-ID, the buyer reference, seller contact details and the German payment-means requirements. Both syntaxes German invoices actually arrive in are read — UBL and the CII XML inside ZUGFeRD / Factur-X — and generation emits the XRechnung 3.0 customization id.',
    primaryUse:
      'Run an XRechnung through it, get the rule id, the business term and the line number, and repair the arithmetic errors in place.',
    capabilities: {
      ...ENGINE_BASELINE,
      xrechnung: { status: 'yes' },
      domestic: { status: 'yes' },
    },
    hasPage: true,
  },

  multi: {
    id: 'multi',
    flag: 'globe',
    name: 'Multiple markets',
    short: 'Multi-market',
    adjective: 'multi-market',
    tagline: 'Compare what Stampbench covers everywhere, side by side.',
    profile: 'en16931',
    headline: 'Stampbench across markets',
    stance:
      'If you invoice into several countries, the useful view is the comparison: which rules run where, and what is not implemented anywhere.',
    primaryUse: 'Validate against the European core by default, and switch profile per document.',
    capabilities: {
      ...ENGINE_BASELINE,
      xrechnung: { status: 'yes' },
      domestic: {
        status: 'context',
        note: 'Germany only. Every other market is validated against the European core.',
      },
    },
    hasPage: false,
  },
};

/** Markets shown as cards on the homepage, in order. */
export const PICKER_MARKETS: MarketId[] = ['uk', 'us', 'eu', 'multi'];

/** Markets with their own page, in order. */
export const PAGE_MARKETS: MarketId[] = ['uk', 'us', 'eu', 'germany'];

export function isMarketId(value: unknown): value is MarketId {
  return typeof value === 'string' && (MARKET_IDS as readonly string[]).includes(value);
}

export function getMarket(id: MarketId): Market {
  return MARKETS[id];
}

/** The route for a market — 'multi' has no page of its own, so it lands on the index. */
export function marketHref(id: MarketId): string {
  return MARKETS[id].hasPage ? `/markets/${id}` : '/markets';
}

/** Ruleset metadata for whichever profile a market defaults to. */
export function rulesetFor(id: MarketId) {
  const profile = MARKETS[id].profile;
  return { profile, ...RULESETS[profile], ruleCount: RULE_COUNTS[profile] };
}

/**
 * What a document says it is. BT-24 (the specification identifier) is written
 * by whoever produced the invoice and is the one field that names its profile,
 * so reading it is detection rather than guessing — but it is still only what
 * the *sender* claims, which is why the UI offers a switch instead of silently
 * changing ruleset.
 */
export function profileFromSpecId(specificationIdentifier?: string): MarketProfile | null {
  if (!specificationIdentifier) return null;
  const value = specificationIdentifier.toLowerCase();
  if (value.includes('xrechnung')) return 'xrechnung';
  if (value.includes('en16931')) return 'en16931';
  return null;
}
