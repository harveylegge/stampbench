import { describe, expect, it } from 'vitest';
import {
  compareRulesets,
  computeTotals,
  fixXml,
  generateXRechnungUbl,
  getRuleset,
  listRulesets,
  parseCiiInvoice,
  parseUblInvoice,
  registerRuleset,
  round2,
  validateInvoice,
  validateUblXml,
  validateXml,
  withComputedTotals,
  withXRechnungDefaults,
  type Rule,
} from '../src/index.js';
import { RAW_CII_SAMPLE, RAW_UBL_SAMPLE, validInvoice } from './fixtures.js';

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
    const violations = validateInvoice(inv).violations;
    expect(violations.filter((v) => v.ruleId === 'IG-VAT-02')).toHaveLength(1); // S @ 0%
    expect(violations.map((v) => v.ruleId)).toContain('BR-E-10'); // exempt without reason
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

describe('VAT category families (BR-S/Z/E/AE/K/G/O)', () => {
  /** Reverse-charge invoice base: one AE line, correct breakdown + buyer VAT. */
  function reverseChargeInvoice() {
    const inv = validInvoice();
    inv.lines = [
      { id: '1', quantity: 1, unitCode: 'C62', netAmount: 1000,
        item: { name: 'Beratung' }, price: { netPrice: 1000 },
        vat: { categoryCode: 'AE', rate: 0 } },
    ];
    inv.allowancesCharges = [];
    inv.buyer!.vatId = 'FRAB123456789';
    inv.vatBreakdown = [
      { categoryCode: 'AE', rate: 0, taxableAmount: 1000, taxAmount: 0,
        exemptionReason: 'Reverse charge — VAT liability shifts to the buyer.' },
    ];
    inv.totals = { sumOfLineNet: 1000, taxExclusive: 1000, taxTotal: 0, taxInclusive: 1000, amountDue: 1000 };
    return inv;
  }

  it('accepts a correct reverse-charge (AE) invoice', () => {
    const result = validateInvoice(reverseChargeInvoice());
    expect(result.violations.filter((v) => v.severity === 'error')).toEqual([]);
  });

  it('AE without the buyer VAT id fails BR-AE-02', () => {
    const inv = reverseChargeInvoice();
    delete inv.buyer!.vatId;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-AE-02');
  });

  it('AE without an exemption reason fails BR-AE-10', () => {
    const inv = reverseChargeInvoice();
    delete inv.vatBreakdown![0]!.exemptionReason;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-AE-10');
  });

  it('a line category with no matching breakdown fails BR-x-01', () => {
    const inv = reverseChargeInvoice();
    inv.vatBreakdown = [{ categoryCode: 'S', rate: 19, taxableAmount: 1000, taxAmount: 190 }];
    inv.totals!.taxTotal = 190; inv.totals!.taxInclusive = 1190; inv.totals!.amountDue = 1190;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-AE-01');
  });

  it('an S line with rate 0 fails BR-S-05', () => {
    const inv = validInvoice();
    inv.lines![0]!.vat!.rate = 0;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-S-05');
  });

  it('a per-rate taxable mismatch fails BR-S-08', () => {
    const inv = validInvoice();
    inv.vatBreakdown!.find((b) => b.rate === 19)!.taxableAmount = 950; // ignores the 50 allowance
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-S-08');
  });

  it('a line without any VAT category fails BR-CO-04', () => {
    const inv = validInvoice();
    delete inv.lines![0]!.vat;
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-CO-04');
  });

  it('a nonzero VAT amount on an exempt breakdown fails BR-E-09', () => {
    const inv = reverseChargeInvoice();
    inv.lines![0]!.vat = { categoryCode: 'E', rate: 0 };
    inv.vatBreakdown = [
      { categoryCode: 'E', rate: 0, taxableAmount: 1000, taxAmount: 19, exemptionReason: 'Steuerbefreit.' },
    ];
    const ids = validateInvoice(inv).violations.map((v) => v.ruleId);
    expect(ids).toContain('BR-E-09');
  });
});

describe('ruleset regression comparison', () => {
  /** An EU-core-valid invoice that has never needed German CIUS fields. */
  function euOnlyInvoice() {
    const inv = validInvoice();
    delete inv.buyerReference; // BT-10 — required by XRechnung, not by EN 16931 core
    delete inv.seller!.contact; // BG-6 — likewise
    return inv;
  }

  it('flags documents that pass today but would fail under the target ruleset', () => {
    const report = compareRulesets(
      [
        { id: 'eu-only.xml', invoice: euOnlyInvoice() },
        { id: 'already-german.xml', invoice: validInvoice() },
      ],
      'en16931@2017',
      'xrechnung@3.0',
    );

    expect(report.summary.total).toBe(2);
    expect(report.summary.regressions).toBe(1);
    expect(report.summary.unchangedPass).toBe(1);

    const regressed = report.entries.find((e) => e.id === 'eu-only.xml')!;
    expect(regressed.transition).toBe('regression');
    expect(regressed.from.valid).toBe(true);
    expect(regressed.to.valid).toBe(false);
    expect(regressed.newRuleIds).toContain('BR-DE-15'); // missing buyer reference
    expect(regressed.newMessages.join(' ')).toMatch(/buyer reference/i);

    const unchanged = report.entries.find((e) => e.id === 'already-german.xml')!;
    expect(unchanged.transition).toBe('unchanged-pass');
    expect(unchanged.newRuleIds).toEqual([]);
  });

  it('ranks the newly failing rules by how many documents they break', () => {
    const docs = [
      { id: 'a.xml', invoice: euOnlyInvoice() },
      { id: 'b.xml', invoice: euOnlyInvoice() },
      { id: 'c.xml', invoice: validInvoice() },
    ];
    const report = compareRulesets(docs, 'en16931@2017', 'xrechnung@3.0');
    expect(report.byNewRule.length).toBeGreaterThan(0);
    // Sorted most-breaking first, and every count is bounded by the corpus size.
    expect(report.byNewRule[0]!.documents).toBe(2);
    for (const r of report.byNewRule) expect(r.documents).toBeLessThanOrEqual(docs.length);
    expect(report.byNewRule.map((r) => r.ruleId)).toContain('BR-DE-15');
  });

  it('reports improvements when the target ruleset is less strict', () => {
    const report = compareRulesets(
      [{ id: 'eu-only.xml', invoice: euOnlyInvoice() }],
      'xrechnung@3.0',
      'en16931@2017',
    );
    expect(report.summary.improvements).toBe(1);
    expect(report.entries[0]!.transition).toBe('improvement');
    expect(report.entries[0]!.resolvedRuleIds).toContain('BR-DE-15');
  });

  it('exposes rulesets with pinned spec versions, and rejects unknown ids', () => {
    const ids = listRulesets().map((r) => r.id);
    expect(ids).toContain('en16931@2017');
    expect(ids).toContain('xrechnung@3.0');
    expect(getRuleset('xrechnung@3.0').specVersion).toBe('XRechnung 3.0');
    expect(() => getRuleset('xrechnung@9.9')).toThrow(/Unknown ruleset/);
  });

  it('supports registering a candidate ruleset and diffing against it', () => {
    // Stand-in for a future published release: the current German set plus one
    // additional house rule. This is the mechanism customers use the day a real
    // new specification is published, ahead of its effective date.
    const strictBuyerEmail: Rule = {
      id: 'X-BUYER-EMAIL',
      severity: 'error',
      profile: 'xrechnung',
      description: 'Buyer must have an electronic address.',
      check: (inv) =>
        inv.buyer?.electronicAddress
          ? null
          : [{ ruleId: 'X-BUYER-EMAIL', severity: 'error', message: 'Buyer electronic address is required.' }],
    };
    registerRuleset({
      id: 'xrechnung@candidate-test',
      label: 'Candidate release (test)',
      profile: 'xrechnung',
      specVersion: 'XRechnung candidate',
      status: 'candidate',
      rules: [...getRuleset('xrechnung@3.0').rules, strictBuyerEmail],
    });

    const inv = validInvoice();
    delete inv.buyer!.electronicAddress;
    const report = compareRulesets(
      [{ id: 'invoice.xml', invoice: inv }],
      'xrechnung@3.0',
      'xrechnung@candidate-test',
    );
    expect(report.summary.regressions).toBe(1);
    expect(report.entries[0]!.newRuleIds).toEqual(['X-BUYER-EMAIL']);
    expect(report.to.specVersion).toBe('XRechnung candidate');
  });
});

describe('parseCiiInvoice (ZUGFeRD / Factur-X / XRechnung-CII)', () => {
  it('maps a CII document to the same semantic model as UBL', () => {
    const cii = parseCiiInvoice(RAW_CII_SAMPLE);
    expect(cii.number).toBe('RE-2026-0042');
    expect(cii.issueDate).toBe('2026-08-01'); // converted from format-102 20260801
    expect(cii.dueDate).toBe('2026-08-31');
    expect(cii.buyerReference).toBe('04011000-12345-67');
    expect(cii.seller?.name).toBe('Beispiel Software GmbH');
    expect(cii.seller?.vatId).toBe('DE123456789');
    expect(cii.seller?.contact?.email).toBe('buchhaltung@beispiel-software.de');
    expect(cii.seller?.electronicAddress).toBe('rechnung@beispiel-software.de');
    expect(cii.buyer?.address?.postCode).toBe('53113');
    expect(cii.payment?.meansTypeCode).toBe('58');
    expect(cii.payment?.creditTransfers?.[0]?.iban).toBe('DE89370400440532013000');
    expect(cii.payment?.creditTransfers?.[0]?.bic).toBe('COBADEFFXXX');
    expect(cii.lines).toHaveLength(2);
    expect(cii.lines?.[0]?.quantity).toBe(10);
    expect(cii.lines?.[0]?.unitCode).toBe('HUR');
    expect(cii.lines?.[1]?.item?.name).toBe('Fachbuch "EN 16931 & XRechnung"');
    expect(cii.vatBreakdown).toHaveLength(2);
    expect(cii.allowancesCharges?.[0]?.amount).toBe(50);
    expect(cii.totals?.taxInclusive).toBe(1199.08);
    expect(cii.totals?.taxTotal).toBe(179.38);
  });

  it('a compliant CII invoice validates clean against the XRechnung profile', () => {
    const result = validateXml(RAW_CII_SAMPLE);
    expect(result.syntax).toBe('cii');
    expect(result.violations.filter((v) => v.severity === 'error')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('validateXml auto-detects UBL too', () => {
    const result = validateXml(RAW_UBL_SAMPLE);
    expect(result.syntax).toBe('ubl');
    expect(result.valid).toBe(true);
  });

  it('CII and UBL parses of the same invoice agree on the money', () => {
    const cii = parseCiiInvoice(RAW_CII_SAMPLE);
    const ubl = parseUblInvoice(generateXRechnungUbl(validInvoice()));
    expect(cii.totals?.taxInclusive).toBe(ubl.totals?.taxInclusive);
    expect(cii.totals?.sumOfLineNet).toBe(ubl.totals?.sumOfLineNet);
    expect(cii.vatBreakdown?.length).toBe(ubl.vatBreakdown?.length);
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

describe('fixXml structural repair', () => {
  it('repairs a mismatched closing tag the parser names exactly', () => {
    const broken = RAW_UBL_SAMPLE.replace('</ubl:Invoice>', '</ubl:InvalidClosingTag>');
    expect(broken).not.toBe(RAW_UBL_SAMPLE);
    expect(validateXml(broken).invoice).toBeUndefined();

    const result = fixXml(broken, { profile: 'xrechnung' });
    const syntaxEdits = result.applied.filter((e) => e.ruleId === 'SYNTAX');
    expect(syntaxEdits).toHaveLength(1);
    expect(syntaxEdits[0]?.previous).toBe('</ubl:InvalidClosingTag>');
    expect(syntaxEdits[0]?.replacement).toBe('</ubl:Invoice>');
    // The repaired document parses again and, since the sample was clean,
    // validates clean — and the rest of the bytes are untouched.
    expect(result.xml).toBe(RAW_UBL_SAMPLE);
    expect(result.valid).toBe(true);
  });

  it('repairs several mismatched tags across rounds', () => {
    const broken = RAW_UBL_SAMPLE.replace('</cbc:ID>', '</cbc:Wrong>').replace(
      '</ubl:Invoice>',
      '</ubl:AlsoWrong>',
    );
    const result = fixXml(broken, { profile: 'xrechnung' });
    expect(result.applied.filter((e) => e.ruleId === 'SYNTAX')).toHaveLength(2);
    expect(result.xml).toBe(RAW_UBL_SAMPLE);
    expect(result.valid).toBe(true);
  });

  it('still refuses malformed XML it cannot derive a repair for', () => {
    // An unclosed tag: the parser cannot state a single mechanical correction.
    const result = fixXml('<ubl:Invoice><cbc:ID>x</cbc:ID>', { profile: 'xrechnung' });
    expect(result.applied).toEqual([]);
    expect(result.unfixable[0]?.reason).toMatch(/structural|parsed/i);
  });
});
