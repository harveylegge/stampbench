/**
 * Which document a market can actually produce.
 *
 * The temptation in a generator is to list every format a buyer might have
 * heard of and quietly produce the same UBL for all of them. This table
 * refuses to: a format is either implemented end-to-end (model → XML →
 * validated by the shipped ruleset) or it is listed as not implemented, with
 * the reason. `@stampbench/core` reads CII but has no CII *writer*, so
 * ZUGFeRD and Factur-X are honestly unavailable here however much they would
 * flatter the feature list.
 *
 * `validationProfile: null` means the output is a document Stampbench can
 * build but has no ruleset for. It still gets structured JSON and a printable
 * document; it does not get a compliance verdict, and the UI says so instead
 * of showing a green tick that means nothing.
 */
import type { MarketId } from '@/lib/markets';
import { RULE_COUNTS, RULESETS, type MarketProfile } from '@/lib/markets';

export type SupportLevel = 'supported' | 'partial' | 'not-implemented';

export type OutputKind = 'xml' | 'json' | 'print';

export interface InvoiceFormat {
  id: string;
  name: string;
  /** One line under the name in the picker. */
  tagline: string;
  /** The honest paragraph, shown when the format is selected. */
  detail: string;
  support: SupportLevel;
  /** Ruleset used to validate the result; null = no ruleset exists for it. */
  validationProfile: MarketProfile | null;
  /** What the user can download. */
  outputs: OutputKind[];
  /** Why it is not implemented — required whenever support is not 'supported'. */
  limitation?: string;
}

export const FORMATS: Record<string, InvoiceFormat> = {
  'xrechnung-ubl': {
    id: 'xrechnung-ubl',
    name: 'XRechnung 3.0 (UBL)',
    tagline: `German CIUS · ${RULE_COUNTS.xrechnung} rules`,
    detail:
      'UBL 2.1 carrying the XRechnung 3.0 customization id, validated against the European core plus the 16 German BR-DE rules. This is the deepest coverage in the product.',
    support: 'supported',
    validationProfile: 'xrechnung',
    outputs: ['xml', 'json', 'print'],
  },
  'en16931-ubl': {
    id: 'en16931-ubl',
    name: 'EN 16931 (UBL)',
    tagline: `European semantic standard · ${RULE_COUNTS.en16931} rules`,
    detail:
      'UBL 2.1 declaring the plain EN 16931 customization id, validated against the 40 core rules and the full VAT category families. The right choice whenever a customer or their portal asks for an EN 16931-compliant invoice and no national profile applies.',
    support: 'supported',
    validationProfile: 'en16931',
    outputs: ['xml', 'json', 'print'],
  },
  commercial: {
    id: 'commercial',
    name: 'Commercial invoice',
    tagline: 'Structured JSON + printable document · no ruleset',
    detail:
      'An ordinary business invoice: the same structured model, the same exact arithmetic, a printable document and canonical JSON — but no national e-invoicing standard is claimed and no compliance verdict is given, because Stampbench has no ruleset for it. Use this where a plain invoice is what the customer wants.',
    support: 'supported',
    validationProfile: null,
    outputs: ['json', 'print'],
    limitation:
      'Not a structured e-invoicing standard. Stampbench will check the totals arithmetic but cannot tell you whether the document satisfies any legal requirement.',
  },
  'zugferd-cii': {
    id: 'zugferd-cii',
    name: 'ZUGFeRD / Factur-X (CII)',
    tagline: 'Not implemented — reading only',
    detail:
      'Stampbench reads and validates CII, the syntax inside ZUGFeRD and Factur-X, and the playground handles those documents today. It cannot write them: the engine has a UBL writer and no CII writer.',
    support: 'not-implemented',
    validationProfile: null,
    outputs: [],
    limitation:
      'No CII writer exists in @stampbench/core. Validation of ZUGFeRD / Factur-X documents you already have works today — use the playground.',
  },
  'peppol-bis': {
    id: 'peppol-bis',
    name: 'Peppol BIS Billing 3.0',
    tagline: 'Not implemented',
    detail:
      'The Peppol BIS rules are a further customisation on top of EN 16931, and Stampbench does not implement them. Generated UBL carries the Peppol billing process id (BT-23) because XRechnung requires it, which is not the same thing as being Peppol BIS validated.',
    support: 'not-implemented',
    validationProfile: null,
    outputs: [],
    limitation: 'No Peppol BIS ruleset and no network transmission. Neither is on this page.',
  },
  fatturapa: {
    id: 'fatturapa',
    name: 'FatturaPA (Italy)',
    tagline: 'Not implemented',
    detail: 'The Italian national format is neither generated nor validated by Stampbench today.',
    support: 'not-implemented',
    validationProfile: null,
    outputs: [],
    limitation: 'No FatturaPA schema or ruleset in the engine.',
  },
};

/**
 * Formats offered per market, best first. Unimplemented ones are listed too —
 * a visitor asking "can it do ZUGFeRD?" deserves the answer on the page
 * rather than the absence of an option they then assume is coming.
 */
export const MARKET_FORMATS: Record<MarketId, string[]> = {
  germany: ['xrechnung-ubl', 'en16931-ubl', 'commercial', 'zugferd-cii', 'peppol-bis'],
  eu: ['en16931-ubl', 'xrechnung-ubl', 'commercial', 'zugferd-cii', 'fatturapa', 'peppol-bis'],
  uk: ['en16931-ubl', 'commercial', 'peppol-bis'],
  us: ['commercial', 'en16931-ubl', 'peppol-bis'],
  multi: ['en16931-ubl', 'xrechnung-ubl', 'commercial', 'zugferd-cii', 'peppol-bis'],
};

/** The format a market opens on. */
export const DEFAULT_FORMAT: Record<MarketId, string> = {
  germany: 'xrechnung-ubl',
  eu: 'en16931-ubl',
  uk: 'en16931-ubl',
  us: 'commercial',
  multi: 'en16931-ubl',
};

export function getFormat(id: string): InvoiceFormat {
  return FORMATS[id] ?? FORMATS['en16931-ubl']!;
}

export function formatsForMarket(market: MarketId): InvoiceFormat[] {
  return (MARKET_FORMATS[market] ?? MARKET_FORMATS.multi).map(getFormat);
}

export function isUsable(format: InvoiceFormat): boolean {
  return format.support !== 'not-implemented';
}

/** Human label for the ruleset a format validates against. */
export function rulesetLabelFor(format: InvoiceFormat): string {
  if (!format.validationProfile) return 'No ruleset — arithmetic checks only';
  const ruleset = RULESETS[format.validationProfile];
  return `${ruleset.label} · ${RULE_COUNTS[format.validationProfile]} rules`;
}

export const SUPPORT_LABEL: Record<SupportLevel, string> = {
  supported: 'Supported',
  partial: 'Partial',
  'not-implemented': 'Not implemented',
};
