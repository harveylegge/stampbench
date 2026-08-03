import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  generateXRechnungUbl,
  parseUblInvoice,
  round2,
  validateInvoice,
  validateUblXml,
  withComputedTotals,
  withXRechnungDefaults,
} from '../src/index.js';
import { RAW_UBL_SAMPLE, validInvoice } from './fixtures.js';

describe('computeTotals', () => {
  it('produces the BR-CO arithmetic chain by construction', () => {
    const inv = validInvoice();
    const t = inv.totals!;
    // lines: 10×95 = 950 @19%, 3×39.90 = 119.70 @7%; allowance 50 @19%
    expect(t.sumOfLineNet).toBe(1069.7);
    expect(t.allowanceTotal).toBe(50);
    expect(t.taxExclusive).toBe(1019.7);
    // VAT: (950−50)×19% = 171.00; 119.70×7% = 8.38 (rounded)
    expect(t.taxTotal).toBe(179.38);
    expect(t.taxInclusive).toBe(1199.08);
    expect(t.amountDue).toBe(1199.08);
    const s19 = inv.vatBreakdown!.find((b) => b.rate === 19)!;
    expect(s19.taxableAmount).toBe(900);
    expect(s19.taxAmount).toBe(171);
  });

  it('derives line net from quantity × price when netAmount is omitted', () => {
    const { totals } = computeTotals([
      { quantity: 2.5, price: { netPrice: 8 }, vat: { categoryCode: 'S', rate: 19 } },
    ]);
    expect(totals.sumOfLineNet).toBe(20);
    expect(totals.taxTotal).toBe(3.8);
  });

  it('respects price base quantity', () => {
    const { totals } = computeTotals([
      { quantity: 1000, price: { netPrice: 12, baseQuantity: 100 }, vat: { categoryCode: 'S', rate: 19 } },
    ]);
    expect(totals.sumOfLineNet).toBe(120);
  });
});

describe('validateInvoice', () => {
  it('accepts a fully compliant XRechnung invoice', () => {
    const result = validateInvoice(validInvoice());
    expect(result.violations.filter((v) => v.severity === 'error')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('flags a missing buyer reference as BR-DE-15 (xrechnung only)', () => {
    const inv = validInvoice();
    delete inv.buyerReference;
    const xr = validateInvoice(inv, { profile: 'xrechnung' });
    expect(xr.valid).toBe(false);
    expect(xr.violations.map((v) => v.ruleId)).toContain('BR-DE-15');
    const en = validateInvoice(inv, { profile: 'en16931' });
    expect(en.violations.map((v) => v.ruleId)).not.toContain('BR-DE-15');
  });

  it('flags missing seller contact details (BR-DE-2/5/6/7)', () => {
    const inv = validInvoice();
    delete inv.seller!.contact;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-DE-2');
  });

  it('flags broken totals arithmetic (BR-CO-10, BR-CO-15)', () => {
    const inv = validInvoice();
    inv.totals!.sumOfLineNet = 999;
    inv.totals!.taxInclusive = 5000;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-CO-10');
    expect(ids).toContain('BR-CO-15');
  });

  it('flags a wrong per-category VAT amount (BR-CO-17)', () => {
    const inv = validInvoice();
    inv.vatBreakdown![0]!.taxAmount += 1;
    inv.totals!.taxTotal! += 1;
    inv.totals!.taxInclusive! += 1;
    inv.totals!.amountDue! += 1;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-CO-17');
  });

  it('rejects a one-cent-wrong line sum (BR-CO-10 is exact, not ±0.01)', () => {
    const inv = validInvoice();
    // A classic off-by-one-cent aggregation: stated line sum 0.01 too high.
    inv.totals!.sumOfLineNet = (inv.totals!.sumOfLineNet ?? 0) + 0.01;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-CO-10');
  });

  it('still tolerates a one-cent rounding difference on BR-CO-17 (multiplication)', () => {
    const inv = validInvoice();
    // Nudge a VAT amount by exactly one cent — allowed rounding slack.
    inv.vatBreakdown![0]!.taxAmount = round2(inv.vatBreakdown![0]!.taxAmount + 0.01);
    const co17 = validateInvoice(inv).violations.filter((v) => v.ruleId === 'BR-CO-17');
    expect(co17).toEqual([]);
  });

  it('flags an invoice without lines (BR-16) and without VAT breakdown (BR-CO-18)', () => {
    const ids = validateInvoice({}).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-16');
    expect(ids).toContain('BR-CO-18');
    expect(ids).toContain('BR-02');
  });

  it('flags VAT category semantics: standard rate must be > 0, exempt needs a reason', () => {
    const inv = validInvoice();
    inv.vatBreakdown = [
      { categoryCode: 'S', rate: 0, taxableAmount: 100, taxAmount: 0 },
      { categoryCode: 'E', rate: 0, taxableAmount: 50, taxAmount: 0 },
    ];
    const ids = validateInvoice(inv).violations.filter((v) => v.ruleId === 'IG-VAT-02');
    expect(ids.length).toBe(2);
  });

  it('flags malformed dates and codes', () => {
    const inv = validInvoice();
    inv.issueDate = '01.08.2026';
    inv.currencyCode = 'Euro';
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('IG-FMT-01');
    expect(ids).toContain('IG-FMT-02');
  });

  it('requires an IBAN for SEPA credit transfers (IG-DE-23)', () => {
    const inv = validInvoice();
    inv.payment = { meansTypeCode: '58' };
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('IG-DE-23');
  });
});

describe('generator correctness (review fixes)', () => {
  it('preserves fractional unit prices instead of forcing 2 decimals', () => {
    const inv = withComputedTotals({
      currencyCode: 'EUR',
      lines: [
        { id: '1', quantity: 1000, unitCode: 'C62', item: { name: 'Widget' }, price: { netPrice: 0.125 }, vat: { categoryCode: 'S', rate: 19 } },
      ],
    });
    const xml = generateXRechnungUbl(inv);
    expect(xml).toContain('<cbc:PriceAmount currencyID="EUR">0.125</cbc:PriceAmount>');
  });

  it('emits SEPA direct-debit mandate (BT-89) and debited account (BT-91)', () => {
    const inv = withComputedTotals({
      currencyCode: 'EUR',
      payment: {
        meansTypeCode: '59',
        mandateReference: 'MANDATE-001',
        debitedAccountIban: 'DE89370400440532013000',
      },
      lines: [
        { id: '1', quantity: 1, unitCode: 'C62', item: { name: 'X' }, price: { netPrice: 100 }, vat: { categoryCode: 'S', rate: 19 } },
      ],
    });
    const parsed = parseUblInvoice(generateXRechnungUbl(inv));
    expect(parsed.payment?.mandateReference).toBe('MANDATE-001');
    expect(parsed.payment?.debitedAccountIban).toBe('DE89370400440532013000');
  });

  it('never emits a non-finite amount into the XML', () => {
    const inv = {
      currencyCode: 'EUR',
      totals: { taxInclusive: Infinity, amountDue: Infinity },
      vatBreakdown: [{ categoryCode: 'S', rate: 19, taxableAmount: Infinity, taxAmount: Infinity }],
      lines: [{ id: '1', netAmount: Infinity, item: { name: 'X' }, price: { netPrice: Infinity } }],
    };
    const xml = generateXRechnungUbl(inv);
    expect(xml).not.toContain('Infinity');
    expect(xml).not.toContain('NaN');
  });
});

describe('computeTotals allowance without VAT category', () => {
  it('inherits the sole line VAT category instead of an empty-code group', () => {
    const { vatBreakdown } = computeTotals(
      [{ quantity: 1, price: { netPrice: 100 }, vat: { categoryCode: 'S', rate: 19 } }],
      [{ isCharge: false, amount: 10, reason: 'Rabatt' }], // no vatCategoryCode
    );
    expect(vatBreakdown).toHaveLength(1);
    expect(vatBreakdown[0]!.categoryCode).toBe('S');
    expect(vatBreakdown[0]!.taxableAmount).toBe(90);
  });
});

describe('withXRechnungDefaults', () => {
  it('model validation matches generated-XML validation once defaults are applied', () => {
    const inv = validInvoice();
    // Strip the fields the generator defaults — a typical API caller's payload.
    delete inv.specificationIdentifier;
    delete inv.typeCode;
    const defaulted = withComputedTotals(withXRechnungDefaults(inv));
    const modelResult = validateInvoice(defaulted);
    const xmlResult = validateUblXml(generateXRechnungUbl(defaulted));
    expect(modelResult.valid).toBe(true);
    expect(xmlResult.valid).toBe(true);
    expect(defaulted.typeCode).toBe('380');
  });
});

describe('generate → parse round-trip', () => {
  it('preserves the semantic model through XML and back', () => {
    const original = validInvoice();
    const xml = generateXRechnungUbl(original);
    const parsed = parseUblInvoice(xml);

    expect(parsed.number).toBe(original.number);
    expect(parsed.issueDate).toBe(original.issueDate);
    expect(parsed.buyerReference).toBe(original.buyerReference);
    expect(parsed.seller?.name).toBe(original.seller?.name);
    expect(parsed.seller?.vatId).toBe(original.seller?.vatId);
    expect(parsed.seller?.contact?.email).toBe(original.seller?.contact?.email);
    expect(parsed.buyer?.address?.postCode).toBe(original.buyer?.address?.postCode);
    expect(parsed.payment?.creditTransfers?.[0]?.iban).toBe('DE89370400440532013000');
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines?.[1]?.item?.name).toBe(original.lines?.[1]?.item?.name);
    expect(parsed.totals?.taxInclusive).toBe(original.totals?.taxInclusive);
    expect(parsed.vatBreakdown).toHaveLength(2);
  });

  it('a generated invoice validates clean', () => {
    const xml = generateXRechnungUbl(validInvoice());
    const result = validateUblXml(xml);
    expect(result.violations.filter((v) => v.severity === 'error')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('escapes XML special characters safely', () => {
    const inv = validInvoice();
    inv.seller!.name = 'Müller & Söhne <GmbH> "Berlin"';
    inv.notes = ['5 < 7 && 7 > 5'];
    const xml = generateXRechnungUbl(inv);
    const parsed = parseUblInvoice(xml);
    expect(parsed.seller?.name).toBe('Müller & Söhne <GmbH> "Berlin"');
    expect(parsed.notes?.[0]).toBe('5 < 7 && 7 > 5');
  });
});

describe('parseUblInvoice', () => {
  it('parses hand-written UBL with namespace prefixes', () => {
    const inv = parseUblInvoice(RAW_UBL_SAMPLE);
    expect(inv.number).toBe('INV-77');
    expect(inv.seller?.name).toBe('ACME Handels GmbH');
    expect(inv.seller?.vatId).toBe('DE811111111');
    expect(inv.buyer?.name).toBe('Kunde AG');
    expect(inv.lines?.[0]?.item?.name).toBe('Widget <Premium>');
    expect(inv.totals?.taxInclusive).toBe(1190);
    expect(inv.vatBreakdown?.[0]?.rate).toBe(19);
  });

  it('the raw sample validates clean against xrechnung', () => {
    const result = validateUblXml(RAW_UBL_SAMPLE);
    expect(result.violations.filter((v) => v.severity === 'error')).toEqual([]);
  });

  it('reports malformed XML as a SYNTAX violation with a line number', () => {
    const result = validateUblXml('<Invoice><cbc:ID>x</Invoice>');
    expect(result.valid).toBe(false);
    expect(result.violations[0]?.ruleId).toBe('SYNTAX');
  });

  it('recognises CII documents and says so', () => {
    const result = validateUblXml('<?xml version="1.0"?><rsm:CrossIndustryInvoice xmlns:rsm="urn:x"/>' );
    expect(result.violations[0]?.message).toMatch(/CII|ZUGFeRD|Factur-X/);
  });

  it('rejects empty input', () => {
    const result = validateUblXml('');
    expect(result.valid).toBe(false);
  });
});
