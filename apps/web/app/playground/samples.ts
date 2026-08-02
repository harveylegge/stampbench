/** A compliant XRechnung 3.0 sample document, with a couple of fields users can break. */
export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>RE-2026-0042</cbc:ID>
  <cbc:IssueDate>2026-08-01</cbc:IssueDate>
  <cbc:DueDate>2026-08-31</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>04011000-12345-67</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">rechnung@beispiel-software.de</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Musterstraße 12</cbc:StreetName>
        <cbc:CityName>Berlin</cbc:CityName>
        <cbc:PostalZone>10115</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE123456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Beispiel Software GmbH</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>Anna Beispiel</cbc:Name>
        <cbc:Telephone>+49 30 1234567</cbc:Telephone>
        <cbc:ElectronicMail>buchhaltung@beispiel-software.de</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>Amtsweg 1</cbc:StreetName>
        <cbc:CityName>Bonn</cbc:CityName>
        <cbc:PostalZone>53113</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Bundesamt für Beispielwesen</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>RE-2026-0042</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>DE89370400440532013000</cbc:ID>
      <cbc:Name>Beispiel Software GmbH</cbc:Name>
      <cac:FinancialInstitutionBranch><cbc:ID>COBADEFFXXX</cbc:ID></cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>Zahlbar innerhalb von 30 Tagen ohne Abzug.</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">180.50</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">950.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">180.50</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">950.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">950.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">1130.50</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">1130.50</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="HUR">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">950.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>Sprint 14</cbc:Description>
      <cbc:Name>Softwareentwicklung</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">95.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

/** Sample generate-endpoint payload: totals are computed server-side. */
export const SAMPLE_GENERATE_JSON = JSON.stringify(
  {
    invoice: {
      number: 'RE-2026-0043',
      issueDate: '2026-08-02',
      dueDate: '2026-09-01',
      currencyCode: 'EUR',
      buyerReference: 'PO-2026-118',
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
        name: 'Kunde AG',
        address: { streetName: 'Kundenallee 9', city: 'München', postCode: '80331', countryCode: 'DE' },
      },
      payment: {
        meansTypeCode: '58',
        remittanceInformation: 'RE-2026-0043',
        creditTransfers: [{ iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' }],
      },
      lines: [
        {
          id: '1',
          quantity: 12,
          unitCode: 'HUR',
          item: { name: 'Beratung' },
          price: { netPrice: 120 },
          vat: { categoryCode: 'S', rate: 19 },
        },
      ],
    },
  },
  null,
  2,
);
