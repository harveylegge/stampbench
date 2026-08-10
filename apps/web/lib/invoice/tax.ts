/**
 * VAT categories, mirrored from the rules the engine actually enforces.
 *
 * Every constraint below is checked by `@stampbench/core`'s BR-S / BR-Z /
 * BR-E / BR-AE / BR-K / BR-G / BR-O families — the rate constraint, the
 * exemption-reason requirement, the buyer-VAT-id requirement. That is the
 * point: the form can guide someone through reverse charge (grey out the
 * rate, require a reason, require the buyer's VAT id) and every one of those
 * behaviours is a real rule they would otherwise have failed on, not a
 * designer's guess about tax law.
 *
 * What this file does NOT do is decide which category applies. Choosing
 * between "exempt" and "reverse charge" is a question about a transaction and
 * its jurisdiction, and getting it wrong is a tax problem, not a formatting
 * problem. Stampbench checks that whatever you declare is internally
 * consistent and correctly expressed. It does not advise.
 */
import { tradeRelation, type TradeRelation } from './countries';

export type VatCategoryCode = 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G' | 'O';

export interface VatCategory {
  code: VatCategoryCode;
  /** Short label for the dropdown. */
  label: string;
  /** What it means, in a sentence a non-specialist can act on. */
  description: string;
  /** 'positive' — a rate above 0; 'zero' — must be 0; 'absent' — no rate at all. */
  rate: 'positive' | 'zero' | 'absent';
  /** BT-120 exemption reason: the engine errors if it is missing. */
  exemptionReason: 'required' | 'forbidden';
  /** The engine requires the buyer's VAT id (BT-48) for these. */
  buyerVatRequired: boolean;
  /** Trade relations where this category is worth offering at all. */
  relations: TradeRelation[];
  /** Suggested BT-120 text — a starting point the user edits, never final. */
  reasonSuggestion?: string;
}

export const VAT_CATEGORIES: VatCategory[] = [
  {
    code: 'S',
    label: 'Standard rate',
    description: 'VAT is charged at a positive rate.',
    rate: 'positive',
    exemptionReason: 'forbidden',
    buyerVatRequired: false,
    relations: ['domestic', 'intra-eu', 'eu-export', 'cross-border'],
  },
  {
    code: 'Z',
    label: 'Zero rated',
    description: 'Taxable, but at 0%. Not the same as exempt.',
    rate: 'zero',
    exemptionReason: 'forbidden',
    buyerVatRequired: false,
    relations: ['domestic', 'intra-eu', 'eu-export', 'cross-border'],
  },
  {
    code: 'E',
    label: 'Exempt from VAT',
    description: 'Outside the scope of VAT charging. Needs a stated reason.',
    rate: 'zero',
    exemptionReason: 'required',
    buyerVatRequired: false,
    relations: ['domestic', 'intra-eu', 'eu-export', 'cross-border'],
    reasonSuggestion: 'Exempt supply',
  },
  {
    code: 'AE',
    label: 'Reverse charge',
    description: 'The buyer accounts for the VAT. Needs their VAT identifier.',
    rate: 'zero',
    exemptionReason: 'required',
    buyerVatRequired: true,
    relations: ['domestic', 'intra-eu', 'cross-border'],
    reasonSuggestion: 'Reverse charge — VAT to be accounted for by the recipient',
  },
  {
    code: 'K',
    label: 'Intra-community supply',
    description: 'Goods or services supplied to a VAT-registered business in another EU member state.',
    rate: 'zero',
    exemptionReason: 'required',
    buyerVatRequired: true,
    relations: ['intra-eu'],
    reasonSuggestion: 'Intra-community supply',
  },
  {
    code: 'G',
    label: 'Export outside the EU',
    description: 'Supplied to a destination outside the EU VAT area.',
    rate: 'zero',
    exemptionReason: 'required',
    buyerVatRequired: false,
    relations: ['eu-export'],
    reasonSuggestion: 'Export outside the EU',
  },
  {
    code: 'O',
    label: 'Not subject to VAT',
    description: 'Outside the scope of VAT entirely. Carries no rate at all.',
    rate: 'absent',
    exemptionReason: 'required',
    buyerVatRequired: false,
    relations: ['domestic', 'intra-eu', 'eu-export', 'cross-border'],
    reasonSuggestion: 'Not subject to VAT',
  },
];

const BY_CODE = new Map(VAT_CATEGORIES.map((c) => [c.code, c]));

export function getVatCategory(code: string | undefined): VatCategory {
  return BY_CODE.get((code ?? 'S') as VatCategoryCode) ?? BY_CODE.get('S')!;
}

/**
 * Categories worth offering for a given pair of countries. Everything the
 * engine supports stays reachable — this only reorders and trims the ones
 * that cannot apply, so an invoice between two British companies is not
 * offered "intra-community supply".
 */
export function categoriesFor(sellerCountry?: string, buyerCountry?: string): VatCategory[] {
  const relation = tradeRelation(sellerCountry, buyerCountry);
  return VAT_CATEGORIES.filter((c) => c.relations.includes(relation));
}

/** True when the rate input should be disabled for this category. */
export function rateIsFixed(category: VatCategory): boolean {
  return category.rate !== 'positive';
}

/** The rate a category forces, or null when the user chooses. */
export function forcedRate(category: VatCategory): number | null {
  if (category.rate === 'zero') return 0;
  if (category.rate === 'absent') return null;
  return null;
}

/**
 * Requirements the selected categories place on the rest of the document,
 * surfaced in the builder *before* validation rejects it. Each one
 * corresponds to a rule the engine will otherwise raise.
 */
export interface CategoryRequirement {
  code: VatCategoryCode;
  message: string;
  /** The rule that enforces it, so the message is checkable. */
  rule: string;
}

export function requirementsFor(codes: VatCategoryCode[]): CategoryRequirement[] {
  const out: CategoryRequirement[] = [];
  const seen = new Set<VatCategoryCode>();
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    const category = getVatCategory(code);
    if (category.exemptionReason === 'required') {
      out.push({
        code,
        rule: `BR-${code}-10`,
        message: `${category.label} needs an exemption reason (BT-120) on the VAT breakdown.`,
      });
    }
    if (category.buyerVatRequired) {
      out.push({
        code,
        rule: `BR-${code}-02`,
        message: `${category.label} needs the buyer's VAT identifier (BT-48).`,
      });
    }
  }
  return out;
}

/**
 * US sales tax. Stated as an explicit non-capability rather than approximated.
 *
 * There is no US ruleset in the engine and no rate lookup: nexus, sourcing
 * rules and thousands of local jurisdictions decide the answer, and a plausible
 * guess on a document someone sends a customer is worse than an empty field.
 * The builder therefore takes a rate and an amount as typed input for US
 * invoices, checks the arithmetic, and says exactly this.
 */
export const US_TAX_NOTE =
  'Stampbench does not determine US sales tax. Enter the rate and amount your own tax process produced — the arithmetic is checked, the rate is not.';
