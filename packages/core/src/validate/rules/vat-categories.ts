/**
 * EN 16931 VAT-category rule families — BR-S, BR-Z, BR-E, BR-AE, BR-K, BR-G,
 * BR-O — plus BR-CO-04. These are the rules real invoices most often break:
 * per-category presence, rate constraints, taxable/VAT arithmetic, and
 * exemption-reason requirements.
 *
 * Rule ids follow the official numbering pattern per family:
 *   -01 breakdown presence/cardinality · -02 party identifier requirements ·
 *   -05 line rate · -06/-07 allowance/charge rate · -08 taxable arithmetic ·
 *   -09 VAT amount · -10 exemption reason.
 * Messages are our own wording. Each family is registered as one engine rule
 * that emits violations carrying the official per-check ids.
 */
import type { AllowanceCharge, Invoice, InvoiceLine, VatBreakdown } from '../../model/invoice.js';
import {
  ROUNDING_TOLERANCE,
  amountsEqual,
  present,
  round2,
  violation,
  type Rule,
  type Violation,
} from '../rule.js';

type FamilyCode = 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G' | 'O';

interface FamilyDef {
  code: FamilyCode;
  label: string;
  /** S groups per rate; the zero/exempt categories form a single group. */
  cardinality: 'atLeastOne' | 'exactlyOne';
  /** Constraint on line/allowance/charge VAT rates carrying this category. */
  rate: 'positive' | 'zero' | 'absent';
  /** Breakdown VAT amount: taxable × rate, or exactly zero. */
  vatAmount: 'computed' | 'zero';
  exemption: 'required' | 'forbidden';
  /** AE (reverse charge) and K (intra-community) also need the buyer's VAT id. */
  buyerVatRequired?: boolean;
}

const FAMILIES: FamilyDef[] = [
  { code: 'S', label: 'standard rate', cardinality: 'atLeastOne', rate: 'positive', vatAmount: 'computed', exemption: 'forbidden' },
  { code: 'Z', label: 'zero-rated', cardinality: 'exactlyOne', rate: 'zero', vatAmount: 'zero', exemption: 'forbidden' },
  { code: 'E', label: 'exempt', cardinality: 'exactlyOne', rate: 'zero', vatAmount: 'zero', exemption: 'required' },
  { code: 'AE', label: 'reverse charge', cardinality: 'exactlyOne', rate: 'zero', vatAmount: 'zero', exemption: 'required', buyerVatRequired: true },
  { code: 'K', label: 'intra-community supply', cardinality: 'exactlyOne', rate: 'zero', vatAmount: 'zero', exemption: 'required', buyerVatRequired: true },
  { code: 'G', label: 'export outside the EU', cardinality: 'exactlyOne', rate: 'zero', vatAmount: 'zero', exemption: 'required' },
  { code: 'O', label: 'not subject to VAT', cardinality: 'exactlyOne', rate: 'absent', vatAmount: 'zero', exemption: 'required' },
];

interface Usage {
  lines: Array<{ line: InvoiceLine; index: number }>;
  allowances: Array<{ ac: AllowanceCharge; index: number }>;
  charges: Array<{ ac: AllowanceCharge; index: number }>;
  breakdowns: Array<{ b: VatBreakdown; index: number }>;
}

function usageOf(inv: Invoice, code: FamilyCode): Usage {
  const lines = (inv.lines ?? [])
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.vat?.categoryCode === code);
  const acs = (inv.allowancesCharges ?? []).map((ac, index) => ({ ac, index }));
  return {
    lines,
    allowances: acs.filter(({ ac }) => !ac.isCharge && ac.vatCategoryCode === code),
    charges: acs.filter(({ ac }) => ac.isCharge && ac.vatCategoryCode === code),
    breakdowns: (inv.vatBreakdown ?? [])
      .map((b, index) => ({ b, index }))
      .filter(({ b }) => b.categoryCode === code),
  };
}

function checkRate(
  out: Violation[],
  id: string,
  def: FamilyDef,
  rate: number | undefined,
  where: string,
  path: string,
): void {
  const v = (msg: string, value?: number) =>
    out.push(violation({ id, severity: 'error', terms: ['BT-152', 'BT-119'] }, msg, { path, ...(value !== undefined ? { value } : {}) }));
  if (def.rate === 'positive') {
    if (present(rate) && (rate as number) <= 0) {
      v(`${where}: category S (${def.label}) requires a VAT rate above 0, got ${rate}%.`, rate);
    }
  } else if (def.rate === 'zero') {
    if (present(rate) && (rate as number) !== 0) {
      v(`${where}: category ${def.code} (${def.label}) requires a VAT rate of 0, got ${rate}%.`, rate);
    }
  } else {
    // 'absent' (O): a rate must not be stated at all.
    if (present(rate) && (rate as number) !== 0) {
      v(`${where}: category O (${def.label}) must not carry a VAT rate, got ${rate}%.`, rate);
    }
  }
}

function familyRule(def: FamilyDef): Rule {
  const { code } = def;
  return {
    id: `BR-${code}`,
    severity: 'error',
    profile: 'en16931',
    terms: ['BG-23', 'BT-118', 'BT-151'],
    description: `VAT category ${code} (${def.label}): breakdown presence, rate constraints, arithmetic, and exemption-reason requirements.`,
    check(inv) {
      const out: Violation[] = [];
      const usage = usageOf(inv, code);
      const used = usage.lines.length + usage.allowances.length + usage.charges.length > 0;
      if (!used && usage.breakdowns.length === 0) return null;

      // -01: presence / cardinality of the breakdown when the category is used.
      if (used && usage.breakdowns.length === 0) {
        out.push(violation({ id: `BR-${code}-01`, severity: 'error', terms: ['BG-23', 'BT-118'] },
          `The invoice uses VAT category ${code} (${def.label}) but has no VAT breakdown (BG-23) with category ${code}.`));
      }
      if (def.cardinality === 'exactlyOne' && usage.breakdowns.length > 1) {
        out.push(violation({ id: `BR-${code}-01`, severity: 'error', terms: ['BG-23', 'BT-118'] },
          `VAT category ${code} (${def.label}) must appear in exactly one VAT breakdown group; found ${usage.breakdowns.length}.`));
      }

      // -02: party identifier requirements, only when the category is used.
      if (used && inv.seller && code !== 'O') {
        if (!present(inv.seller.vatId) && !present(inv.seller.taxRegistrationId)) {
          out.push(violation({ id: `BR-${code}-02`, severity: 'error', terms: ['BT-31', 'BT-32'] },
            `VAT category ${code} (${def.label}) requires the seller VAT identifier (BT-31) or tax registration identifier (BT-32).`));
        }
        if (def.buyerVatRequired && inv.buyer && !present(inv.buyer.vatId)) {
          out.push(violation({ id: `BR-${code}-02`, severity: 'error', terms: ['BT-48'] },
            `VAT category ${code} (${def.label}) requires the buyer VAT identifier (BT-48) — ${def.label} shifts the VAT liability to the buyer.`));
        }
      }

      // -05 / -06 / -07: rate constraints on lines, allowances, charges.
      for (const { line, index } of usage.lines) {
        checkRate(out, `BR-${code}-05`, def, line.vat?.rate, `Line ${line.id ?? index + 1}`, `lines[${index}].vat.rate`);
      }
      for (const { ac, index } of usage.allowances) {
        checkRate(out, `BR-${code}-06`, def, ac.vatRate, 'Document allowance', `allowancesCharges[${index}].vatRate`);
      }
      for (const { ac, index } of usage.charges) {
        checkRate(out, `BR-${code}-07`, def, ac.vatRate, 'Document charge', `allowancesCharges[${index}].vatRate`);
      }

      // -08: per-group taxable amount = Σ lines − Σ allowances + Σ charges.
      // S groups per rate; the other categories form a single group.
      for (const { b, index } of usage.breakdowns) {
        const inGroup = (rate: number | undefined) =>
          code !== 'S' || (rate ?? 0) === (b.rate ?? 0);
        const sum = round2(
          usage.lines.filter(({ line }) => inGroup(line.vat?.rate)).reduce((s, { line }) => s + (line.netAmount ?? 0), 0) -
          usage.allowances.filter(({ ac }) => inGroup(ac.vatRate)).reduce((s, { ac }) => s + ac.amount, 0) +
          usage.charges.filter(({ ac }) => inGroup(ac.vatRate)).reduce((s, { ac }) => s + ac.amount, 0),
        );
        if (present(b.taxableAmount) && !amountsEqual(sum, b.taxableAmount)) {
          out.push(violation({ id: `BR-${code}-08`, severity: 'error', terms: ['BT-116'] },
            `VAT breakdown ${code}${code === 'S' && b.rate != null ? ` @ ${b.rate}%` : ''}: taxable amount (BT-116) should be ${sum.toFixed(2)} (sum of lines − allowances + charges in this category${code === 'S' ? '/rate' : ''}) but is ${b.taxableAmount.toFixed(2)}.`,
            { path: `vatBreakdown[${index}].taxableAmount`, value: b.taxableAmount, expected: sum.toFixed(2) }));
        }

        // -09: VAT amount per group.
        if (def.vatAmount === 'computed') {
          if (present(b.rate) && present(b.taxableAmount) && present(b.taxAmount)) {
            const expected = round2((b.taxableAmount * (b.rate as number)) / 100);
            if (!amountsEqual(expected, b.taxAmount, ROUNDING_TOLERANCE)) {
              out.push(violation({ id: `BR-${code}-09`, severity: 'error', terms: ['BT-117'] },
                `VAT breakdown ${code} @ ${b.rate}%: VAT amount (BT-117) should be ${expected.toFixed(2)} but is ${b.taxAmount.toFixed(2)}.`,
                { path: `vatBreakdown[${index}].taxAmount`, value: b.taxAmount, expected: expected.toFixed(2) }));
            }
          }
        } else if (present(b.taxAmount) && !amountsEqual(b.taxAmount, 0)) {
          out.push(violation({ id: `BR-${code}-09`, severity: 'error', terms: ['BT-117'] },
            `VAT breakdown ${code} (${def.label}): VAT amount (BT-117) must be 0, got ${b.taxAmount.toFixed(2)}.`,
            { path: `vatBreakdown[${index}].taxAmount`, value: b.taxAmount, expected: "0.00" }));
        }

        // -10: exemption reason presence/absence.
        const hasReason = present(b.exemptionReason) || present(b.exemptionReasonCode);
        if (def.exemption === 'required' && !hasReason) {
          out.push(violation({ id: `BR-${code}-10`, severity: 'error', terms: ['BT-120', 'BT-121'] },
            `VAT breakdown ${code} (${def.label}) requires an exemption reason (BT-120) or exemption reason code (BT-121).`,
            { path: `vatBreakdown[${index}].exemptionReason` }));
        }
        if (def.exemption === 'forbidden' && hasReason) {
          out.push(violation({ id: `BR-${code}-10`, severity: 'error', terms: ['BT-120', 'BT-121'] },
            `VAT breakdown ${code} (${def.label}) must not carry an exemption reason.`,
            { path: `vatBreakdown[${index}].exemptionReason` }));
        }
      }

      return out.length ? out : null;
    },
  };
}

/** BR-CO-04 — every invoice line must be categorised for VAT. */
const brCo04: Rule = {
  id: 'BR-CO-04',
  severity: 'error',
  profile: 'en16931',
  terms: ['BT-151'],
  description: 'Each invoice line must have a VAT category code.',
  check(inv) {
    const out: Violation[] = [];
    (inv.lines ?? []).forEach((line, index) => {
      if (!present(line.vat?.categoryCode)) {
        out.push(violation({ id: 'BR-CO-04', severity: 'error', terms: ['BT-151'] },
          `Line ${line.id ?? index + 1}: missing VAT category code (BT-151), e.g. S for standard rate.`,
          { path: `lines[${index}].vat.categoryCode` }));
      }
    });
    return out.length ? out : null;
  },
};

export const VAT_CATEGORY_RULES: Rule[] = [brCo04, ...FAMILIES.map(familyRule)];
