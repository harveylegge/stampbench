import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { XRECHNUNG_30_SPEC_ID } from '@invoicegate/core';
import { run } from '../src/run.js';

const tmp = mkdtempSync(join(tmpdir(), 'invoicegate-cli-'));

function captured() {
  const outLines: string[] = [];
  const errLines: string[] = [];
  return {
    io: {
      out: (line: string) => outLines.push(line),
      err: (line: string) => errLines.push(line),
    },
    stdout: () => outLines.join('\n'),
    stderr: () => errLines.join('\n'),
  };
}

/**
 * A small XRechnung UBL invoice, structurally copied from the core package's
 * RAW_UBL_SAMPLE fixture (packages/core/tests/fixtures.ts), which validates
 * clean against the xrechnung profile.
 */
function ublSample(opts: { buyerReference?: boolean } = {}): string {
  const { buyerReference = true } = opts;
  const buyerRefLine = buyerReference ? '  <cbc:BuyerReference>991-01234-56</cbc:BuyerReference>\n' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${XRECHNUNG_30_SPEC_ID}</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>INV-77</cbc:ID>
  <cbc:IssueDate>2026-07-15</cbc:IssueDate>
  <cbc:DueDate>2026-08-14</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
${buyerRefLine}  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">billing@acme.example</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Hauptstr. 5</cbc:StreetName>
        <cbc:CityName>Hamburg</cbc:CityName>
        <cbc:PostalZone>20095</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE811111111</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>ACME Handels GmbH</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>Erik Muster</cbc:Name>
        <cbc:Telephone>+49 40 555 0100</cbc:Telephone>
        <cbc:ElectronicMail>erik@acme.example</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>Kundenallee 9</cbc:StreetName>
        <cbc:CityName>München</cbc:CityName>
        <cbc:PostalZone>80331</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Kunde AG</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>DE02120300000000202051</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">190.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">1000.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">190.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">1000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">1190.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">100</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Widget</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">10.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</ubl:Invoice>
`;
}

/** A JSON semantic model that validates clean once defaults + totals are applied. */
function validInvoiceJson(): Record<string, unknown> {
  return {
    number: 'RE-2026-0100',
    issueDate: '2026-08-01',
    dueDate: '2026-08-31',
    buyerReference: '04011000-12345-67',
    paymentTerms: 'Zahlbar innerhalb von 30 Tagen ohne Abzug.',
    seller: {
      name: 'Beispiel Software GmbH',
      vatId: 'DE123456789',
      electronicAddress: 'rechnung@beispiel-software.de',
      electronicAddressScheme: 'EM',
      address: { streetName: 'Musterstraße 12', city: 'Berlin', postCode: '10115', countryCode: 'DE' },
      contact: { name: 'Anna Beispiel', phone: '+49 30 1234567', email: 'buchhaltung@beispiel-software.de' },
    },
    buyer: {
      name: 'Bundesamt für Beispielwesen',
      electronicAddress: '04011000-12345-67',
      electronicAddressScheme: '0204',
      address: { streetName: 'Amtsweg 1', city: 'Bonn', postCode: '53113', countryCode: 'DE' },
    },
    payment: {
      meansTypeCode: '58',
      remittanceInformation: 'RE-2026-0100',
      creditTransfers: [
        { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', accountName: 'Beispiel Software GmbH' },
      ],
    },
    lines: [
      {
        id: '1',
        quantity: 10,
        unitCode: 'HUR',
        item: { name: 'Softwareentwicklung' },
        price: { netPrice: 95 },
        vat: { categoryCode: 'S', rate: 19 },
      },
    ],
  };
}

describe('invoicegate validate', () => {
  it('exits 0 for a valid UBL invoice', async () => {
    const file = join(tmp, 'valid.xml');
    writeFileSync(file, ublSample(), 'utf8');
    const cap = captured();

    const code = await run(['validate', file], cap.io);

    expect(code).toBe(0);
    expect(cap.stdout()).toContain('UBL');
    expect(cap.stdout()).toContain('VALID');
  });

  it('exits 1 and reports BR-DE-15 when BuyerReference is missing', async () => {
    const file = join(tmp, 'no-buyer-ref.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    const code = await run(['validate', file], cap.io);

    expect(code).toBe(1);
    expect(cap.stdout()).toContain('BR-DE-15');
    expect(cap.stdout()).toContain('ERROR');
  });

  it('--json prints machine-readable JSON with valid:false', async () => {
    const file = join(tmp, 'no-buyer-ref-json.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    const code = await run(['validate', file, '--json'], cap.io);

    expect(code).toBe(1);
    const parsed = JSON.parse(cap.stdout()) as {
      valid: boolean;
      violations: Array<{ ruleId: string }>;
    };
    expect(parsed.valid).toBe(false);
    expect(parsed.violations.some((v) => v.ruleId === 'BR-DE-15')).toBe(true);
  });

  it('exits 2 for an unreadable file', async () => {
    const cap = captured();
    const code = await run(['validate', join(tmp, 'does-not-exist.xml')], cap.io);
    expect(code).toBe(2);
    expect(cap.stderr()).toContain('cannot read');
  });
});

describe('invoicegate generate', () => {
  it('generates XML from a JSON invoice and exits 0', async () => {
    const file = join(tmp, 'invoice.json');
    writeFileSync(file, JSON.stringify(validInvoiceJson()), 'utf8');
    const cap = captured();

    const code = await run(['generate', file], cap.io);

    expect(cap.stderr()).toBe('');
    expect(code).toBe(0);
    expect(cap.stdout().startsWith('<?xml')).toBe(true);
    expect(cap.stdout()).toContain('<cbc:ID>RE-2026-0100</cbc:ID>');
  });

  it('accepts a { "invoice": ... } wrapper and writes to -o', async () => {
    const file = join(tmp, 'wrapped.json');
    const outFile = join(tmp, 'out.xml');
    writeFileSync(file, JSON.stringify({ invoice: validInvoiceJson() }), 'utf8');
    const cap = captured();

    const code = await run(['generate', file, '-o', outFile], cap.io);

    expect(code).toBe(0);
    expect(readFileSync(outFile, 'utf8').startsWith('<?xml')).toBe(true);
  });

  it('exits 1 for an incomplete invoice but still writes the XML', async () => {
    const file = join(tmp, 'incomplete.json');
    writeFileSync(
      file,
      JSON.stringify({
        number: 'X-1',
        lines: [
          { id: '1', quantity: 1, unitCode: 'C62', item: { name: 'Ding' }, price: { netPrice: 10 }, vat: { categoryCode: 'S', rate: 19 } },
        ],
      }),
      'utf8',
    );
    const cap = captured();

    const code = await run(['generate', file], cap.io);

    expect(code).toBe(1);
    expect(cap.stdout().startsWith('<?xml')).toBe(true);
    expect(cap.stderr()).toContain('validation error');
  });

  it('--no-validate skips validation of an incomplete invoice', async () => {
    const file = join(tmp, 'incomplete2.json');
    writeFileSync(file, JSON.stringify({ number: 'X-2', lines: [] }), 'utf8');
    const cap = captured();

    const code = await run(['generate', file, '--no-validate'], cap.io);

    expect(code).toBe(0);
    expect(cap.stdout().startsWith('<?xml')).toBe(true);
  });

  it('exits 2 for malformed JSON', async () => {
    const file = join(tmp, 'broken.json');
    writeFileSync(file, '{ not json', 'utf8');
    const cap = captured();

    const code = await run(['generate', file], cap.io);

    expect(code).toBe(2);
    expect(cap.stderr()).toContain('not valid JSON');
  });
});

describe('invoicegate (top level)', () => {
  it('prints usage and exits 0 with no arguments', async () => {
    const cap = captured();
    const code = await run([], cap.io);
    expect(code).toBe(0);
    expect(cap.stdout()).toContain('Usage:');
  });

  it('--version prints the package version', async () => {
    const cap = captured();
    const code = await run(['--version'], cap.io);
    expect(code).toBe(0);
    expect(cap.stdout()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('exits 2 for an unknown command', async () => {
    const cap = captured();
    const code = await run(['frobnicate'], cap.io);
    expect(code).toBe(2);
    expect(cap.stderr()).toContain('unknown command');
  });
});
