import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { XRECHNUNG_30_SPEC_ID } from '@stampbench/core';
import { run } from '../src/run.js';

const tmp = mkdtempSync(join(tmpdir(), 'stampbench-cli-'));

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

describe('stampbench validate', () => {
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

describe('stampbench validate — CI output', () => {
  /** 1-based line of the first line containing `needle`. */
  function lineOf(xml: string, needle: string): number {
    const found = xml.split('\n').findIndex((l) => l.includes(needle));
    if (found === -1) throw new Error(`sample has no line containing "${needle}"`);
    return found + 1;
  }

  /** The sample with an unrecognised unit code, which trips IG-W-01 (a warning). */
  function badUnitCode(): string {
    return ublSample().replace('unitCode="C62"', 'unitCode="ZZZ"');
  }

  it('annotates the exact line of the offending attribute', async () => {
    const xml = badUnitCode();
    const file = join(tmp, 'gh-unit.xml');
    writeFileSync(file, xml, 'utf8');
    const cap = captured();

    const code = await run(['validate', file, '--format', 'github'], cap.io);

    expect(code).toBe(0); // warnings alone do not fail the build
    const annotation = cap.stdout().split('\n').find((l) => l.includes('IG-W-01'))!;
    expect(annotation).toBeDefined();
    expect(annotation.startsWith('::warning ')).toBe(true);
    expect(annotation).toContain(`line=${lineOf(xml, 'unitCode="ZZZ"')}`);
    // The column points at the attribute, not the start of the element.
    expect(annotation).toContain(`col=${xml.split('\n')[lineOf(xml, 'unitCode="ZZZ"') - 1]!.indexOf('unitCode') + 1}`);
    // An exactly-located finding must not carry an approximation caveat.
    expect(annotation).not.toContain('no element for this field');
  });

  it('says so when the field is absent and the line is only approximate', async () => {
    const file = join(tmp, 'gh-missing.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    const code = await run(['validate', file, '--format', 'github'], cap.io);

    expect(code).toBe(1);
    expect(cap.stdout()).toContain('::error ');
    expect(cap.stdout()).toContain('BR-DE-15');
    expect(cap.stdout()).toContain('no element for this field');
  });

  it('always states the true totals on stderr, whatever GitHub renders', async () => {
    const file = join(tmp, 'gh-totals.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    await run(['validate', file, '--format', 'github'], cap.io);

    expect(cap.stderr()).toMatch(/\d+ errors?, \d+ warnings? in 1 file\./);
  });

  it('caps annotations with --max-annotations and reports the remainder', async () => {
    const file = join(tmp, 'gh-capped.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    await run(['validate', file, '--format', 'github', '--max-annotations', '0'], cap.io);

    expect(cap.stdout()).toBe('');
    expect(cap.stderr()).toContain('not annotated');
  });

  it('emits SARIF that carries rule metadata and a region', async () => {
    const file = join(tmp, 'sarif.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    const code = await run(['validate', file, '--format', 'sarif'], cap.io);

    expect(code).toBe(1);
    const sarif = JSON.parse(cap.stdout()) as {
      version: string;
      runs: {
        tool: { driver: { rules: { id: string }[] } };
        results: {
          ruleId: string;
          ruleIndex: number;
          locations: { physicalLocation: { region: { startLine: number } } }[];
        }[];
      }[];
    };
    expect(sarif.version).toBe('2.1.0');
    const run0 = sarif.runs[0]!;
    const finding = run0.results.find((r) => r.ruleId === 'BR-DE-15')!;
    expect(finding).toBeDefined();
    expect(run0.tool.driver.rules[finding.ruleIndex]!.id).toBe('BR-DE-15');
    expect(finding.locations[0]!.physicalLocation.region.startLine).toBeGreaterThan(0);
  });

  it('adds a location to every violation in --json output', async () => {
    const file = join(tmp, 'json-loc.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    await run(['validate', file, '--json'], cap.io);

    const parsed = JSON.parse(cap.stdout()) as {
      valid: boolean;
      violations: Array<{ ruleId: string; location: { line: number; precision: string; xpath: string } }>;
    };
    // The long-standing single-file shape is preserved, with locations added.
    expect(parsed.valid).toBe(false);
    const v = parsed.violations.find((x) => x.ruleId === 'BR-DE-15')!;
    expect(v.location.line).toBeGreaterThan(0);
    expect(v.location.precision).toBe('ancestor');
    expect(v.location.xpath).toBe('/Invoice');
  });

  it('validates a whole directory and summarises across files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stampbench-dir-'));
    writeFileSync(join(dir, 'ok.xml'), ublSample(), 'utf8');
    writeFileSync(join(dir, 'bad.xml'), ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    const code = await run(['validate', dir], cap.io);

    expect(code).toBe(1);
    expect(cap.stdout()).toContain('ok.xml');
    expect(cap.stdout()).toContain('bad.xml');
    expect(cap.stdout()).toContain('across 2 files');
  });

  it('reports every file in the multi-file --json shape', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stampbench-dirjson-'));
    writeFileSync(join(dir, 'a.xml'), ublSample(), 'utf8');
    writeFileSync(join(dir, 'b.xml'), ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    await run(['validate', dir, '--json'], cap.io);

    const parsed = JSON.parse(cap.stdout()) as {
      files: Array<{ file: string; violations: unknown[] }>;
      summary: { files: number; errors: number; warnings: number };
    };
    expect(parsed.files).toHaveLength(2);
    expect(parsed.summary.files).toBe(2);
    expect(parsed.summary.errors).toBeGreaterThan(0);
  });

  it('fails the build on warnings with --fail-on warning', async () => {
    const file = join(tmp, 'warn-only.xml');
    writeFileSync(file, badUnitCode(), 'utf8');

    const lenient = captured();
    expect(await run(['validate', file], lenient.io)).toBe(0);

    const strict = captured();
    expect(await run(['validate', file, '--fail-on', 'warning'], strict.io)).toBe(1);
  });

  it('rejects an unknown --format', async () => {
    const file = join(tmp, 'fmt.xml');
    writeFileSync(file, ublSample(), 'utf8');
    const cap = captured();

    const code = await run(['validate', file, '--format', 'xml'], cap.io);

    expect(code).toBe(2);
    expect(cap.stderr()).toContain('--format must be one of');
  });

  it('shows line numbers in the human report, marking approximate ones', async () => {
    const file = join(tmp, 'human-lines.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    await run(['validate', file], cap.io);

    expect(cap.stdout()).toMatch(/BR-DE-15.*\(~line \d+\)/);
  });
});

describe('stampbench fix', () => {
  /** The sample with a VAT amount that disagrees with taxable × rate. */
  function wrongVat(): string {
    return ublSample().replace(
      '<cbc:TaxAmount currencyID="EUR">190.00</cbc:TaxAmount>\n      <cac:TaxCategory>',
      '<cbc:TaxAmount currencyID="EUR">999.00</cbc:TaxAmount>\n      <cac:TaxCategory>',
    );
  }

  it('repairs a derived amount and leaves the rest of the file untouched', async () => {
    const file = join(tmp, 'fix-vat.xml');
    const broken = wrongVat();
    expect(broken).not.toBe(ublSample());
    writeFileSync(file, broken, 'utf8');
    const cap = captured();

    const code = await run(['fix', file, '--write'], cap.io);

    expect(code).toBe(0);
    const repaired = readFileSync(file, 'utf8');
    // The corrected file is exactly the original sample again.
    expect(repaired).toBe(ublSample());
    expect(cap.stdout()).toContain('999.00 → 190.00');
  });

  it('writes nothing unless --write is given, and says so', async () => {
    const file = join(tmp, 'fix-preview.xml');
    const broken = wrongVat();
    writeFileSync(file, broken, 'utf8');
    const cap = captured();

    const code = await run(['fix', file], cap.io);

    // Non-zero so a pipeline fails while fixes are outstanding, like --check.
    expect(code).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe(broken);
    expect(cap.stderr()).toContain('--write');
  });

  it('refuses to invent a value it cannot derive', async () => {
    const file = join(tmp, 'fix-missing.xml');
    writeFileSync(file, ublSample({ buyerReference: false }), 'utf8');
    const cap = captured();

    const code = await run(['fix', file, '--write'], cap.io);

    // Nothing was repairable, and the file is untouched.
    expect(code).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe(ublSample({ buyerReference: false }));
    expect(cap.stdout()).toContain('BR-DE-15');
    expect(cap.stdout()).toContain('human decision');
  });

  it('withholds a fix that would change the amount due until confirmed', async () => {
    // With a prepaid amount stated, BR-CO-16 cannot tell whether the amount
    // due or the prepaid figure is wrong — rewriting the amount due would
    // change what the customer owes. That decision needs a person.
    const ambiguous = ublSample().replace(
      '<cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>',
      '<cbc:PrepaidAmount currencyID="EUR">190.00</cbc:PrepaidAmount>\n    <cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>',
    );
    const file = join(tmp, 'fix-amount-due.xml');
    writeFileSync(file, ambiguous, 'utf8');

    const preview = captured();
    const code = await run(['fix', file, '--write'], preview.io);
    expect(code).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe(ambiguous); // untouched
    expect(preview.stdout()).toContain('confirmation');

    const confirmed = captured();
    const code2 = await run(['fix', file, '--write', '--fix-amount-due'], confirmed.io);
    expect(code2).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('<cbc:PayableAmount currencyID="EUR">1000.00</cbc:PayableAmount>');
  });

  it('exits 0 and touches nothing when the invoice is already valid', async () => {
    const file = join(tmp, 'fix-clean.xml');
    writeFileSync(file, ublSample(), 'utf8');
    const cap = captured();

    const code = await run(['fix', file], cap.io);

    expect(code).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(ublSample());
    expect(cap.stdout()).toContain('Nothing to fix');
  });

  it('reports fixes and refusals in --json', async () => {
    const file = join(tmp, 'fix-json.xml');
    writeFileSync(file, wrongVat(), 'utf8');
    const cap = captured();

    await run(['fix', file, '--json'], cap.io);

    const parsed = JSON.parse(cap.stdout()) as {
      files: Array<{
        applied: Array<{ line: number; ruleId: string; previous: string; replacement: string }>;
        unfixable: Array<{ ruleId: string; reason: string }>;
      }>;
      summary: { fixes: number; written: boolean };
    };
    expect(parsed.summary.written).toBe(false);
    expect(parsed.summary.fixes).toBe(1);
    const edit = parsed.files[0]!.applied[0]!;
    expect(edit.previous).toBe('999.00');
    expect(edit.replacement).toBe('190.00');
    expect(edit.line).toBeGreaterThan(0);
  });

  it('fixes a whole directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stampbench-fixdir-'));
    writeFileSync(join(dir, 'a.xml'), wrongVat(), 'utf8');
    writeFileSync(join(dir, 'b.xml'), ublSample(), 'utf8');
    const cap = captured();

    const code = await run(['fix', dir, '--write'], cap.io);

    expect(code).toBe(0);
    expect(readFileSync(join(dir, 'a.xml'), 'utf8')).toBe(ublSample());
    expect(readFileSync(join(dir, 'b.xml'), 'utf8')).toBe(ublSample());
  });

  it('rejects an unknown option', async () => {
    const cap = captured();
    const code = await run(['fix', join(tmp, 'fix-clean.xml'), '--repair-everything'], cap.io);
    expect(code).toBe(2);
    expect(cap.stderr()).toContain('unknown option');
  });
});

describe('stampbench generate', () => {
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

describe('stampbench regress', () => {
  /** A folder of invoices: some already German-ready, some EU-core-only. */
  function corpus(name: string, files: Array<{ file: string; buyerReference?: boolean }>): string {
    const dir = mkdtempSync(join(tmpdir(), `stampbench-${name}-`));
    for (const f of files) {
      writeFileSync(join(dir, f.file), ublSample({ buyerReference: f.buyerReference ?? true }), 'utf8');
    }
    return dir;
  }

  it('reports which documents would start failing under a stricter ruleset', async () => {
    const dir = corpus('regress', [
      { file: 'eu-only.xml', buyerReference: false },
      { file: 'german-ready.xml' },
    ]);
    const cap = captured();

    const code = await run(['regress', dir, '--from', 'en16931@2017', '--to', 'xrechnung@3.0'], cap.io);

    // Non-zero so a CI pipeline fails the build before the rules take effect.
    expect(code).toBe(1);
    expect(cap.stdout()).toContain('1 document would START failing');
    expect(cap.stdout()).toContain('BR-DE-15');
    expect(cap.stdout()).toContain('eu-only.xml');
  });

  it('exits 0 when nothing regresses', async () => {
    const dir = corpus('regress-ok', [{ file: 'german-ready.xml' }]);
    const cap = captured();

    const code = await run(['regress', dir, '--from', 'en16931@2017', '--to', 'xrechnung@3.0'], cap.io);

    expect(code).toBe(0);
    expect(cap.stdout()).toContain('No regressions');
  });

  it('emits a machine-readable report with --json, ranked by impact', async () => {
    const dir = corpus('regress-json', [
      { file: 'a.xml', buyerReference: false },
      { file: 'b.xml', buyerReference: false },
      { file: 'c.xml' },
    ]);
    const cap = captured();

    const code = await run(
      ['regress', dir, '--from', 'en16931@2017', '--to', 'xrechnung@3.0', '--json'],
      cap.io,
    );

    expect(code).toBe(1);
    const report = JSON.parse(cap.stdout());
    expect(report.summary.total).toBe(3);
    expect(report.summary.regressions).toBe(2);
    expect(report.summary.unchangedPass).toBe(1);
    expect(report.to.specVersion).toBe('XRechnung 3.0');
    expect(report.byNewRule[0].ruleId).toBe('BR-DE-15');
    expect(report.byNewRule[0].documents).toBe(2);
  });

  it('rejects an unknown ruleset', async () => {
    const dir = corpus('regress-bad', [{ file: 'a.xml' }]);
    const cap = captured();

    const code = await run(['regress', dir, '--from', 'en16931@2017', '--to', 'nope@1.0'], cap.io);

    expect(code).toBe(2);
    expect(cap.stderr()).toContain('Unknown ruleset');
  });

  it('requires --from and --to', async () => {
    const dir = corpus('regress-usage', [{ file: 'a.xml' }]);
    const cap = captured();
    expect(await run(['regress', dir], cap.io)).toBe(2);
    expect(cap.stderr()).toContain('--from');
  });

  it('lists the available rule sets', async () => {
    const cap = captured();
    const code = await run(['rulesets'], cap.io);
    expect(code).toBe(0);
    expect(cap.stdout()).toContain('en16931@2017');
    expect(cap.stdout()).toContain('xrechnung@3.0');
  });
});

describe('stampbench (top level)', () => {
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
