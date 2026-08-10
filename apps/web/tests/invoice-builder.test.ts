import { describe, expect, it } from 'vitest';
import { toDecimal, validateXml, validateInvoice } from '@stampbench/core';

import {
  computeDraftTotals,
  generateDocument,
  lineNetAmount,
  preflight,
  toInvoiceModel,
} from '../lib/invoice/build';
import { getCountry, isCrossBorder, tradeRelation } from '../lib/invoice/countries';
import { formatsForMarket, getFormat, isUsable } from '../lib/invoice/formats';
import { emptyDraft, newLine, suggestInvoiceNumber, type InvoiceDraft } from '../lib/invoice/draft';
import { applyTemplate, TEMPLATES } from '../lib/invoice/templates';
import { categoriesFor, getVatCategory, requirementsFor, VAT_CATEGORIES } from '../lib/invoice/tax';
import { MARKET_IDS } from '../lib/markets';

const NOW = new Date('2026-08-10T09:00:00Z');

/**
 * The promise the generator makes is "press Generate and Stampbench validates
 * it". If a shipped template does not survive its own ruleset, the product's
 * first impression is a wall of errors on data the product supplied — so the
 * templates are tested against the real engine, not eyeballed.
 */
describe('invoice templates produce documents that pass their own ruleset', () => {
  for (const template of TEMPLATES) {
    it(`${template.id} generates and validates`, () => {
      const draft = applyTemplate(template, NOW, 421);
      expect(preflight(draft)).toEqual([]);

      const generated = generateDocument(draft);
      const format = getFormat(draft.formatId);

      if (format.validationProfile) {
        expect(generated.xml, 'a format with a ruleset must emit XML').toBeTruthy();
        const result = validateXml(generated.xml!, { profile: format.validationProfile });
        expect(
          result.errorCount,
          `${template.id}: ${result.violations.map((v) => `${v.ruleId} ${v.message}`).join(' | ')}`,
        ).toBe(0);
      } else {
        // No ruleset for this format, so there is no XML and no verdict — but
        // the arithmetic rules still have to hold on the model.
        expect(generated.xml).toBeUndefined();
        const result = validateInvoice(generated.invoice, { profile: 'en16931' });
        const arithmetic = result.violations.filter((v) => v.ruleId.startsWith('BR-CO-'));
        expect(arithmetic, `${template.id}: ${JSON.stringify(arithmetic)}`).toEqual([]);
      }

      expect(JSON.parse(generated.json).invoice).toBeTruthy();
    });
  }
});

describe('draft totals', () => {
  function draftWith(lines: InvoiceDraft['lines']): InvoiceDraft {
    return { ...emptyDraft('uk', NOW), lines };
  }

  it('matches the engine’s totals exactly, to the cent', () => {
    // The number on screen and the number in the XML come from different code
    // paths; this is the test that they are the same number.
    const draft = draftWith([
      { ...newLine('S', '20'), description: 'Consulting', quantity: '7.5', unitPrice: '145.00' },
      { ...newLine('S', '20'), description: 'Workshop', quantity: '2', unitPrice: '950.00' },
      { ...newLine('S', '5'), description: 'Materials', quantity: '3', unitPrice: '19.99' },
    ]);
    const totals = computeDraftTotals(draft);
    const invoice = toInvoiceModel(draft);

    expect(toDecimal(totals.net)).toBe(invoice.totals?.sumOfLineNet);
    expect(toDecimal(totals.gross)).toBe(invoice.totals?.taxInclusive);
    const engineTax = (invoice.vatBreakdown ?? []).reduce((s, b) => s + b.taxAmount, 0);
    expect(toDecimal(totals.tax)).toBeCloseTo(engineTax, 10);
  });

  it('groups VAT by category and rate, not per line', () => {
    // Three lines of 0.05 at 19%: per-line rounding gives 3 × 0.01 = 0.03,
    // but the group is 0.15 × 19% = 0.0285 → 0.03. The rules check the group.
    const draft = draftWith([
      { ...newLine('S', '19'), description: 'a', quantity: '1', unitPrice: '0.05' },
      { ...newLine('S', '19'), description: 'b', quantity: '1', unitPrice: '0.05' },
      { ...newLine('S', '19'), description: 'c', quantity: '1', unitPrice: '0.05' },
    ]);
    const totals = computeDraftTotals(draft);
    expect(totals.categories).toHaveLength(1);
    expect(toDecimal(totals.categories[0]!.taxable)).toBe(0.15);
    expect(toDecimal(totals.categories[0]!.tax)).toBe(0.03);
  });

  it('separates categories and rates into their own groups', () => {
    const draft = draftWith([
      { ...newLine('S', '20'), description: 'a', quantity: '1', unitPrice: '100.00' },
      { ...newLine('S', '5'), description: 'b', quantity: '1', unitPrice: '100.00' },
      { ...newLine('Z', '0'), description: 'c', quantity: '1', unitPrice: '100.00' },
    ]);
    const totals = computeDraftTotals(draft);
    expect(totals.categories).toHaveLength(3);
    expect(toDecimal(totals.tax)).toBe(25);
  });

  it('computes line nets from quantity × price, rounded once', () => {
    expect(toDecimal(lineNetAmount({ ...newLine(), quantity: '3', unitPrice: '0.335' }))).toBe(1.01);
    expect(toDecimal(lineNetAmount({ ...newLine(), quantity: '7.5', unitPrice: '82.50' }))).toBe(618.75);
    // An empty price is zero, not NaN — a half-filled form must still render.
    expect(toDecimal(lineNetAmount({ ...newLine(), quantity: '2', unitPrice: '' }))).toBe(0);
  });

  it('accepts prices typed with either decimal convention', () => {
    expect(toDecimal(lineNetAmount({ ...newLine(), quantity: '1', unitPrice: '1.234,56' }))).toBe(1234.56);
    expect(toDecimal(lineNetAmount({ ...newLine(), quantity: '1', unitPrice: '1,234.56' }))).toBe(1234.56);
  });
});

describe('the builder never invents data', () => {
  it('leaves absent fields absent rather than filling them to pass validation', () => {
    const draft = emptyDraft('germany', NOW);
    draft.lines = [{ ...newLine('S', '19'), description: 'Work', quantity: '1', unitPrice: '100.00' }];
    const invoice = toInvoiceModel(draft);

    expect(invoice.seller?.name).toBeUndefined();
    expect(invoice.buyer?.vatId).toBeUndefined();
    expect(invoice.buyerReference).toBeUndefined();
    // And the document is therefore honestly invalid, with named rules.
    const result = validateInvoice(invoice, { profile: 'xrechnung' });
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.ruleId)).toContain('BR-DE-15');
  });

  it('omits an exemption reason the user did not supply', () => {
    const draft = emptyDraft('eu', NOW);
    draft.lines = [{ ...newLine('AE', '0'), description: 'Service', quantity: '1', unitPrice: '500.00' }];
    const invoice = toInvoiceModel(draft);
    expect(invoice.vatBreakdown?.[0]?.exemptionReason).toBeUndefined();
  });

  it('attaches an exemption reason to the right category group when given one', () => {
    const draft = emptyDraft('eu', NOW);
    draft.lines = [
      { ...newLine('AE', '0'), description: 'Service', quantity: '1', unitPrice: '500.00' },
      { ...newLine('S', '19'), description: 'Goods', quantity: '1', unitPrice: '100.00' },
    ];
    draft.exemptionReasons = { AE: 'Reverse charge' };
    const invoice = toInvoiceModel(draft);
    const ae = invoice.vatBreakdown?.find((b) => b.categoryCode === 'AE');
    const s = invoice.vatBreakdown?.find((b) => b.categoryCode === 'S');
    expect(ae?.exemptionReason).toBe('Reverse charge');
    expect(s?.exemptionReason).toBeUndefined();
  });
});

describe('markets, formats and countries', () => {
  it('offers every market a usable format and never a fake one', () => {
    for (const market of MARKET_IDS) {
      const formats = formatsForMarket(market);
      expect(formats.some(isUsable), market).toBe(true);
      for (const format of formats) {
        // Anything not fully supported must say why, on the page.
        if (format.support !== 'supported') expect(format.limitation, format.id).toBeTruthy();
        // A format that claims a ruleset must be able to produce XML for it.
        if (format.validationProfile) expect(format.outputs).toContain('xml');
      }
    }
  });

  it('does not claim a ruleset for the plain commercial invoice', () => {
    const commercial = getFormat('commercial');
    expect(commercial.validationProfile).toBeNull();
    expect(commercial.outputs).not.toContain('xml');
    expect(commercial.limitation).toBeTruthy();
  });

  it('does not offer to write ZUGFeRD, which the engine cannot do', () => {
    const zugferd = getFormat('zugferd-cii');
    expect(zugferd.support).toBe('not-implemented');
    expect(zugferd.outputs).toEqual([]);
  });

  it('adapts address and bank fields to the country', () => {
    expect(getCountry('US').address.subdivisionLabel).toBe('State');
    expect(getCountry('US').address.subdivisionRequired).toBe(true);
    expect(getCountry('DE').address.subdivisionLabel).toBeUndefined();
    expect(getCountry('GB').bank).toBe('uk');
    expect(getCountry('DE').bank).toBe('iban');
    expect(getCountry('US').bank).toBe('us');
    // Unknown countries still get a usable form instead of a crash.
    expect(getCountry('ZZ').address.cityLabel).toBeTruthy();
    expect(getCountry(undefined).code).toBe('');
  });

  it('classifies the trade relationship between the two parties', () => {
    expect(tradeRelation('GB', 'GB')).toBe('domestic');
    expect(tradeRelation('DE', 'FR')).toBe('intra-eu');
    expect(tradeRelation('DE', 'US')).toBe('eu-export');
    expect(tradeRelation('US', 'GB')).toBe('cross-border');
    expect(isCrossBorder('GB', 'DE')).toBe(true);
    expect(isCrossBorder('GB', 'GB')).toBe(false);
  });
});

describe('VAT categories mirror the rules the engine enforces', () => {
  it('states the constraints the engine will check', () => {
    expect(getVatCategory('S').rate).toBe('positive');
    expect(getVatCategory('AE').buyerVatRequired).toBe(true);
    expect(getVatCategory('K').buyerVatRequired).toBe(true);
    expect(getVatCategory('O').rate).toBe('absent');
    for (const category of VAT_CATEGORIES) {
      // Every category needing a reason must suggest a starting point, or the
      // user is left guessing at a field the validator will reject them for.
      if (category.exemptionReason === 'required') expect(category.reasonSuggestion, category.code).toBeTruthy();
    }
  });

  it('only offers categories that can apply to the trade relationship', () => {
    const domestic = categoriesFor('GB', 'GB').map((c) => c.code);
    expect(domestic).not.toContain('K'); // intra-community, between two UK parties
    expect(domestic).toContain('S');
    const intraEu = categoriesFor('DE', 'FR').map((c) => c.code);
    expect(intraEu).toContain('K');
    const euExport = categoriesFor('DE', 'US').map((c) => c.code);
    expect(euExport).toContain('G');
  });

  it('warns about what a category will require before validation does', () => {
    const requirements = requirementsFor(['AE']);
    expect(requirements.map((r) => r.message).join(' ')).toMatch(/VAT identifier/);
    expect(requirements.map((r) => r.message).join(' ')).toMatch(/exemption reason/);
    expect(requirementsFor(['S'])).toEqual([]);
    // Repeated categories are reported once, not once per line.
    expect(requirementsFor(['AE', 'AE', 'AE'])).toHaveLength(2);
  });
});

describe('drafts', () => {
  it('starts each market on a sensible country, currency and format', () => {
    expect(emptyDraft('uk', NOW).document.currency).toBe('GBP');
    expect(emptyDraft('us', NOW).document.currency).toBe('USD');
    expect(emptyDraft('germany', NOW).document.currency).toBe('EUR');
    expect(emptyDraft('germany', NOW).formatId).toBe('xrechnung-ubl');
    expect(emptyDraft('us', NOW).formatId).toBe('commercial');
    expect(emptyDraft('uk', NOW).seller.countryCode).toBe('GB');
  });

  it('suggests a sequential invoice number', () => {
    expect(suggestInvoiceNumber(NOW, 421)).toBe('INV-2026-000421');
    expect(suggestInvoiceNumber(NOW, 1)).toBe('INV-2026-000001');
  });

  it('defaults the due date 30 days after issue', () => {
    const draft = emptyDraft('uk', NOW);
    expect(draft.document.issueDate).toBe('2026-08-10');
    expect(draft.document.dueDate).toBe('2026-09-09');
  });

  it('flags an empty draft before the engine buries it in arithmetic errors', () => {
    const draft = emptyDraft('uk', NOW);
    expect(preflight(draft).join(' ')).toMatch(/line items are empty/);
    draft.lines = [];
    expect(preflight(draft).join(' ')).toMatch(/at least one line item/);
  });
});
