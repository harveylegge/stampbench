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

/**
 * A CrossIndustryInvoice (ZUGFeRD/Factur-X/XRechnung-CII syntax) mirroring the
 * same semantic content as validInvoice() — used to prove syntax parity.
 */
export const RAW_CII_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${XRECHNUNG_30_SPEC_ID}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>RE-2026-0042</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260801</udt:DateTimeString></ram:IssueDateTime>
    <ram:IncludedNote><ram:Content>Lieferung erfolgte am 28.07.2026.</ram:Content></ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>Softwareentwicklung</ram:Name>
        <ram:Description>Sprint 14</ram:Description>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>95.00</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="HUR">10</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>950.00</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>2</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>Fachbuch "EN 16931 &amp; XRechnung"</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>39.90</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">3</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>7</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>119.70</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>04011000-12345-67</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>Beispiel Software GmbH</ram:Name>
        <ram:DefinedTradeContact>
          <ram:PersonName>Anna Beispiel</ram:PersonName>
          <ram:TelephoneUniversalCommunication><ram:CompleteNumber>+49 30 1234567</ram:CompleteNumber></ram:TelephoneUniversalCommunication>
          <ram:EmailURIUniversalCommunication><ram:URIID>buchhaltung@beispiel-software.de</ram:URIID></ram:EmailURIUniversalCommunication>
        </ram:DefinedTradeContact>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>10115</ram:PostcodeCode>
          <ram:LineOne>Musterstraße 12</ram:LineOne>
          <ram:CityName>Berlin</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">rechnung@beispiel-software.de</ram:URIID></ram:URIUniversalCommunication>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE123456789</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>Bundesamt für Beispielwesen</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>53113</ram:PostcodeCode>
          <ram:LineOne>Amtsweg 1</ram:LineOne>
          <ram:CityName>Bonn</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>RE-2026-0042</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>DE89370400440532013000</ram:IBANID>
          <ram:AccountName>Beispiel Software GmbH</ram:AccountName>
        </ram:PayeePartyCreditorFinancialAccount>
        <ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>COBADEFFXXX</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>171.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>900.00</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>8.38</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>119.70</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>7</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeAllowanceCharge>
        <ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>
        <ram:ActualAmount>50.00</ram:ActualAmount>
        <ram:Reason>Treuerabatt</ram:Reason>
        <ram:CategoryTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
        </ram:CategoryTradeTax>
      </ram:SpecifiedTradeAllowanceCharge>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Zahlbar innerhalb von 30 Tagen ohne Abzug.</ram:Description>
        <ram:DueDateDateTime><udt:DateTimeString format="102">20260831</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>1069.70</ram:LineTotalAmount>
        <ram:AllowanceTotalAmount>50.00</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount>1019.70</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">179.38</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>1199.08</ram:GrandTotalAmount>
        <ram:DuePayableAmount>1199.08</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

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
