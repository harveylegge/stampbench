import { describe, expect, it } from 'vitest';
import {
  generateUblInvoice,
  parseUblInvoice,
  validateXml,
  withComputedTotals,
  withProfileDefaults,
  type Invoice,
} from '../src/index.js';

/**
 * BG-13 was missing from the model, which meant a "ship to" address on an
 * invoice had nowhere structured to live: it could be printed but not carried,
 * and a document that arrived with one lost it on parse. These tests pin both
 * directions down.
 */
const BASE: Invoice = {
  number: 'INV-2026-000501',
  issueDate: '2026-08-10',
  dueDate: '2026-09-09',
  currencyCode: 'EUR',
  seller: {
    name: 'Kade & Vermeer B.V.',
    vatId: 'NL861204488B01',
    address: { streetName: 'Prinsengracht 402', city: 'Amsterdam', postCode: '1016 JB', countryCode: 'NL' },
  },
  buyer: {
    name: 'Ateliers Rivière SAS',
    address: { streetName: '18 Rue Lafayette', city: 'Lyon', postCode: '69003', countryCode: 'FR' },
  },
  delivery: {
    name: 'Rivière Warehouse 4',
    actualDate: '2026-08-08',
    address: { streetName: '7 Quai Perrache', city: 'Lyon', postCode: '69002', countryCode: 'FR' },
  },
  lines: [
    { id: '1', quantity: 2, unitCode: 'C62', item: { name: 'Prototype tooling' }, price: { netPrice: 1875 }, vat: { categoryCode: 'S', rate: 20 } },
  ],
  payment: { meansTypeCode: '58', creditTransfers: [{ iban: 'NL91ABNA0417164300' }] },
};

function build(): string {
  return generateUblInvoice(withComputedTotals(withProfileDefaults(BASE, { profile: 'en16931' })), {
    profile: 'en16931',
  });
}

describe('delivery information (BG-13)', () => {
  it('writes the delivery date, address and party name', () => {
    const xml = build();
    expect(xml).toContain('<cac:Delivery>');
    expect(xml).toContain('<cbc:ActualDeliveryDate>2026-08-08</cbc:ActualDeliveryDate>');
    expect(xml).toContain('<cbc:StreetName>7 Quai Perrache</cbc:StreetName>');
    expect(xml).toContain('<cbc:Name>Rivière Warehouse 4</cbc:Name>');
  });

  it('places cac:Delivery in UBL sequence order', () => {
    // UBL sequences are ordered; out of position the document is schema-invalid
    // even though every element is present.
    const xml = build();
    expect(xml.indexOf('<cac:Delivery>')).toBeGreaterThan(xml.indexOf('<cac:AccountingCustomerParty>'));
    expect(xml.indexOf('<cac:Delivery>')).toBeLessThan(xml.indexOf('<cac:PaymentMeans>'));
  });

  it('survives the round trip instead of being dropped on parse', () => {
    const parsed = parseUblInvoice(build());
    expect(parsed.delivery?.actualDate).toBe('2026-08-08');
    expect(parsed.delivery?.name).toBe('Rivière Warehouse 4');
    expect(parsed.delivery?.address?.city).toBe('Lyon');
    expect(parsed.delivery?.address?.postCode).toBe('69002');
    expect(parsed.delivery?.address?.countryCode).toBe('FR');
  });

  it('still validates, and stays absent when not supplied', () => {
    expect(validateXml(build(), { profile: 'en16931' }).errorCount).toBe(0);
    const withoutDelivery = { ...BASE };
    delete withoutDelivery.delivery;
    const xml = generateUblInvoice(
      withComputedTotals(withProfileDefaults(withoutDelivery, { profile: 'en16931' })),
      { profile: 'en16931' },
    );
    expect(xml).not.toContain('<cac:Delivery>');
    expect(validateXml(xml, { profile: 'en16931' }).errorCount).toBe(0);
  });
});
