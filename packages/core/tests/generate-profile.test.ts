import { describe, expect, it } from 'vitest';
import {
  EN16931_SPEC_ID,
  generateUblInvoice,
  generateXRechnungUbl,
  PROFILE_SPEC_IDS,
  validateXml,
  withComputedTotals,
  withProfileDefaults,
  withXRechnungDefaults,
  XRECHNUNG_30_SPEC_ID,
  type Invoice,
} from '../src/index.js';

/**
 * BT-24 is a compliance claim: it tells the receiver which ruleset the
 * document says it satisfies. Generating one profile's identifier on an
 * invoice validated against another is the exact kind of quiet overstatement
 * this product exists not to make, so it gets its own tests.
 */
const BASE: Invoice = {
  number: 'INV-2026-000421',
  issueDate: '2026-08-10',
  dueDate: '2026-09-09',
  currencyCode: 'EUR',
  buyerReference: '04011000-12345-34',
  seller: {
    name: 'Nordlicht Systeme GmbH',
    vatId: 'DE123456789',
    address: { streetName: 'Chausseestraße 12', city: 'Berlin', postCode: '10115', countryCode: 'DE' },
    contact: { name: 'Accounts', phone: '+49 30 1234567', email: 'billing@example.de' },
  },
  buyer: {
    name: 'Ateliers Rivière SAS',
    vatId: 'FR40303265045',
    address: { streetName: '18 Rue Lafayette', city: 'Lyon', postCode: '69003', countryCode: 'FR' },
  },
  lines: [
    {
      id: '1',
      quantity: 7.5,
      unitCode: 'HUR',
      item: { name: 'Integration consultancy' },
      price: { netPrice: 82.5 },
      vat: { categoryCode: 'S', rate: 20 },
    },
  ],
  payment: { meansTypeCode: '58', creditTransfers: [{ iban: 'DE02120300000000202051' }] },
};

function build(profile: 'en16931' | 'xrechnung'): string {
  return generateUblInvoice(withComputedTotals(withProfileDefaults(BASE, { profile })), { profile });
}

describe('profile-aware generation', () => {
  it('declares the specification identifier of the profile it was asked for', () => {
    expect(build('en16931')).toContain(`<cbc:CustomizationID>${EN16931_SPEC_ID}</cbc:CustomizationID>`);
    expect(build('xrechnung')).toContain(`<cbc:CustomizationID>${XRECHNUNG_30_SPEC_ID}</cbc:CustomizationID>`);
    expect(PROFILE_SPEC_IDS.en16931).toBe(EN16931_SPEC_ID);
    expect(PROFILE_SPEC_IDS.xrechnung).toBe(XRECHNUNG_30_SPEC_ID);
  });

  it('round-trips: what it generates, it validates', () => {
    for (const profile of ['en16931', 'xrechnung'] as const) {
      const result = validateXml(build(profile), { profile });
      expect(result.errorCount, `${profile}: ${JSON.stringify(result.violations)}`).toBe(0);
      expect(result.valid).toBe(true);
    }
  });

  it('does not let a European-core document claim the German CIUS', () => {
    // The failure mode worth a test: an invoice generated for a French buyer
    // must not tell the receiver it is an XRechnung.
    expect(build('en16931')).not.toContain('xrechnung');
  });

  it('leaves the existing XRechnung entry points behaving exactly as before', () => {
    const legacy = generateXRechnungUbl(withComputedTotals(withXRechnungDefaults(BASE)));
    const viaProfile = build('xrechnung');
    expect(legacy).toBe(viaProfile);
  });

  it('lets an explicit specification identifier win over the profile default', () => {
    const custom = 'urn:cen.eu:en16931:2017#compliant#urn:example:house-rules';
    const xml = generateUblInvoice(withComputedTotals(withProfileDefaults(BASE)), {
      profile: 'xrechnung',
      specificationIdentifier: custom,
    });
    expect(xml).toContain(`<cbc:CustomizationID>${custom}</cbc:CustomizationID>`);
  });

  it('computes totals that satisfy the arithmetic rules by construction', () => {
    const invoice = withComputedTotals(withProfileDefaults(BASE, { profile: 'en16931' }));
    // 7.5 × 82.50 = 618.75, VAT at 20% = 123.75.
    expect(invoice.totals?.sumOfLineNet).toBe(618.75);
    expect(invoice.vatBreakdown?.[0]?.taxAmount).toBe(123.75);
    expect(invoice.totals?.taxInclusive).toBe(742.5);
    expect(invoice.totals?.amountDue).toBe(742.5);
  });
});
