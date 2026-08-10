/**
 * UBL 2.1 Invoice XML → EN 16931 semantic model.
 *
 * Namespace prefixes are stripped during parsing (UBL element local names are
 * unambiguous for our mapping). Values are kept as strings by the parser and
 * converted deliberately, so "0123" identifiers survive untouched.
 */
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type {
  AllowanceCharge,
  CreditTransfer,
  Delivery,
  Invoice,
  InvoiceLine,
  Party,
  PostalAddress,
  VatBreakdown,
} from '../model/invoice.js';

export class InvoiceParseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'InvoiceParseError';
  }
}

const ARRAY_PATHS = new Set([
  'Invoice.Note',
  'Invoice.InvoiceLine',
  'Invoice.PaymentMeans',
  'Invoice.AllowanceCharge',
  'Invoice.TaxTotal',
  'Invoice.BillingReference',
  'Invoice.TaxTotal.TaxSubtotal',
  'Invoice.PaymentTerms',
  'Invoice.AccountingSupplierParty.Party.PartyTaxScheme',
  'Invoice.AccountingCustomerParty.Party.PartyTaxScheme',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (_name, jpath) => ARRAY_PATHS.has(String(jpath)),
});

type Node = Record<string, unknown> | string | undefined;

/** Extract the text content of a node that may be a string or {'#text': …}. */
function text(node: Node): string | undefined {
  if (node === undefined || node === null) return undefined;
  if (typeof node === 'string') return node.length ? node : undefined;
  if (typeof node === 'object' && '#text' in node) {
    const t = (node as Record<string, unknown>)['#text'];
    return typeof t === 'string' && t.length ? t : undefined;
  }
  return undefined;
}

function attr(node: Node, name: string): string | undefined {
  if (node && typeof node === 'object') {
    const v = (node as Record<string, unknown>)[`@_${name}`];
    if (typeof v === 'string' && v.length) return v;
  }
  return undefined;
}

function num(node: Node): number | undefined {
  const t = text(node);
  if (t === undefined) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function obj(node: unknown): Record<string, unknown> | undefined {
  return node && typeof node === 'object' ? (node as Record<string, unknown>) : undefined;
}

function arr(node: unknown): Record<string, unknown>[] {
  if (node === undefined || node === null) return [];
  return (Array.isArray(node) ? node : [node]).map((n) => obj(n) ?? {});
}

/** BG-5 / BG-8 / BG-15 all use the same address shape. */
function parseAddress(node: unknown): PostalAddress | undefined {
  const postal = obj(node);
  if (!postal) return undefined;
  const address: PostalAddress = {};
  const set = (key: keyof PostalAddress, v: string | undefined) => {
    if (v) (address as Record<string, string>)[key] = v;
  };
  set('streetName', text(postal['StreetName'] as Node));
  set('additionalStreet', text(postal['AdditionalStreetName'] as Node));
  set('city', text(postal['CityName'] as Node));
  set('postCode', text(postal['PostalZone'] as Node));
  set('countrySubdivision', text(postal['CountrySubentity'] as Node));
  set('countryCode', text(obj(postal['Country'])?.['IdentificationCode'] as Node));
  return Object.keys(address).length ? address : undefined;
}

function parseParty(container: unknown): Party | undefined {
  const party = obj(obj(container)?.['Party']);
  if (!party) return undefined;
  const postal = obj(party['PostalAddress']);
  const contact = obj(party['Contact']);
  const legal = obj(party['PartyLegalEntity']);
  const out: Party = {};

  const endpoint = party['EndpointID'] as Node;
  if (text(endpoint)) {
    out.electronicAddress = text(endpoint);
    const scheme = attr(endpoint, 'schemeID');
    if (scheme) out.electronicAddressScheme = scheme;
  }
  // PartyIdentification may repeat; take the first ID rather than dropping all
  // when the parser hands us an array instead of a single object.
  const ident = text(arr(party['PartyIdentification'])[0]?.['ID'] as Node);
  if (ident) out.identifier = ident;
  const tradingName = text(obj(party['PartyName'])?.['Name'] as Node);
  const legalName = text(legal?.['RegistrationName'] as Node);
  // BT-27 maps to PartyLegalEntity/RegistrationName; PartyName is the trading name (BT-28).
  if (legalName) out.name = legalName;
  if (tradingName && tradingName !== legalName) out.tradingName = tradingName;
  if (!out.name && tradingName) out.name = tradingName;
  const legalId = text(legal?.['CompanyID'] as Node);
  if (legalId) out.legalRegistrationId = legalId;

  for (const pts of arr(party['PartyTaxScheme'])) {
    const schemeId = text(obj(pts['TaxScheme'])?.['ID'] as Node)?.toUpperCase();
    const companyId = text(pts['CompanyID'] as Node);
    if (!companyId) continue;
    if (schemeId === 'VAT') out.vatId = companyId;
    else out.taxRegistrationId = companyId;
  }

  if (postal) {
    out.address = {};
    const set = (key: keyof NonNullable<Party['address']>, v: string | undefined) => {
      if (v) (out.address as Record<string, string>)[key] = v;
    };
    set('streetName', text(postal['StreetName'] as Node));
    set('additionalStreet', text(postal['AdditionalStreetName'] as Node));
    set('city', text(postal['CityName'] as Node));
    set('postCode', text(postal['PostalZone'] as Node));
    set('countrySubdivision', text(postal['CountrySubentity'] as Node));
    set('countryCode', text(obj(postal['Country'])?.['IdentificationCode'] as Node));
  }

  if (contact) {
    const name = text(contact['Name'] as Node);
    const phone = text(contact['Telephone'] as Node);
    const email = text(contact['ElectronicMail'] as Node);
    if (name || phone || email) {
      out.contact = {};
      if (name) out.contact.name = name;
      if (phone) out.contact.phone = phone;
      if (email) out.contact.email = email;
    }
  }

  return Object.keys(out).length ? out : undefined;
}

function parseAllowanceCharge(nodes: unknown): AllowanceCharge[] {
  return arr(nodes).map((ac) => {
    const taxCat = obj(ac['TaxCategory']);
    const out: AllowanceCharge = {
      isCharge: text(ac['ChargeIndicator'] as Node) === 'true',
      amount: num(ac['Amount'] as Node) ?? 0,
    };
    const base = num(ac['BaseAmount'] as Node);
    if (base !== undefined) out.baseAmount = base;
    const pct = num(ac['MultiplierFactorNumeric'] as Node);
    if (pct !== undefined) out.percentage = pct;
    const reason = text(ac['AllowanceChargeReason'] as Node);
    if (reason) out.reason = reason;
    const reasonCode = text(ac['AllowanceChargeReasonCode'] as Node);
    if (reasonCode) out.reasonCode = reasonCode;
    const cat = text(taxCat?.['ID'] as Node);
    if (cat) out.vatCategoryCode = cat;
    const rate = num(taxCat?.['Percent'] as Node);
    if (rate !== undefined) out.vatRate = rate;
    return out;
  });
}

function parseLines(nodes: unknown): InvoiceLine[] {
  return arr(nodes).map((ln) => {
    const item = obj(ln['Item']);
    const price = obj(ln['Price']);
    const taxCat = obj(item?.['ClassifiedTaxCategory']);
    const line: InvoiceLine = {};
    const id = text(ln['ID'] as Node);
    if (id) line.id = id;
    const note = text(ln['Note'] as Node);
    if (note) line.note = note;
    const qty = num(ln['InvoicedQuantity'] as Node);
    if (qty !== undefined) line.quantity = qty;
    const unit = attr(ln['InvoicedQuantity'] as Node, 'unitCode');
    if (unit) line.unitCode = unit;
    const net = num(ln['LineExtensionAmount'] as Node);
    if (net !== undefined) line.netAmount = net;
    const olr = text(obj(ln['OrderLineReference'])?.['LineID'] as Node);
    if (olr) line.orderLineReference = olr;

    if (item) {
      line.item = {};
      const name = text(item['Name'] as Node);
      if (name) line.item.name = name;
      const desc = text(item['Description'] as Node);
      if (desc) line.item.description = desc;
      const sellerId = text(obj(item['SellersItemIdentification'])?.['ID'] as Node);
      if (sellerId) line.item.sellerItemId = sellerId;
      const stdId = text(obj(item['StandardItemIdentification'])?.['ID'] as Node);
      if (stdId) line.item.standardItemId = stdId;
    }
    if (price) {
      line.price = {};
      const p = num(price['PriceAmount'] as Node);
      if (p !== undefined) line.price.netPrice = p;
      const bq = num(price['BaseQuantity'] as Node);
      if (bq !== undefined) line.price.baseQuantity = bq;
      const bqUnit = attr(price['BaseQuantity'] as Node, 'unitCode');
      if (bqUnit) line.price.baseQuantityUnit = bqUnit;
    }
    if (taxCat) {
      line.vat = {};
      const cc = text(taxCat['ID'] as Node);
      if (cc) line.vat.categoryCode = cc;
      const rate = num(taxCat['Percent'] as Node);
      if (rate !== undefined) line.vat.rate = rate;
    }
    return line;
  });
}

/**
 * Parse a UBL 2.1 Invoice document into the semantic model.
 * @throws InvoiceParseError when the XML is malformed or not a UBL Invoice.
 */
export function parseUblInvoice(xml: string): Invoice {
  if (typeof xml !== 'string' || !xml.trim()) {
    throw new InvoiceParseError('Empty document — expected UBL Invoice XML.');
  }
  const check = XMLValidator.validate(xml);
  if (check !== true) {
    throw new InvoiceParseError(`Malformed XML at line ${check.err.line}: ${check.err.msg}`);
  }
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch (e) {
    throw new InvoiceParseError('Could not parse XML document.', e);
  }
  const root = obj(doc['Invoice']);
  if (!root) {
    const found = Object.keys(doc).filter((k) => !k.startsWith('?'));
    if (found.includes('CrossIndustryInvoice')) {
      throw new InvoiceParseError(
        'This is a UN/CEFACT CII document (ZUGFeRD/Factur-X XML). Use validateXml() / parseCiiInvoice() — this entry point parses UBL only.',
      );
    }
    throw new InvoiceParseError(
      `Expected a UBL <Invoice> root element, found: ${found.join(', ') || 'nothing'}.`,
    );
  }

  const inv: Invoice = {};
  const setS = (key: keyof Invoice, v: string | undefined) => {
    if (v !== undefined) (inv as Record<string, unknown>)[key] = v;
  };
  setS('specificationIdentifier', text(root['CustomizationID'] as Node));
  setS('businessProcessType', text(root['ProfileID'] as Node));
  setS('number', text(root['ID'] as Node));
  setS('issueDate', text(root['IssueDate'] as Node));
  setS('dueDate', text(root['DueDate'] as Node));
  setS('typeCode', text(root['InvoiceTypeCode'] as Node));
  setS('currencyCode', text(root['DocumentCurrencyCode'] as Node));
  setS('vatAccountingCurrencyCode', text(root['TaxCurrencyCode'] as Node));
  setS('taxPointDate', text(root['TaxPointDate'] as Node));
  setS('buyerReference', text(root['BuyerReference'] as Node));

  const notes = (Array.isArray(root['Note']) ? (root['Note'] as unknown[]) : root['Note'] !== undefined ? [root['Note']] : [])
    .map((n) => text(n as Node))
    .filter((n): n is string => !!n);
  if (notes.length) inv.notes = notes;

  const orderRef = text(obj(root['OrderReference'])?.['ID'] as Node);
  if (orderRef) inv.purchaseOrderReference = orderRef;
  const contractRef = text(obj(root['ContractDocumentReference'])?.['ID'] as Node);
  if (contractRef) inv.contractReference = contractRef;
  const projectRef = text(obj(root['ProjectReference'])?.['ID'] as Node);
  if (projectRef) inv.projectReference = projectRef;

  const period = obj(root['InvoicePeriod']);
  if (period) {
    const startDate = text(period['StartDate'] as Node);
    const endDate = text(period['EndDate'] as Node);
    if (startDate || endDate) {
      inv.invoicePeriod = {};
      if (startDate) inv.invoicePeriod.startDate = startDate;
      if (endDate) inv.invoicePeriod.endDate = endDate;
    }
  }

  const preceding = arr(root['BillingReference'])
    .map((br) => obj(br['InvoiceDocumentReference']))
    .filter((r): r is Record<string, unknown> => !!r)
    .map((r) => {
      const ref: { number: string; issueDate?: string } = { number: text(r['ID'] as Node) ?? '' };
      const d = text(r['IssueDate'] as Node);
      if (d) ref.issueDate = d;
      return ref;
    })
    .filter((r) => r.number);
  if (preceding.length) inv.precedingInvoices = preceding;

  const seller = parseParty(root['AccountingSupplierParty']);
  if (seller) inv.seller = seller;
  const buyer = parseParty(root['AccountingCustomerParty']);
  if (buyer) inv.buyer = buyer;
  const payee = parseParty({ Party: obj(root['PayeeParty']) });
  if (payee) inv.payee = payee;

  // BG-13. Read as well as written, so parse → generate no longer drops the
  // delivery address of a document that had one.
  const deliveryNode = obj(arr(root['Delivery'])[0] ?? root['Delivery']);
  if (deliveryNode) {
    const delivery: Delivery = {};
    const actualDate = text(deliveryNode['ActualDeliveryDate'] as Node);
    if (actualDate) delivery.actualDate = actualDate;
    const location = obj(deliveryNode['DeliveryLocation']);
    if (location) {
      const locationId = location['ID'] as Node;
      if (text(locationId)) {
        delivery.locationId = text(locationId);
        const scheme = attr(locationId, 'schemeID');
        if (scheme) delivery.locationIdScheme = scheme;
      }
      const address = parseAddress(location['Address']);
      if (address) delivery.address = address;
    }
    const partyName = text(obj(obj(deliveryNode['DeliveryParty'])?.['PartyName'])?.['Name'] as Node);
    if (partyName) delivery.name = partyName;
    if (Object.keys(delivery).length) inv.delivery = delivery;
  }

  const paymentMeans = arr(root['PaymentMeans']);
  if (paymentMeans.length) {
    const first = paymentMeans[0]!;
    inv.payment = {};
    const code = text(first['PaymentMeansCode'] as Node);
    if (code) inv.payment.meansTypeCode = code;
    const meansName = attr(first['PaymentMeansCode'] as Node, 'name');
    if (meansName) inv.payment.meansText = meansName;
    const paymentId = text(first['PaymentID'] as Node);
    if (paymentId) inv.payment.remittanceInformation = paymentId;
    const transfers: CreditTransfer[] = [];
    for (const pm of paymentMeans) {
      const acct = obj(pm['PayeeFinancialAccount']);
      if (!acct) continue;
      const ct: CreditTransfer = {};
      const iban = text(acct['ID'] as Node);
      if (iban) ct.iban = iban;
      const acctName = text(acct['Name'] as Node);
      if (acctName) ct.accountName = acctName;
      const bic = text(obj(acct['FinancialInstitutionBranch'])?.['ID'] as Node);
      if (bic) ct.bic = bic;
      if (Object.keys(ct).length) transfers.push(ct);
    }
    if (transfers.length) inv.payment.creditTransfers = transfers;
    const mandate = obj(first['PaymentMandate']);
    if (mandate) {
      const mandateId = text(mandate['ID'] as Node);
      if (mandateId) inv.payment.mandateReference = mandateId;
      const debited = text(obj(mandate['PayerFinancialAccount'])?.['ID'] as Node);
      if (debited) inv.payment.debitedAccountIban = debited;
    }
  }

  const paymentTerms = arr(root['PaymentTerms'])
    .map((pt) => text(pt['Note'] as Node))
    .filter((n): n is string => !!n);
  if (paymentTerms.length) inv.paymentTerms = paymentTerms.join('\n');

  const allowancesCharges = parseAllowanceCharge(root['AllowanceCharge']);
  if (allowancesCharges.length) inv.allowancesCharges = allowancesCharges;

  // Pick the TaxTotal in document currency (there may be a second in the VAT accounting currency).
  const taxTotals = arr(root['TaxTotal']);
  const docCurrency = inv.currencyCode;
  const mainTaxTotal =
    taxTotals.find((tt) => attr(tt['TaxAmount'] as Node, 'currencyID') === docCurrency) ?? taxTotals[0];
  const breakdown: VatBreakdown[] = arr(mainTaxTotal?.['TaxSubtotal']).map((ts) => {
    const cat = obj(ts['TaxCategory']);
    const b: VatBreakdown = {
      categoryCode: text(cat?.['ID'] as Node) ?? '',
      taxableAmount: num(ts['TaxableAmount'] as Node) ?? 0,
      taxAmount: num(ts['TaxAmount'] as Node) ?? 0,
    };
    const rate = num(cat?.['Percent'] as Node);
    if (rate !== undefined) b.rate = rate;
    const reason = text(cat?.['TaxExemptionReason'] as Node);
    if (reason) b.exemptionReason = reason;
    const reasonCode = text(cat?.['TaxExemptionReasonCode'] as Node);
    if (reasonCode) b.exemptionReasonCode = reasonCode;
    return b;
  });
  if (breakdown.length) inv.vatBreakdown = breakdown;

  const lmt = obj(root['LegalMonetaryTotal']);
  if (lmt || mainTaxTotal) {
    inv.totals = {};
    const setN = (key: keyof NonNullable<Invoice['totals']>, v: number | undefined) => {
      if (v !== undefined) (inv.totals as Record<string, number>)[key] = v;
    };
    setN('sumOfLineNet', num(lmt?.['LineExtensionAmount'] as Node));
    setN('allowanceTotal', num(lmt?.['AllowanceTotalAmount'] as Node));
    setN('chargeTotal', num(lmt?.['ChargeTotalAmount'] as Node));
    setN('taxExclusive', num(lmt?.['TaxExclusiveAmount'] as Node));
    setN('taxInclusive', num(lmt?.['TaxInclusiveAmount'] as Node));
    setN('paidAmount', num(lmt?.['PrepaidAmount'] as Node));
    setN('roundingAmount', num(lmt?.['PayableRoundingAmount'] as Node));
    setN('amountDue', num(lmt?.['PayableAmount'] as Node));
    setN('taxTotal', num(mainTaxTotal?.['TaxAmount'] as Node));
  }

  const lines = parseLines(root['InvoiceLine']);
  if (lines.length) inv.lines = lines;

  return inv;
}
