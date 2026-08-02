import type { Invoice } from '../src/index.js';
import { withComputedTotals, XRECHNUNG_30_SPEC_ID } from '../src/index.js';

/** A fully compliant XRechnung invoice: 2 VAT rates, allowance, credit transfer. */
export function validInvoice(): Invoice {
  return withComputedTotals({
    specificationIdentifier: XRECHNUNG_30_SPEC_ID,
    number: 'RE-2026-0042',
    issueDate: '2026-08-01',
    dueDate: '2026-08-31',
    typeCode: '380',
    currencyCode: 'EUR',
    buyerReference: '04011000-12345-67',
    paymentTerms: 'Zahlbar innerhalb von 30 Tagen ohne Abzug.',
    notes: ['Lieferung erfolgte am 28.07.2026.'],
    seller: {
      name: 'Beispiel Software GmbH',
      vatId: 'DE123456789',
      legalRegistrationId: 'HRB 98765',
      electronicAddress: 'rechnung@beispiel-software.de',
      electronicAddressScheme: 'EM',
      address: {
        streetName: 'Musterstraße 12',
        city: 'Berlin',
        postCode: '10115',
        countryCode: 'DE',
      },
      contact: {
        name: 'Anna Beispiel',
        phone: '+49 30 1234567',
        email: 'buchhaltung@beispiel-software.de',
      },
    },
    buyer: {
      name: 'Bundesamt für Beispielwesen',
      electronicAddress: '04011000-12345-67',
      electronicAddressScheme: '0204',
      address: {
        streetName: 'Amtsweg 1',
        city: 'Bonn',
        postCode: '53113',
        countryCode: 'DE',
      },
    },
    payment: {
      meansTypeCode: '58',
      remittanceInformation: 'RE-2026-0042',
      creditTransfers: [
        { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', accountName: 'Beispiel Software GmbH' },
      ],
    },
    allowancesCharges: [
      {
        isCharge: false,
        amount: 50,
        reason: 'Treuerabatt',
        vatCategoryCode: 'S',
        vatRate: 19,
      },
    ],
    lines: [
      {
        id: '1',
        quantity: 10,
        unitCode: 'HUR',
        item: { name: 'Softwareentwicklung', description: 'Sprint 14' },
        price: { netPrice: 95 },
        vat: { categoryCode: 'S', rate: 19 },
      },
      {
        id: '2',
        quantity: 3,
        unitCode: 'C62',
        item: { name: 'Fachbuch "EN 16931 & XRechnung"' },
        price: { netPrice: 39.9 },
        vat: { categoryCode: 'S', rate: 7 },
      },
    ],
  });
}

/** Raw UBL XML written by hand (not by our generator) to test parsing independently. */
export const RAW_UBL_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${XRECHNUNG_30_SPEC_ID}</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>INV-77</cbc:ID>
  <cbc:IssueDate>2026-07-15</cbc:IssueDate>
  <cbc:DueDate>2026-08-14</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>Vielen Dank für Ihren Auftrag &amp; weiterhin gute Zusammenarbeit.</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>991-01234-56</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
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
      <cbc:Name>Widget &lt;Premium&gt;</cbc:Name>
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
