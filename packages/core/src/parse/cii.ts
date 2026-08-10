/**
 * UN/CEFACT CrossIndustryInvoice (CII) → EN 16931 semantic model.
 *
 * This is the syntax used by ZUGFeRD / Factur-X hybrid PDFs and by the CII
 * flavour of XRechnung — i.e. most e-invoices German companies actually
 * RECEIVE. Namespace prefixes (rsm/ram/udt/qdt) are stripped during parsing;
 * CII element local names are unambiguous for our mapping. Values stay strings
 * in the parser and are converted deliberately.
 *
 * Business-term references (BT-x) follow EN 16931-3-3 (CII syntax binding).
 */
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type {
  AllowanceCharge,
  CreditTransfer,
  Invoice,
  InvoiceLine,
  Party,
  VatBreakdown,
} from '../model/invoice.js';
import { InvoiceParseError } from './ubl.js';

const ARRAY_PATHS = [
  'CrossIndustryInvoice.ExchangedDocument.IncludedNote',
  'CrossIndustryInvoice.SupplyChainTradeTransaction.IncludedSupplyChainTradeLineItem',
  'CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeSettlement.ApplicableTradeTax',
  'CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeSettlement.SpecifiedTradeAllowanceCharge',
  'CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeSettlement.SpecifiedTradeSettlementPaymentMeans',
  'CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeSettlement.InvoiceReferencedDocument',
  'CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeSettlement.SpecifiedTradePaymentTerms',
  'CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeAgreement.SellerTradeParty.SpecifiedTaxRegistration',
  'CrossIndustryInvoice.SupplyChainTradeTransaction.ApplicableHeaderTradeAgreement.BuyerTradeParty.SpecifiedTaxRegistration',
];
const ARRAY_PATH_SET = new Set(ARRAY_PATHS);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (_name, jpath) => ARRAY_PATH_SET.has(String(jpath)),
});

type Node = Record<string, unknown> | string | undefined;

function text(node: Node): string | undefined {
  if (node === undefined || node === null) return undefined;
  if (typeof node === 'string') return node.length ? node : undefined;
  if (typeof node === 'object' && '#text' in node) {
    const t = (node as Record<string, unknown>)['#text'];
    if (typeof t === 'string' && t.length) return t;
    if (typeof t === 'number') return String(t);
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

// See parse/ubl.ts: reject non-decimal forms (hex, exponent, Infinity) that
// Number() would otherwise silently accept but the XSD decimal type forbids.
const DECIMAL_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;
function num(node: Node): number | undefined {
  const t = text(node);
  if (t === undefined) return undefined;
  if (!DECIMAL_RE.test(t.trim())) return undefined;
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

/**
 * CII dates are udt:DateTimeString with @format="102" → YYYYMMDD.
 * Convert to ISO YYYY-MM-DD; pass through anything already ISO-shaped.
 */
function ciiDate(node: unknown): string | undefined {
  const container = obj(node);
  const ds = (container?.['DateTimeString'] ?? container?.['DateString'] ?? node) as Node;
  const raw = text(ds);
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return raw; // let validation flag the malformed value
}

function parseTradeParty(node: unknown, role: 'seller' | 'buyer' | 'payee'): Party | undefined {
  const party = obj(node);
  if (!party) return undefined;
  const out: Party = {};

  const name = text(party['Name'] as Node);
  if (name) out.name = name;
  const legal = obj(party['SpecifiedLegalOrganization']);
  const legalId = text(legal?.['ID'] as Node);
  if (legalId) out.legalRegistrationId = legalId;
  const tradingName = text(legal?.['TradingBusinessName'] as Node);
  if (tradingName && tradingName !== name) out.tradingName = tradingName;
  const identifier = text(party['ID'] as Node);
  if (identifier) out.identifier = identifier;

  // BT-31 (schemeID VA) / BT-32 (schemeID FC)
  for (const reg of arr(party['SpecifiedTaxRegistration'])) {
    const id = reg['ID'] as Node;
    const value = text(id);
    if (!value) continue;
    const scheme = attr(id, 'schemeID')?.toUpperCase();
    if (scheme === 'FC') out.taxRegistrationId = value;
    else out.vatId = value; // VA is the default scheme in the wild
  }

  const uri = obj(party['URIUniversalCommunication'])?.['URIID'] as Node;
  const electronic = text(uri);
  if (electronic) {
    out.electronicAddress = electronic;
    const scheme = attr(uri, 'schemeID');
    if (scheme) out.electronicAddressScheme = scheme;
  }

  const address = obj(party['PostalTradeAddress']);
  if (address) {
    out.address = {};
    const set = (key: keyof NonNullable<Party['address']>, v: string | undefined) => {
      if (v) (out.address as Record<string, string>)[key] = v;
    };
    set('postCode', text(address['PostcodeCode'] as Node));
    set('streetName', text(address['LineOne'] as Node));
    set('additionalStreet', text(address['LineTwo'] as Node));
    set('city', text(address['CityName'] as Node));
    set('countryCode', text(address['CountryID'] as Node));
    set('countrySubdivision', text(address['CountrySubDivisionName'] as Node));
  }

  const contact = obj(party['DefinedTradeContact']);
  if (contact) {
    const contactName =
      text(contact['PersonName'] as Node) ?? text(contact['DepartmentName'] as Node);
    const phone = text(obj(contact['TelephoneUniversalCommunication'])?.['CompleteNumber'] as Node);
    const email = text(obj(contact['EmailURIUniversalCommunication'])?.['URIID'] as Node);
    if (contactName || phone || email) {
      out.contact = {};
      if (contactName) out.contact.name = contactName;
      if (phone) out.contact.phone = phone;
      if (email) out.contact.email = email;
    }
  }

  void role;
  return Object.keys(out).length ? out : undefined;
}

function parseLines(nodes: unknown): InvoiceLine[] {
  return arr(nodes).map((item) => {
    const line: InvoiceLine = {};
    const doc = obj(item['AssociatedDocumentLineDocument']);
    const id = text(doc?.['LineID'] as Node);
    if (id) line.id = id;
    const note = text(obj(doc?.['IncludedNote'])?.['Content'] as Node);
    if (note) line.note = note;

    const product = obj(item['SpecifiedTradeProduct']);
    if (product) {
      line.item = {};
      const name = text(product['Name'] as Node);
      if (name) line.item.name = name;
      const description = text(product['Description'] as Node);
      if (description) line.item.description = description;
      const sellerId = text(product['SellerAssignedID'] as Node);
      if (sellerId) line.item.sellerItemId = sellerId;
      const globalId = text(product['GlobalID'] as Node);
      if (globalId) line.item.standardItemId = globalId;
    }

    const agreement = obj(item['SpecifiedLineTradeAgreement']);
    const netPrice = obj(agreement?.['NetPriceProductTradePrice']);
    if (netPrice) {
      line.price = {};
      const amount = num(netPrice['ChargeAmount'] as Node);
      if (amount !== undefined) line.price.netPrice = amount;
      const basis = netPrice['BasisQuantity'] as Node;
      const basisQty = num(basis);
      if (basisQty !== undefined) line.price.baseQuantity = basisQty;
      const basisUnit = attr(basis, 'unitCode');
      if (basisUnit) line.price.baseQuantityUnit = basisUnit;
    }

    const delivery = obj(item['SpecifiedLineTradeDelivery']);
    const qty = delivery?.['BilledQuantity'] as Node;
    const quantity = num(qty);
    if (quantity !== undefined) line.quantity = quantity;
    const unit = attr(qty, 'unitCode');
    if (unit) line.unitCode = unit;

    const settlement = obj(item['SpecifiedLineTradeSettlement']);
    const tax = obj(settlement?.['ApplicableTradeTax']);
    if (tax) {
      line.vat = {};
      const category = text(tax['CategoryCode'] as Node);
      if (category) line.vat.categoryCode = category;
      const rate = num(tax['RateApplicablePercent'] as Node);
      if (rate !== undefined) line.vat.rate = rate;
    }
    const lineTotal = num(
      obj(settlement?.['SpecifiedTradeSettlementLineMonetarySummation'])?.['LineTotalAmount'] as Node,
    );
    if (lineTotal !== undefined) line.netAmount = lineTotal;

    return line;
  });
}

function parseAllowances(nodes: unknown): AllowanceCharge[] {
  return arr(nodes).map((ac) => {
    const indicator = text(obj(ac['ChargeIndicator'])?.['Indicator'] as Node);
    const tax = obj(ac['CategoryTradeTax']);
    const out: AllowanceCharge = {
      isCharge: indicator === 'true',
      amount: num(ac['ActualAmount'] as Node) ?? 0,
    };
    const base = num(ac['BasisAmount'] as Node);
    if (base !== undefined) out.baseAmount = base;
    const pct = num(ac['CalculationPercent'] as Node);
    if (pct !== undefined) out.percentage = pct;
    const reason = text(ac['Reason'] as Node);
    if (reason) out.reason = reason;
    const reasonCode = text(ac['ReasonCode'] as Node);
    if (reasonCode) out.reasonCode = reasonCode;
    const category = text(tax?.['CategoryCode'] as Node);
    if (category) out.vatCategoryCode = category;
    const rate = num(tax?.['RateApplicablePercent'] as Node);
    if (rate !== undefined) out.vatRate = rate;
    return out;
  });
}

/**
 * Parse a CrossIndustryInvoice document into the semantic model.
 * @throws InvoiceParseError when the XML is malformed or not a CII invoice.
 */
export function parseCiiInvoice(xml: string): Invoice {
  if (typeof xml !== 'string' || !xml.trim()) {
    throw new InvoiceParseError('Empty document — expected CrossIndustryInvoice XML.');
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
  const root = obj(doc['CrossIndustryInvoice']);
  if (!root) {
    const found = Object.keys(doc).filter((k) => !k.startsWith('?'));
    throw new InvoiceParseError(
      `Expected a <CrossIndustryInvoice> root element, found: ${found.join(', ') || 'nothing'}.`,
    );
  }

  const inv: Invoice = {};

  const context = obj(root['ExchangedDocumentContext']);
  const spec = text(obj(context?.['GuidelineSpecifiedDocumentContextParameter'])?.['ID'] as Node);
  if (spec) inv.specificationIdentifier = spec;
  const process = text(
    obj(context?.['BusinessProcessSpecifiedDocumentContextParameter'])?.['ID'] as Node,
  );
  if (process) inv.businessProcessType = process;

  const document = obj(root['ExchangedDocument']);
  const number = text(document?.['ID'] as Node);
  if (number) inv.number = number;
  const typeCode = text(document?.['TypeCode'] as Node);
  if (typeCode) inv.typeCode = typeCode;
  const issueDate = ciiDate(document?.['IssueDateTime']);
  if (issueDate) inv.issueDate = issueDate;
  const notes = arr(document?.['IncludedNote'])
    .map((n) => text(n['Content'] as Node))
    .filter((n): n is string => !!n);
  if (notes.length) inv.notes = notes;

  const transaction = obj(root['SupplyChainTradeTransaction']);
  if (!transaction) return inv;

  // ——— Agreement: parties + references ———
  const agreement = obj(transaction['ApplicableHeaderTradeAgreement']);
  const buyerReference = text(agreement?.['BuyerReference'] as Node);
  if (buyerReference) inv.buyerReference = buyerReference;
  const seller = parseTradeParty(agreement?.['SellerTradeParty'], 'seller');
  if (seller) inv.seller = seller;
  const buyer = parseTradeParty(agreement?.['BuyerTradeParty'], 'buyer');
  if (buyer) inv.buyer = buyer;
  const order = text(obj(agreement?.['BuyerOrderReferencedDocument'])?.['IssuerAssignedID'] as Node);
  if (order) inv.purchaseOrderReference = order;
  const contract = text(obj(agreement?.['ContractReferencedDocument'])?.['IssuerAssignedID'] as Node);
  if (contract) inv.contractReference = contract;

  // ——— Settlement: currency, VAT, payment, totals ———
  const settlement = obj(transaction['ApplicableHeaderTradeSettlement']);
  const currency = text(settlement?.['InvoiceCurrencyCode'] as Node);
  if (currency) inv.currencyCode = currency;
  const taxCurrency = text(settlement?.['TaxCurrencyCode'] as Node);
  if (taxCurrency && taxCurrency !== currency) inv.vatAccountingCurrencyCode = taxCurrency;

  const payee = parseTradeParty(settlement?.['PayeeTradeParty'], 'payee');
  if (payee) inv.payee = payee;

  const paymentMeans = arr(settlement?.['SpecifiedTradeSettlementPaymentMeans']);
  if (paymentMeans.length) {
    const first = paymentMeans[0]!;
    inv.payment = {};
    const means = text(first['TypeCode'] as Node);
    if (means) inv.payment.meansTypeCode = means;
    const info = text(first['Information'] as Node);
    if (info) inv.payment.meansText = info;
    const paymentRef = text(settlement?.['PaymentReference'] as Node);
    if (paymentRef) inv.payment.remittanceInformation = paymentRef;
    const transfers: CreditTransfer[] = [];
    for (const pm of paymentMeans) {
      const account = obj(pm['PayeePartyCreditorFinancialAccount']);
      if (!account) continue;
      const ct: CreditTransfer = {};
      const iban = text(account['IBANID'] as Node);
      if (iban) ct.iban = iban;
      const accountName = text(account['AccountName'] as Node);
      if (accountName) ct.accountName = accountName;
      const bic = text(
        obj(pm['PayeeSpecifiedCreditorFinancialInstitution'])?.['BICID'] as Node,
      );
      if (bic) ct.bic = bic;
      if (Object.keys(ct).length) transfers.push(ct);
    }
    if (transfers.length) inv.payment.creditTransfers = transfers;
    const debited = text(
      obj(paymentMeans[0]!['PayerPartyDebtorFinancialAccount'])?.['IBANID'] as Node,
    );
    if (debited) inv.payment.debitedAccountIban = debited;
  }

  const terms = arr(settlement?.['SpecifiedTradePaymentTerms']);
  if (terms.length) {
    const description = terms
      .map((t) => text(t['Description'] as Node))
      .filter((d): d is string => !!d);
    if (description.length) inv.paymentTerms = description.join('\n');
    const due = terms.map((t) => ciiDate(t['DueDateDateTime'])).find((d) => d);
    if (due) inv.dueDate = due;
    const mandate = terms.map((t) => text(t['DirectDebitMandateID'] as Node)).find((m) => m);
    if (mandate) {
      inv.payment = inv.payment ?? {};
      inv.payment.mandateReference = mandate;
    }
  }

  const period = obj(settlement?.['BillingSpecifiedPeriod']);
  if (period) {
    const startDate = ciiDate(period['StartDateTime']);
    const endDate = ciiDate(period['EndDateTime']);
    if (startDate || endDate) {
      inv.invoicePeriod = {};
      if (startDate) inv.invoicePeriod.startDate = startDate;
      if (endDate) inv.invoicePeriod.endDate = endDate;
    }
  }

  const breakdown: VatBreakdown[] = arr(settlement?.['ApplicableTradeTax']).map((tax) => {
    const b: VatBreakdown = {
      categoryCode: text(tax['CategoryCode'] as Node) ?? '',
      taxableAmount: num(tax['BasisAmount'] as Node) ?? 0,
      taxAmount: num(tax['CalculatedAmount'] as Node) ?? 0,
    };
    const rate = num(tax['RateApplicablePercent'] as Node);
    if (rate !== undefined) b.rate = rate;
    const reason = text(tax['ExemptionReason'] as Node);
    if (reason) b.exemptionReason = reason;
    const reasonCode = text(tax['ExemptionReasonCode'] as Node);
    if (reasonCode) b.exemptionReasonCode = reasonCode;
    return b;
  });
  if (breakdown.length) inv.vatBreakdown = breakdown;

  const allowances = parseAllowances(settlement?.['SpecifiedTradeAllowanceCharge']);
  if (allowances.length) inv.allowancesCharges = allowances;

  const preceding = arr(settlement?.['InvoiceReferencedDocument'])
    .map((r) => {
      const ref: { number: string; issueDate?: string } = {
        number: text(r['IssuerAssignedID'] as Node) ?? '',
      };
      const d = ciiDate(r['FormattedIssueDateTime']);
      if (d) ref.issueDate = d;
      return ref;
    })
    .filter((r) => r.number);
  if (preceding.length) inv.precedingInvoices = preceding;

  const totals = obj(settlement?.['SpecifiedTradeSettlementHeaderMonetarySummation']);
  if (totals) {
    inv.totals = {};
    const setN = (key: keyof NonNullable<Invoice['totals']>, v: number | undefined) => {
      if (v !== undefined) (inv.totals as Record<string, number>)[key] = v;
    };
    setN('sumOfLineNet', num(totals['LineTotalAmount'] as Node));
    setN('allowanceTotal', num(totals['AllowanceTotalAmount'] as Node));
    setN('chargeTotal', num(totals['ChargeTotalAmount'] as Node));
    setN('taxExclusive', num(totals['TaxBasisTotalAmount'] as Node));
    setN('taxInclusive', num(totals['GrandTotalAmount'] as Node));
    setN('paidAmount', num(totals['TotalPrepaidAmount'] as Node));
    setN('roundingAmount', num(totals['RoundingAmount'] as Node));
    setN('amountDue', num(totals['DuePayableAmount'] as Node));
    // BT-110: TaxTotalAmount may appear twice (document + accounting currency).
    const taxTotals = (Array.isArray(totals['TaxTotalAmount'])
      ? (totals['TaxTotalAmount'] as unknown[])
      : totals['TaxTotalAmount'] !== undefined
        ? [totals['TaxTotalAmount']]
        : []) as Node[];
    const inDocCurrency =
      taxTotals.find((t) => attr(t, 'currencyID') === currency) ?? taxTotals[0];
    setN('taxTotal', num(inDocCurrency));
  }

  const lines = parseLines(transaction['IncludedSupplyChainTradeLineItem']);
  if (lines.length) inv.lines = lines;

  return inv;
}
