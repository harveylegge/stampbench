import { describe, expect, it } from 'vitest';
import { boundSemanticPaths, locateSemanticPath } from '../src/locate/bindings.js';
import { indexXml } from '../src/locate/xml-index.js';
import { parseUblInvoice } from '../src/parse/ubl.js';

/** 1-based line number of the first line containing `needle`. */
function lineOf(lines: readonly string[], needle: string): number {
  const found = lines.findIndex((l) => l.includes(needle));
  if (found === -1) throw new Error(`fixture has no line containing "${needle}"`);
  return found + 1;
}

// A UBL document built specifically around the ambiguities the custom
// resolvers exist for: two PartyTaxSchemes, two TaxTotals in different
// currencies, and a PaymentMeans with no account ahead of one with an account.
const UBL_LINES = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
  '         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
  '         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">',
  '  <cbc:ID>INV-2026-001</cbc:ID>',
  '  <cbc:IssueDate>2026-08-03</cbc:IssueDate>',
  '  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>',
  '  <cac:AccountingSupplierParty>',
  '    <cac:Party>',
  '      <cac:PartyTaxScheme>',
  '        <cbc:CompanyID>HRB-12345</cbc:CompanyID>',
  '        <cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme>',
  '      </cac:PartyTaxScheme>',
  '      <cac:PartyTaxScheme>',
  '        <cbc:CompanyID>DE123456789</cbc:CompanyID>',
  '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
  '      </cac:PartyTaxScheme>',
  '      <cac:PartyLegalEntity>',
  '        <cbc:RegistrationName>Muster GmbH</cbc:RegistrationName>',
  '      </cac:PartyLegalEntity>',
  '    </cac:Party>',
  '  </cac:AccountingSupplierParty>',
  '  <cac:PaymentMeans>',
  '    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>',
  '  </cac:PaymentMeans>',
  '  <cac:PaymentMeans>',
  '    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>',
  '    <cac:PayeeFinancialAccount>',
  '      <cbc:ID>DE02120300000000202051</cbc:ID>',
  '    </cac:PayeeFinancialAccount>',
  '  </cac:PaymentMeans>',
  '  <cac:TaxTotal>',
  '    <cbc:TaxAmount currencyID="USD">21.00</cbc:TaxAmount>',
  '  </cac:TaxTotal>',
  '  <cac:TaxTotal>',
  '    <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>',
  '    <cac:TaxSubtotal>',
  '      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>',
  '      <cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>',
  '      <cac:TaxCategory>',
  '        <cbc:ID>S</cbc:ID>',
  '        <cbc:Percent>19</cbc:Percent>',
  '      </cac:TaxCategory>',
  '    </cac:TaxSubtotal>',
  '  </cac:TaxTotal>',
  '  <cac:LegalMonetaryTotal>',
  '    <cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>',
  '  </cac:LegalMonetaryTotal>',
  '  <cac:InvoiceLine>',
  '    <cbc:ID>1</cbc:ID>',
  '    <cbc:InvoicedQuantity unitCode="C62">2</cbc:InvoicedQuantity>',
  '  </cac:InvoiceLine>',
  '  <cac:InvoiceLine>',
  '    <cbc:ID>2</cbc:ID>',
  '    <cbc:InvoicedQuantity unitCode="XYZ">3</cbc:InvoicedQuantity>',
  '    <cac:Item>',
  '      <cbc:Name>Widget</cbc:Name>',
  '    </cac:Item>',
  '  </cac:InvoiceLine>',
  '</Invoice>',
];
const UBL_INDEX = indexXml(UBL_LINES.join('\n'));

describe('locateSemanticPath — UBL', () => {
  const locate = (path: string) => locateSemanticPath(UBL_INDEX, 'ubl', path);

  it('locates simple top-level fields', () => {
    expect(locate('number')!.line).toBe(lineOf(UBL_LINES, 'INV-2026-001'));
    expect(locate('currencyCode')!.line).toBe(lineOf(UBL_LINES, 'DocumentCurrencyCode'));
    expect(locate('number')!.match).toBe('exact');
  });

  it('converts 0-based semantic indices to 1-based XPath positions', () => {
    expect(locate('lines[0].id')!.line).toBe(lineOf(UBL_LINES, '<cbc:ID>1</cbc:ID>'));
    expect(locate('lines[1].id')!.line).toBe(lineOf(UBL_LINES, '<cbc:ID>2</cbc:ID>'));
    expect(locate('lines[1].item.name')!.line).toBe(lineOf(UBL_LINES, 'Widget'));
  });

  it('locates an attribute-carried value on the attribute itself', () => {
    const hit = locate('lines[1].unitCode')!;
    expect(hit.line).toBe(lineOf(UBL_LINES, 'unitCode="XYZ"'));
    expect(hit.match).toBe('exact');
    expect(hit.resolvedPath).toContain('@unitCode');
  });

  it('picks the PartyTaxScheme whose TaxScheme is VAT, not the first one', () => {
    const hit = locate('seller.vatId')!;
    expect(hit.line).toBe(lineOf(UBL_LINES, 'DE123456789'));
    expect(hit.resolvedPath).toBe('/Invoice/AccountingSupplierParty/Party/PartyTaxScheme[2]/CompanyID');
  });

  it('picks the non-VAT PartyTaxScheme for the tax registration id', () => {
    expect(locate('seller.taxRegistrationId')!.line).toBe(lineOf(UBL_LINES, 'HRB-12345'));
  });

  it('picks the TaxTotal stated in the document currency', () => {
    const hit = locate('totals.taxTotal')!;
    expect(hit.line).toBe(lineOf(UBL_LINES, 'currencyID="EUR">19.00'));
    expect(hit.resolvedPath).toBe('/Invoice/TaxTotal[2]/TaxAmount');
  });

  it('resolves the VAT breakdown inside the document-currency TaxTotal', () => {
    expect(locate('vatBreakdown[0].taxableAmount')!.line).toBe(lineOf(UBL_LINES, 'TaxableAmount'));
    expect(locate('vatBreakdown[0].categoryCode')!.line).toBe(lineOf(UBL_LINES, '<cbc:ID>S</cbc:ID>'));
    expect(locate('vatBreakdown[0].rate')!.line).toBe(lineOf(UBL_LINES, 'Percent'));
  });

  it('skips payment means that carry no account when indexing credit transfers', () => {
    const hit = locate('payment.creditTransfers[0].iban')!;
    expect(hit.line).toBe(lineOf(UBL_LINES, 'DE02120300000000202051'));
    expect(hit.resolvedPath).toBe('/Invoice/PaymentMeans[2]/PayeeFinancialAccount/ID');
  });

  it('falls back to the nearest existing ancestor for an absent field', () => {
    const hit = locate('lines[0].item.name')!;
    expect(hit.match).toBe('ancestor');
    expect(hit.line).toBe(lineOf(UBL_LINES, '<cbc:ID>1</cbc:ID>') - 1);
  });

  it('falls back to the parent object when the leaf is not bound at all', () => {
    const hit = locateSemanticPath(UBL_INDEX, 'ubl', 'lines[1].item.somethingNew')!;
    expect(hit.line).toBe(lineOf(UBL_LINES, '<cac:Item>'));
  });

  it('returns undefined for a path with no binding anywhere in its chain', () => {
    expect(locateSemanticPath(UBL_INDEX, 'ubl', 'nonsense')).toBeUndefined();
  });
});

const CII_LINES = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"',
  '    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"',
  '    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
  '  <rsm:ExchangedDocument>',
  '    <ram:ID>CII-2026-001</ram:ID>',
  '    <ram:TypeCode>380</ram:TypeCode>',
  '  </rsm:ExchangedDocument>',
  '  <rsm:SupplyChainTradeTransaction>',
  '    <ram:IncludedSupplyChainTradeLineItem>',
  '      <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>',
  '      <ram:SpecifiedLineTradeDelivery>',
  '        <ram:BilledQuantity unitCode="C62">2</ram:BilledQuantity>',
  '      </ram:SpecifiedLineTradeDelivery>',
  '    </ram:IncludedSupplyChainTradeLineItem>',
  '    <ram:IncludedSupplyChainTradeLineItem>',
  '      <ram:AssociatedDocumentLineDocument><ram:LineID>2</ram:LineID></ram:AssociatedDocumentLineDocument>',
  '      <ram:SpecifiedTradeProduct><ram:Name>Zweites Produkt</ram:Name></ram:SpecifiedTradeProduct>',
  '      <ram:SpecifiedLineTradeDelivery>',
  '        <ram:BilledQuantity unitCode="XYZ">3</ram:BilledQuantity>',
  '      </ram:SpecifiedLineTradeDelivery>',
  '    </ram:IncludedSupplyChainTradeLineItem>',
  '    <ram:ApplicableHeaderTradeAgreement>',
  '      <ram:SellerTradeParty>',
  '        <ram:Name>Muster GmbH</ram:Name>',
  '        <ram:SpecifiedTaxRegistration>',
  '          <ram:ID schemeID="FC">201/123/40004</ram:ID>',
  '        </ram:SpecifiedTaxRegistration>',
  '        <ram:SpecifiedTaxRegistration>',
  '          <ram:ID schemeID="VA">DE123456789</ram:ID>',
  '        </ram:SpecifiedTaxRegistration>',
  '      </ram:SellerTradeParty>',
  '    </ram:ApplicableHeaderTradeAgreement>',
  '    <ram:ApplicableHeaderTradeSettlement>',
  '      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>',
  '      <ram:SpecifiedTradeSettlementPaymentMeans>',
  '        <ram:TypeCode>58</ram:TypeCode>',
  '      </ram:SpecifiedTradeSettlementPaymentMeans>',
  '      <ram:SpecifiedTradeSettlementPaymentMeans>',
  '        <ram:TypeCode>58</ram:TypeCode>',
  '        <ram:PayeePartyCreditorFinancialAccount>',
  '          <ram:IBANID>DE02120300000000202051</ram:IBANID>',
  '        </ram:PayeePartyCreditorFinancialAccount>',
  '      </ram:SpecifiedTradeSettlementPaymentMeans>',
  '      <ram:ApplicableTradeTax>',
  '        <ram:CalculatedAmount>19.00</ram:CalculatedAmount>',
  '        <ram:CategoryCode>S</ram:CategoryCode>',
  '      </ram:ApplicableTradeTax>',
  '      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
  '        <ram:TaxTotalAmount currencyID="USD">21.00</ram:TaxTotalAmount>',
  '        <ram:TaxTotalAmount currencyID="EUR">19.00</ram:TaxTotalAmount>',
  '        <ram:DuePayableAmount>119.00</ram:DuePayableAmount>',
  '      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
  '    </ram:ApplicableHeaderTradeSettlement>',
  '  </rsm:SupplyChainTradeTransaction>',
  '</rsm:CrossIndustryInvoice>',
];
const CII_INDEX = indexXml(CII_LINES.join('\n'));

describe('locateSemanticPath — CII', () => {
  const locate = (path: string) => locateSemanticPath(CII_INDEX, 'cii', path);

  it('locates fields through the CII nesting', () => {
    expect(locate('number')!.line).toBe(lineOf(CII_LINES, 'CII-2026-001'));
    expect(locate('currencyCode')!.line).toBe(lineOf(CII_LINES, 'InvoiceCurrencyCode'));
    expect(locate('totals.amountDue')!.line).toBe(lineOf(CII_LINES, 'DuePayableAmount'));
  });

  it('indexes lines correctly despite lines preceding the header groups', () => {
    expect(locate('lines[0].id')!.line).toBe(lineOf(CII_LINES, '<ram:LineID>1<'));
    expect(locate('lines[1].item.name')!.line).toBe(lineOf(CII_LINES, 'Zweites Produkt'));
    expect(locate('lines[1].unitCode')!.line).toBe(lineOf(CII_LINES, 'unitCode="XYZ"'));
  });

  it('picks the non-FC tax registration as the VAT identifier', () => {
    expect(locate('seller.vatId')!.line).toBe(lineOf(CII_LINES, 'DE123456789'));
    expect(locate('seller.taxRegistrationId')!.line).toBe(lineOf(CII_LINES, '201/123/40004'));
  });

  it('picks the TaxTotalAmount in the document currency', () => {
    expect(locate('totals.taxTotal')!.line).toBe(lineOf(CII_LINES, 'currencyID="EUR">19.00'));
  });

  it('skips account-less payment means when indexing credit transfers', () => {
    expect(locate('payment.creditTransfers[0].iban')!.line).toBe(
      lineOf(CII_LINES, 'DE02120300000000202051'),
    );
  });

  it('resolves the VAT breakdown', () => {
    expect(locate('vatBreakdown[0].taxAmount')!.line).toBe(lineOf(CII_LINES, 'CalculatedAmount'));
    expect(locate('vatBreakdown[0].categoryCode')!.line).toBe(lineOf(CII_LINES, 'CategoryCode'));
  });
});

/**
 * The contract stated at the top of bindings.ts: "a binding is correct
 * precisely when it names the element the parser read the value from."
 *
 * Each case below is a document where the naive binding picks a *different*
 * element than the parser does — the failure mode that produces a confident,
 * plausible, wrong line number. The assertion is always the same: whatever the
 * parser put in the semantic model must be the text at the located line.
 */
describe('bindings agree with the parser', () => {
  function ubl(body: string): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Invoice xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">',
      body,
      '</Invoice>',
    ].join('\n');
  }

  /** Assert the located element holds exactly the value the parser extracted. */
  function expectAgreement(xml: string, semanticPath: string, parsed: string | number | undefined): void {
    expect(parsed, `parser produced nothing for ${semanticPath}`).toBeDefined();
    const hit = locateSemanticPath(indexXml(xml), 'ubl', semanticPath);
    expect(hit, `no location for ${semanticPath}`).toBeDefined();
    expect(hit!.match).toBe('exact');
    expect(Number(hit!.value) || hit!.value).toBe(Number(parsed) || parsed);
  }

  it('picks the LAST VAT scheme, because the parser overwrites earlier ones', () => {
    const xml = ubl(
      [
        '  <cac:AccountingSupplierParty><cac:Party>',
        '    <cac:PartyTaxScheme>',
        '      <cbc:CompanyID>DE111111111</cbc:CompanyID>',
        '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
        '    </cac:PartyTaxScheme>',
        '    <cac:PartyTaxScheme>',
        '      <cbc:CompanyID>DE999999999</cbc:CompanyID>',
        '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
        '    </cac:PartyTaxScheme>',
        '  </cac:Party></cac:AccountingSupplierParty>',
      ].join('\n'),
    );
    expectAgreement(xml, 'seller.vatId', parseUblInvoice(xml).seller?.vatId);
  });

  it('skips a VAT scheme with no CompanyID, because the parser skips it', () => {
    const xml = ubl(
      [
        '  <cac:AccountingSupplierParty><cac:Party>',
        '    <cac:PartyTaxScheme>',
        '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
        '    </cac:PartyTaxScheme>',
        '    <cac:PartyTaxScheme>',
        '      <cbc:CompanyID>DE999999999</cbc:CompanyID>',
        '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>',
        '    </cac:PartyTaxScheme>',
        '  </cac:Party></cac:AccountingSupplierParty>',
      ].join('\n'),
    );
    expectAgreement(xml, 'seller.vatId', parseUblInvoice(xml).seller?.vatId);
  });

  it('matches the parser when the document has no currency code at all', () => {
    // With no DocumentCurrencyCode the parser looks for a TaxTotal whose
    // TaxAmount carries no @currencyID — here the second one, not the first.
    const xml = ubl(
      [
        '  <cac:TaxTotal>',
        '    <cbc:TaxAmount currencyID="EUR">10.00</cbc:TaxAmount>',
        '    <cac:TaxSubtotal><cbc:TaxableAmount>100.00</cbc:TaxableAmount>',
        '      <cbc:TaxAmount>10.00</cbc:TaxAmount>',
        '      <cac:TaxCategory><cbc:ID>S</cbc:ID></cac:TaxCategory></cac:TaxSubtotal>',
        '  </cac:TaxTotal>',
        '  <cac:TaxTotal>',
        '    <cbc:TaxAmount>777.00</cbc:TaxAmount>',
        '    <cac:TaxSubtotal><cbc:TaxableAmount>888.00</cbc:TaxableAmount>',
        '      <cbc:TaxAmount>777.00</cbc:TaxAmount>',
        '      <cac:TaxCategory><cbc:ID>S</cbc:ID></cac:TaxCategory></cac:TaxSubtotal>',
        '  </cac:TaxTotal>',
      ].join('\n'),
    );
    const parsed = parseUblInvoice(xml);
    expectAgreement(xml, 'totals.taxTotal', parsed.totals?.taxTotal);
    expectAgreement(xml, 'vatBreakdown[0].taxableAmount', parsed.vatBreakdown?.[0]?.taxableAmount);
  });

  it('skips a preceding invoice with no number, because the parser filters it out', () => {
    const xml = ubl(
      [
        '  <cac:BillingReference>',
        '    <cac:InvoiceDocumentReference><cbc:IssueDate>2026-01-01</cbc:IssueDate></cac:InvoiceDocumentReference>',
        '  </cac:BillingReference>',
        '  <cac:BillingReference>',
        '    <cac:InvoiceDocumentReference><cbc:ID>PREV-1</cbc:ID></cac:InvoiceDocumentReference>',
        '  </cac:BillingReference>',
      ].join('\n'),
    );
    expectAgreement(xml, 'precedingInvoices[0].number', parseUblInvoice(xml).precedingInvoices?.[0]?.number);
  });

  it('skips a payment means whose account yields no fields', () => {
    const xml = ubl(
      [
        '  <cac:PaymentMeans>',
        '    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>',
        '    <cac:PayeeFinancialAccount></cac:PayeeFinancialAccount>',
        '  </cac:PaymentMeans>',
        '  <cac:PaymentMeans>',
        '    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>',
        '    <cac:PayeeFinancialAccount><cbc:ID>DE02120300000000202051</cbc:ID></cac:PayeeFinancialAccount>',
        '  </cac:PaymentMeans>',
      ].join('\n'),
    );
    expectAgreement(
      xml,
      'payment.creditTransfers[0].iban',
      parseUblInvoice(xml).payment?.creditTransfers?.[0]?.iban,
    );
  });
});

describe('binding tables', () => {
  it('bind the same semantic paths for both syntaxes', () => {
    const ubl = new Set(boundSemanticPaths('ubl'));
    const cii = new Set(boundSemanticPaths('cii'));
    // A path bound for one syntax but not the other means a document in that
    // syntax silently loses line-level precision for those violations.
    const onlyUbl = [...ubl].filter((p) => !cii.has(p));
    const onlyCii = [...cii].filter((p) => !ubl.has(p));
    expect({ onlyUbl, onlyCii }).toEqual({ onlyUbl: [], onlyCii: [] });
  });
});
