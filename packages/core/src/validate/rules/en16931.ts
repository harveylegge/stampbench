/**
 * EN 16931 core business rules — the integrity and arithmetic rules every
 * European e-invoice must satisfy regardless of national CIUS.
 *
 * Rule ids follow the official numbering (BR-*, BR-CO-*). Messages are our
 * own wording. Coverage is the documented subset in docs/rules-coverage —
 * structural "shall contain" rules and the totals/VAT arithmetic chain.
 */
import type { Invoice, VatBreakdown } from '../../model/invoice.js';
import {
  COMMON_CURRENCY_CODES,
  COMMON_UNIT_CODES,
  COUNTRY_CODE_RE,
  CURRENCY_CODE_RE,
  ISO_DATE_RE,
  VAT_CATEGORY_CODES,
} from '../../model/codes.js';
import { amountsEqual, present, round2, violation, type Rule, type Violation } from '../rule.js';

function req(
  id: string,
  terms: string[],
  description: string,
  get: (inv: Invoice) => unknown,
  message: string,
): Rule {
  return {
    id,
    severity: 'error',
    profile: 'en16931',
    description,
    terms,
    check(inv) {
      return present(get(inv)) ? null : [violation({ id, severity: 'error', terms }, message)];
    },
  };
}

const structuralRules: Rule[] = [
  req('BR-01', ['BT-24'], 'The invoice must state which specification it follows.',
    (i) => i.specificationIdentifier,
    'Missing specification identifier (BT-24). For XRechnung use the urn:…xrechnung_3.0 customization id.'),
  req('BR-02', ['BT-1'], 'The invoice must have an invoice number.',
    (i) => i.number, 'Missing invoice number (BT-1).'),
  req('BR-03', ['BT-2'], 'The invoice must have an issue date.',
    (i) => i.issueDate, 'Missing issue date (BT-2).'),
  req('BR-04', ['BT-3'], 'The invoice must have an invoice type code.',
    (i) => i.typeCode, 'Missing invoice type code (BT-3), e.g. 380 for a commercial invoice.'),
  req('BR-05', ['BT-5'], 'The invoice must state its currency.',
    (i) => i.currencyCode, 'Missing invoice currency code (BT-5), e.g. EUR.'),
  req('BR-06', ['BT-27'], 'The seller must have a name.',
    (i) => i.seller?.name, 'Missing seller name (BT-27).'),
  req('BR-07', ['BT-44'], 'The buyer must have a name.',
    (i) => i.buyer?.name, 'Missing buyer name (BT-44).'),
  req('BR-08', ['BG-5'], 'The seller must have a postal address.',
    (i) => i.seller?.address, 'Missing seller postal address (BG-5).'),
  req('BR-09', ['BT-40'], 'The seller address must have a country code.',
    (i) => i.seller?.address?.countryCode, 'Missing seller country code (BT-40).'),
  req('BR-10', ['BG-8'], 'The buyer must have a postal address.',
    (i) => i.buyer?.address, 'Missing buyer postal address (BG-8).'),
  req('BR-11', ['BT-55'], 'The buyer address must have a country code.',
    (i) => i.buyer?.address?.countryCode, 'Missing buyer country code (BT-55).'),
  req('BR-12', ['BT-106'], 'The invoice must state the sum of line net amounts.',
    (i) => i.totals?.sumOfLineNet, 'Missing sum of invoice line net amounts (BT-106).'),
  req('BR-13', ['BT-109'], 'The invoice must state the total amount without VAT.',
    (i) => i.totals?.taxExclusive, 'Missing invoice total without VAT (BT-109).'),
  req('BR-14', ['BT-112'], 'The invoice must state the total amount with VAT.',
    (i) => i.totals?.taxInclusive, 'Missing invoice total with VAT (BT-112).'),
  req('BR-15', ['BT-115'], 'The invoice must state the amount due for payment.',
    (i) => i.totals?.amountDue, 'Missing amount due for payment (BT-115).'),
  {
    id: 'BR-16', severity: 'error', profile: 'en16931', terms: ['BG-25'],
    description: 'The invoice must have at least one invoice line.',
    check(inv) {
      return (inv.lines?.length ?? 0) > 0
        ? null
        : [violation({ id: 'BR-16', severity: 'error', terms: ['BG-25'] }, 'The invoice has no invoice lines (BG-25) — at least one is required.')];
    },
  },
];

/** Per-line "shall contain" rules: BR-21..BR-26 + BR-27/28 price sign. */
const lineRules: Rule[] = [
  {
    id: 'BR-LINES', severity: 'error', profile: 'en16931', terms: ['BG-25'],
    description: 'Each invoice line must contain identifier, quantity, unit, net amount, item name and price.',
    check(inv) {
      const out: Violation[] = [];
      (inv.lines ?? []).forEach((line, idx) => {
        const p = `lines[${idx}]`;
        const mk = (id: string, terms: string[], msg: string, path: string) =>
          out.push(violation({ id, severity: 'error', terms }, `Line ${line.id ?? idx + 1}: ${msg}`, { path }));
        if (!present(line.id)) mk('BR-21', ['BT-126'], 'missing line identifier (BT-126).', `${p}.id`);
        if (!present(line.quantity)) mk('BR-22', ['BT-129'], 'missing invoiced quantity (BT-129).', `${p}.quantity`);
        if (!present(line.unitCode)) mk('BR-23', ['BT-130'], 'missing quantity unit code (BT-130), e.g. C62 or HUR.', `${p}.unitCode`);
        if (!present(line.netAmount)) mk('BR-24', ['BT-131'], 'missing line net amount (BT-131).', `${p}.netAmount`);
        if (!present(line.item?.name)) mk('BR-25', ['BT-153'], 'missing item name (BT-153).', `${p}.item.name`);
        if (!present(line.price?.netPrice)) mk('BR-26', ['BT-146'], 'missing item net price (BT-146).', `${p}.price.netPrice`);
        if (present(line.price?.netPrice) && (line.price!.netPrice as number) < 0)
          mk('BR-27', ['BT-146'], 'item net price (BT-146) must not be negative — use a credit note or line allowance instead.', `${p}.price.netPrice`);
      });
      return out.length ? out : null;
    },
  },
];

/** Totals arithmetic chain: BR-CO-10, 13, 14, 15, 16 + per-breakdown BR-CO-17 and BR-CO-18. */
const arithmeticRules: Rule[] = [
  {
    id: 'BR-CO-10', severity: 'error', profile: 'en16931', terms: ['BT-106', 'BT-131'],
    description: 'Sum of line net amounts must equal BT-106.',
    check(inv) {
      const stated = inv.totals?.sumOfLineNet;
      const lines = inv.lines ?? [];
      if (!present(stated) || lines.length === 0) return null; // presence handled by BR-12/BR-16
      const computed = round2(lines.reduce((s, l) => s + (l.netAmount ?? 0), 0));
      return amountsEqual(computed, stated as number)
        ? null
        : [violation({ id: 'BR-CO-10', severity: 'error', terms: ['BT-106', 'BT-131'] },
            `Sum of line net amounts is ${computed.toFixed(2)} but BT-106 states ${(stated as number).toFixed(2)}.`,
            { path: 'totals.sumOfLineNet', value: stated as number })];
    },
  },
  {
    id: 'BR-CO-13', severity: 'error', profile: 'en16931', terms: ['BT-109', 'BT-106', 'BT-107', 'BT-108'],
    description: 'Total without VAT must equal line sum minus allowances plus charges.',
    check(inv) {
      const t = inv.totals;
      if (!t || !present(t.taxExclusive) || !present(t.sumOfLineNet)) return null;
      const expected = round2((t.sumOfLineNet ?? 0) - (t.allowanceTotal ?? 0) + (t.chargeTotal ?? 0));
      return amountsEqual(expected, t.taxExclusive as number)
        ? null
        : [violation({ id: 'BR-CO-13', severity: 'error', terms: ['BT-109'] },
            `Total without VAT (BT-109) should be ${expected.toFixed(2)} (BT-106 − BT-107 + BT-108) but is ${(t.taxExclusive as number).toFixed(2)}.`,
            { path: 'totals.taxExclusive', value: t.taxExclusive as number })];
    },
  },
  {
    id: 'BR-CO-14', severity: 'error', profile: 'en16931', terms: ['BT-110', 'BT-117'],
    description: 'Total VAT must equal the sum of the VAT breakdown amounts.',
    check(inv) {
      const stated = inv.totals?.taxTotal;
      const breakdown = inv.vatBreakdown ?? [];
      if (!present(stated) || breakdown.length === 0) return null;
      const computed = round2(breakdown.reduce((s, b) => s + (b.taxAmount ?? 0), 0));
      return amountsEqual(computed, stated as number)
        ? null
        : [violation({ id: 'BR-CO-14', severity: 'error', terms: ['BT-110'] },
            `Sum of VAT breakdown amounts is ${computed.toFixed(2)} but total VAT (BT-110) states ${(stated as number).toFixed(2)}.`,
            { path: 'totals.taxTotal', value: stated as number })];
    },
  },
  {
    id: 'BR-CO-15', severity: 'error', profile: 'en16931', terms: ['BT-112', 'BT-109', 'BT-110'],
    description: 'Total with VAT must equal total without VAT plus total VAT.',
    check(inv) {
      const t = inv.totals;
      if (!t || !present(t.taxInclusive) || !present(t.taxExclusive)) return null;
      const expected = round2((t.taxExclusive ?? 0) + (t.taxTotal ?? 0));
      return amountsEqual(expected, t.taxInclusive as number)
        ? null
        : [violation({ id: 'BR-CO-15', severity: 'error', terms: ['BT-112'] },
            `Total with VAT (BT-112) should be ${expected.toFixed(2)} (BT-109 + BT-110) but is ${(t.taxInclusive as number).toFixed(2)}.`,
            { path: 'totals.taxInclusive', value: t.taxInclusive as number })];
    },
  },
  {
    id: 'BR-CO-16', severity: 'error', profile: 'en16931', terms: ['BT-115', 'BT-112', 'BT-113', 'BT-114'],
    description: 'Amount due must equal total with VAT minus paid amount plus rounding.',
    check(inv) {
      const t = inv.totals;
      if (!t || !present(t.amountDue) || !present(t.taxInclusive)) return null;
      const expected = round2((t.taxInclusive ?? 0) - (t.paidAmount ?? 0) + (t.roundingAmount ?? 0));
      return amountsEqual(expected, t.amountDue as number)
        ? null
        : [violation({ id: 'BR-CO-16', severity: 'error', terms: ['BT-115'] },
            `Amount due (BT-115) should be ${expected.toFixed(2)} (BT-112 − BT-113 + BT-114) but is ${(t.amountDue as number).toFixed(2)}.`,
            { path: 'totals.amountDue', value: t.amountDue as number })];
    },
  },
  {
    id: 'BR-CO-17', severity: 'error', profile: 'en16931', terms: ['BT-117', 'BT-116', 'BT-119'],
    description: 'Each VAT breakdown amount must equal taxable amount × rate.',
    check(inv) {
      const out: Violation[] = [];
      (inv.vatBreakdown ?? []).forEach((b: VatBreakdown, idx) => {
        if (!present(b.rate) || !present(b.taxableAmount) || !present(b.taxAmount)) return;
        const expected = round2((b.taxableAmount * (b.rate as number)) / 100);
        if (!amountsEqual(expected, b.taxAmount)) {
          out.push(violation({ id: 'BR-CO-17', severity: 'error', terms: ['BT-117'] },
            `VAT breakdown ${b.categoryCode}${b.rate != null ? ` @ ${b.rate}%` : ''}: tax amount should be ${expected.toFixed(2)} (${b.taxableAmount.toFixed(2)} × ${b.rate}%) but is ${b.taxAmount.toFixed(2)}.`,
            { path: `vatBreakdown[${idx}].taxAmount`, value: b.taxAmount }));
        }
      });
      return out.length ? out : null;
    },
  },
  {
    id: 'BR-CO-18', severity: 'error', profile: 'en16931', terms: ['BG-23'],
    description: 'The invoice must have at least one VAT breakdown.',
    check(inv) {
      return (inv.vatBreakdown?.length ?? 0) > 0
        ? null
        : [violation({ id: 'BR-CO-18', severity: 'error', terms: ['BG-23'] }, 'The invoice has no VAT breakdown (BG-23) — at least one category/rate group is required.')];
    },
  },
  {
    id: 'BR-CO-25', severity: 'error', profile: 'en16931', terms: ['BT-115', 'BT-9', 'BT-20'],
    description: 'A positive amount due requires a due date or payment terms.',
    check(inv) {
      const due = inv.totals?.amountDue;
      if (!present(due) || (due as number) <= 0) return null;
      return present(inv.dueDate) || present(inv.paymentTerms)
        ? null
        : [violation({ id: 'BR-CO-25', severity: 'error', terms: ['BT-9', 'BT-20'] },
            'Amount due is positive but neither a due date (BT-9) nor payment terms (BT-20) are given.')];
    },
  },
];

/** Format/code-list diagnostics. IG-* ids are InvoiceGate's own checks. */
const formatRules: Rule[] = [
  {
    id: 'IG-FMT-01', severity: 'error', profile: 'en16931', terms: ['BT-2', 'BT-9'],
    description: 'Dates must be ISO 8601 (YYYY-MM-DD).',
    check(inv) {
      const out: Violation[] = [];
      const checkDate = (v: string | undefined, term: string, path: string) => {
        if (present(v) && !ISO_DATE_RE.test(v as string)) {
          out.push(violation({ id: 'IG-FMT-01', severity: 'error', terms: [term] },
            `${term} must be formatted YYYY-MM-DD, got "${v}".`, { path, value: v }));
        }
      };
      checkDate(inv.issueDate, 'BT-2', 'issueDate');
      checkDate(inv.dueDate, 'BT-9', 'dueDate');
      checkDate(inv.taxPointDate, 'BT-7', 'taxPointDate');
      return out.length ? out : null;
    },
  },
  {
    id: 'IG-FMT-02', severity: 'error', profile: 'en16931', terms: ['BT-5'],
    description: 'Currency codes must be three uppercase letters.',
    check(inv) {
      if (!present(inv.currencyCode)) return null;
      return CURRENCY_CODE_RE.test(inv.currencyCode as string)
        ? null
        : [violation({ id: 'IG-FMT-02', severity: 'error', terms: ['BT-5'] },
            `Currency code (BT-5) must be an ISO 4217 code like EUR, got "${inv.currencyCode}".`,
            { path: 'currencyCode', value: inv.currencyCode })];
    },
  },
  {
    id: 'IG-FMT-03', severity: 'error', profile: 'en16931', terms: ['BT-40', 'BT-55'],
    description: 'Country codes must be two uppercase letters.',
    check(inv) {
      const out: Violation[] = [];
      const c = (v: string | undefined, term: string, path: string) => {
        if (present(v) && !COUNTRY_CODE_RE.test(v as string)) {
          out.push(violation({ id: 'IG-FMT-03', severity: 'error', terms: [term] },
            `${term} must be an ISO 3166-1 alpha-2 code like DE, got "${v}".`, { path, value: v }));
        }
      };
      c(inv.seller?.address?.countryCode, 'BT-40', 'seller.address.countryCode');
      c(inv.buyer?.address?.countryCode, 'BT-55', 'buyer.address.countryCode');
      return out.length ? out : null;
    },
  },
  {
    id: 'IG-VAT-01', severity: 'error', profile: 'en16931', terms: ['BT-118', 'BT-151'],
    description: 'VAT category codes must come from UNCL 5305.',
    check(inv) {
      const out: Violation[] = [];
      (inv.vatBreakdown ?? []).forEach((b, idx) => {
        if (present(b.categoryCode) && !VAT_CATEGORY_CODES.has(b.categoryCode)) {
          out.push(violation({ id: 'IG-VAT-01', severity: 'error', terms: ['BT-118'] },
            `Unknown VAT category code "${b.categoryCode}" — expected one of S, Z, E, AE, K, G, O, L, M.`,
            { path: `vatBreakdown[${idx}].categoryCode`, value: b.categoryCode }));
        }
      });
      (inv.lines ?? []).forEach((l, idx) => {
        const cc = l.vat?.categoryCode;
        if (present(cc) && !VAT_CATEGORY_CODES.has(cc as string)) {
          out.push(violation({ id: 'IG-VAT-01', severity: 'error', terms: ['BT-151'] },
            `Line ${l.id ?? idx + 1}: unknown VAT category code "${cc}".`,
            { path: `lines[${idx}].vat.categoryCode`, value: cc }));
        }
      });
      return out.length ? out : null;
    },
  },
  {
    id: 'IG-VAT-02', severity: 'error', profile: 'en16931', terms: ['BT-118', 'BT-119', 'BT-120'],
    description: 'VAT category semantics: S needs a rate > 0, Z/E/AE/K/G need rate 0, E/AE/K/G need an exemption reason.',
    check(inv) {
      const out: Violation[] = [];
      (inv.vatBreakdown ?? []).forEach((b, idx) => {
        const p = `vatBreakdown[${idx}]`;
        if (b.categoryCode === 'S' && present(b.rate) && (b.rate as number) <= 0) {
          out.push(violation({ id: 'IG-VAT-02', severity: 'error', terms: ['BT-119'] },
            `Standard-rate (S) VAT breakdown must have a rate above 0, got ${b.rate}%.`, { path: `${p}.rate`, value: b.rate }));
        }
        if (['Z', 'E', 'AE', 'K', 'G'].includes(b.categoryCode) && present(b.rate) && (b.rate as number) !== 0) {
          out.push(violation({ id: 'IG-VAT-02', severity: 'error', terms: ['BT-119'] },
            `VAT category ${b.categoryCode} must have a rate of 0, got ${b.rate}%.`, { path: `${p}.rate`, value: b.rate }));
        }
        if (['E', 'AE', 'K', 'G'].includes(b.categoryCode) && !present(b.exemptionReason) && !present(b.exemptionReasonCode)) {
          out.push(violation({ id: 'IG-VAT-02', severity: 'error', terms: ['BT-120', 'BT-121'] },
            `VAT category ${b.categoryCode} requires an exemption reason (BT-120) or reason code (BT-121).`, { path: `${p}.exemptionReason` }));
        }
      });
      return out.length ? out : null;
    },
  },
  {
    id: 'IG-W-01', severity: 'warning', profile: 'en16931', terms: ['BT-5', 'BT-130'],
    description: 'Unrecognised (but possibly valid) currency or unit codes.',
    check(inv) {
      const out: Violation[] = [];
      if (present(inv.currencyCode) && CURRENCY_CODE_RE.test(inv.currencyCode as string) && !COMMON_CURRENCY_CODES.has(inv.currencyCode as string)) {
        out.push(violation({ id: 'IG-W-01', severity: 'warning', terms: ['BT-5'] },
          `Currency code "${inv.currencyCode}" is not in our common-currency list — double-check it is a current ISO 4217 code.`,
          { path: 'currencyCode', value: inv.currencyCode }));
      }
      (inv.lines ?? []).forEach((l, idx) => {
        if (present(l.unitCode) && !COMMON_UNIT_CODES.has(l.unitCode as string)) {
          out.push(violation({ id: 'IG-W-01', severity: 'warning', terms: ['BT-130'] },
            `Line ${l.id ?? idx + 1}: unit code "${l.unitCode}" is not in our common UN/ECE Rec 20 subset — verify it is valid.`,
            { path: `lines[${idx}].unitCode`, value: l.unitCode }));
        }
      });
      return out.length ? out : null;
    },
  },
  {
    id: 'IG-W-02', severity: 'warning', profile: 'en16931', terms: ['BT-31', 'BT-32'],
    description: 'The seller should have a VAT identifier or tax registration identifier.',
    check(inv) {
      if (!inv.seller) return null;
      return present(inv.seller.vatId) || present(inv.seller.taxRegistrationId)
        ? null
        : [violation({ id: 'IG-W-02', severity: 'warning', terms: ['BT-31', 'BT-32'] },
            'Seller has neither a VAT identifier (BT-31) nor a tax registration identifier (BT-32) — most B2B invoices need one.')];
    },
  },
];

export const EN16931_RULES: Rule[] = [
  ...structuralRules,
  ...lineRules,
  ...arithmeticRules,
  ...formatRules,
];
