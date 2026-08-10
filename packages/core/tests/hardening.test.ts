import { describe, expect, it } from 'vitest';
import {
  generateXRechnungUbl,
  parseUblInvoice,
  validateXml,
  withComputedTotals,
  type Invoice,
} from '../src/index.js';

/**
 * Robustness against input the callers do not expect. The playground and the
 * hosted API feed arbitrary strings into this engine, so "throws on weird
 * input" is a real availability bug, not a theoretical one. Each test here
 * corresponds to a finding from the 2026-08 security audit.
 */
describe('validateXml never throws on bad input', () => {
  it('returns a SYNTAX failure for non-string arguments instead of throwing', () => {
    // The detection regex runs `xml.slice` before the try/catch, so these
    // used to throw an uncaught TypeError.
    for (const bad of [undefined, null, 42, {}, [], true]) {
      // @ts-expect-error — deliberately calling with the wrong type
      const result = validateXml(bad);
      expect(result.valid).toBe(false);
      expect(result.violations[0]?.ruleId).toBe('SYNTAX');
    }
  });

  it('still validates a real string document', () => {
    const result = validateXml('<nonsense/>');
    expect(result.valid).toBe(false); // unparseable, but no throw
  });
});

describe('the generator never emits a non-finite number', () => {
  it('drops NaN / Infinity numeric leaves rather than writing them literally', () => {
    // A quantity of Infinity and a NaN VAT rate must not reach the XML as the
    // strings "Infinity"/"NaN" — a receiver's parser would choke on them.
    const invoice: Invoice = {
      number: 'INV-1',
      issueDate: '2026-08-10',
      currencyCode: 'EUR',
      seller: { name: 'S', address: { countryCode: 'DE' } },
      buyer: { name: 'B', address: { countryCode: 'FR' } },
      lines: [
        {
          id: '1',
          quantity: Number.POSITIVE_INFINITY,
          item: { name: 'X' },
          price: { netPrice: 10 },
          vat: { categoryCode: 'S', rate: Number.NaN },
        },
      ],
    };
    const xml = generateXRechnungUbl(invoice);
    expect(xml).not.toContain('Infinity');
    expect(xml).not.toContain('NaN');
  });
});

describe('amount parsing rejects non-decimal forms', () => {
  const wrap = (qty: string) => `<?xml version="1.0"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>1</cbc:ID>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">${qty}</cbc:InvoicedQuantity>
    <cac:Item><cbc:Name>X</cbc:Name></cac:Item></cac:InvoiceLine>
</Invoice>`;

  it('does not read hex or exponent notation as a quantity', () => {
    // Number("0x10") === 16 and Number("1e3") === 1000 — both must be rejected
    // as "not a number", leaving the quantity absent.
    expect(parseUblInvoice(wrap('0x10')).lines?.[0]?.quantity).toBeUndefined();
    expect(parseUblInvoice(wrap('1e3')).lines?.[0]?.quantity).toBeUndefined();
    expect(parseUblInvoice(wrap('Infinity')).lines?.[0]?.quantity).toBeUndefined();
    // Plain decimals still parse.
    expect(parseUblInvoice(wrap('2.5')).lines?.[0]?.quantity).toBe(2.5);
    expect(parseUblInvoice(wrap('-3')).lines?.[0]?.quantity).toBe(-3);
  });
});
