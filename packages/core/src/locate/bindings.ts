/**
 * Semantic model path → XML location.
 *
 * A violation points into the semantic model (`lines[2].quantity`), but a CI
 * annotation needs a line in the file the developer actually wrote. These
 * tables are the bridge, and they are derived from the parsers themselves
 * (`parse/ubl.ts`, `parse/cii.ts`) rather than from the specification — so a
 * binding is correct precisely when it names the element the parser read the
 * value from. When a parser changes, its binding must change with it, which is
 * what `tests/bindings.test.ts` checks.
 *
 * Array indices in semantic paths are 0-based JavaScript indices; XPath
 * positions are 1-based, and the `{n}` placeholders are substituted with that
 * conversion applied.
 */
import type { Syntax } from '../validate/index.js';
import {
  childNamed,
  childrenNamed,
  descend,
  locationOfAttribute,
  locationOfNode,
  resolveXmlPath,
  selectXmlNode,
  type ResolvedLocation,
  type XmlDocumentIndex,
  type XmlNode,
} from './xml-index.js';

/**
 * Resolves one semantic path against a document. Most bindings are plain path
 * templates; a function is used only where the choice of element depends on
 * document *content* — which tax scheme is the VAT one, which tax total is in
 * the document currency — that a path cannot express.
 */
type Resolver = (index: XmlDocumentIndex, indices: readonly number[]) => ResolvedLocation | undefined;

type Binding = string | Resolver;

// ————————————————————————————————————————————————————————————————
// Helpers shared by the content-dependent bindings
// ————————————————————————————————————————————————————————————————

/** Walk a chain of child names, degrading to the deepest element that exists. */
function descendLocation(
  from: XmlNode,
  fromPath: string,
  names: readonly string[],
  attribute?: string,
): ResolvedLocation {
  let current = from;
  let path = fromPath;
  for (const name of names) {
    const child = childNamed(current, name);
    if (child === undefined) return locationOfNode(current, 'ancestor', path);
    current = child;
    path += `/${name}`;
  }
  return attribute === undefined
    ? locationOfNode(current, 'exact', path)
    : locationOfAttribute(current, attribute, path);
}

/** The element at `path`, or undefined when not even an ancestor matched. */
function at(index: XmlDocumentIndex, path: string): { node: XmlNode; path: string; exact: boolean } | undefined {
  const selected = selectXmlNode(index, path);
  if (selected === undefined) return undefined;
  return { node: selected.node, path: selected.resolvedPath, exact: selected.match === 'exact' };
}

/**
 * Text of an element, treating empty as absent — the same rule the parsers'
 * `text()` helper applies. The bindings must agree with the parsers about what
 * counts as "present" or they will select a different element.
 */
function textOf(node: XmlNode | undefined): string | undefined {
  const value = node?.value;
  return value === undefined || value.length === 0 ? undefined : value;
}

/** Attribute value, empty treated as absent — mirrors the parsers' `attr()`. */
function attrOf(node: XmlNode | undefined, name: string): string | undefined {
  const value = node?.attributes.get(name)?.value;
  return value === undefined || value.length === 0 ? undefined : value;
}

/**
 * The `TaxTotal` (UBL) carrying amounts in the document currency. A document
 * may state a second one in the VAT accounting currency; `parse/ubl.ts` picks
 * by matching `@currencyID`, so the binding must pick the same one or the
 * annotation lands on the wrong total.
 */
function ublMainTaxTotal(index: XmlDocumentIndex): { node: XmlNode; path: string } | undefined {
  const root = index.root;
  if (root === undefined) return undefined;
  const currency = textOf(childNamed(root, 'DocumentCurrencyCode'));
  const totals = childrenNamed(root, 'TaxTotal');
  if (totals.length === 0) return undefined;
  // Mirrors `find(...) ?? taxTotals[0]` in parse/ubl.ts exactly — including the
  // case where the document has no currency code, where the parser matches the
  // first TaxTotal whose TaxAmount carries no @currencyID. Treating that as
  // "just take the first" would point at a different total, and it would do so
  // precisely on documents that are already failing BR-05.
  const found = totals.findIndex((t) => attrOf(childNamed(t, 'TaxAmount'), 'currencyID') === currency);
  const pick = found >= 0 ? found : 0;
  return { node: totals[pick]!, path: `/Invoice/TaxTotal[${pick + 1}]` };
}

/**
 * Select the group the parser's *last* write came from.
 *
 * Both parsers loop over a repeatable group and assign into the same field, so
 * a later entry silently overwrites an earlier one — the value the rule
 * complains about is the last match, not the first. Entries the parser skips
 * (`if (!companyId) continue`) must be skipped here too, or the annotation
 * lands on an element whose value was never read.
 */
function lastMatching(
  base: string,
  groupName: string,
  wanted: (group: XmlNode) => boolean,
  leaf: readonly string[],
): Resolver {
  return (index) => {
    const container = at(index, base);
    if (container === undefined) return undefined;
    if (!container.exact) return locationOfNode(container.node, 'ancestor', container.path);
    const groups = childrenNamed(container.node, groupName);
    let chosen = -1;
    for (let i = 0; i < groups.length; i++) {
      if (wanted(groups[i]!)) chosen = i;
    }
    if (chosen < 0) return locationOfNode(container.node, 'ancestor', container.path);
    return descendLocation(groups[chosen]!, `${container.path}/${groupName}[${chosen + 1}]`, leaf);
  };
}

/** UBL: the `PartyTaxScheme` whose `TaxScheme/ID` is (or is not) `VAT`. */
function ublTaxScheme(base: string, want: 'VAT' | 'OTHER', leaf: readonly string[]): Resolver {
  return lastMatching(base, 'PartyTaxScheme', (scheme) => {
    // parse/ubl.ts skips a scheme with no CompanyID, then routes the value to
    // vatId when TaxScheme/ID is "VAT" and to taxRegistrationId otherwise.
    if (textOf(childNamed(scheme, 'CompanyID')) === undefined) return false;
    const isVat = (textOf(descend(scheme, 'TaxScheme', 'ID')) ?? '').toUpperCase() === 'VAT';
    return want === 'VAT' ? isVat : !isVat;
  }, leaf);
}

/** CII: the `SpecifiedTaxRegistration` whose `ID/@schemeID` is (or is not) `FC`. */
function ciiTaxRegistration(base: string, want: 'VAT' | 'OTHER'): Resolver {
  return lastMatching(base, 'SpecifiedTaxRegistration', (reg) => {
    // parse/cii.ts skips an empty ID, treats FC as the tax registration and
    // anything else — including a missing schemeID — as the VAT identifier.
    const id = childNamed(reg, 'ID');
    if (textOf(id) === undefined) return false;
    const isFc = (attrOf(id, 'schemeID') ?? '').toUpperCase() === 'FC';
    return want === 'VAT' ? !isFc : isFc;
  }, ['ID']);
}

/**
 * Select the n-th group the parser *kept*.
 *
 * Semantic array indices count only the entries a parser accepted, so they do
 * not line up with document position whenever the parser filters — credit
 * transfers without an account, preceding invoices without a number. Applying
 * the same filter here is the difference between annotating the right element
 * and annotating its neighbour.
 */
function nthMatching(
  containerPath: string,
  groupName: string,
  kept: (group: XmlNode) => boolean,
  leaf: readonly string[],
): Resolver {
  return (index, indices) => {
    const container = at(index, containerPath);
    if (container === undefined) return undefined;
    if (!container.exact) return locationOfNode(container.node, 'ancestor', container.path);
    const surviving: { node: XmlNode; position: number }[] = [];
    childrenNamed(container.node, groupName).forEach((node, i) => {
      if (kept(node)) surviving.push({ node, position: i + 1 });
    });
    const wanted = surviving[indices[0] ?? 0];
    if (wanted === undefined) return locationOfNode(container.node, 'ancestor', container.path);
    return descendLocation(wanted.node, `${container.path}/${groupName}[${wanted.position}]`, leaf);
  };
}

/** True when any of the child chains resolves to non-empty text. */
function anyText(node: XmlNode, chains: readonly (readonly string[])[]): boolean {
  return chains.some((chain) => textOf(descend(node, ...chain)) !== undefined);
}

/**
 * A payment-means entry becomes a credit transfer only when it has an account
 * *and* that account yields at least one field — both parsers drop the rest.
 */
function creditTransfer(
  containerPath: string,
  meansName: string,
  accountName: string,
  fieldChains: readonly (readonly string[])[],
  leaf: readonly string[],
): Resolver {
  return nthMatching(
    containerPath,
    meansName,
    (means) => childNamed(means, accountName) !== undefined && anyText(means, fieldChains),
    leaf,
  );
}

/**
 * Try several child chains under one base, in order, and take the first that
 * exists. Used where a single business term has more than one legal element
 * form — CII carries a contact name as either `PersonName` or
 * `DepartmentName`, and 2 of the 41 CII documents in the official corpus use
 * `DepartmentName` with no `PersonName` at all.
 */
function firstOf(base: string, chains: readonly (readonly string[])[]): Resolver {
  return (index) => {
    const container = at(index, base);
    if (container === undefined) return undefined;
    if (!container.exact) return locationOfNode(container.node, 'ancestor', container.path);
    for (const chain of chains) {
      const hit = descendLocation(container.node, container.path, chain);
      if (hit.match === 'exact') return hit;
    }
    return locationOfNode(container.node, 'ancestor', container.path);
  };
}

/** CII: the `TaxTotalAmount` stated in the document currency. */
const ciiTaxTotal: Resolver = (index) => {
  const settle = at(index, CII_SETTLE);
  if (settle === undefined) return undefined;
  const currency = textOf(childNamed(settle.node, 'InvoiceCurrencyCode'));
  const sum = at(index, CII_SUM);
  if (sum === undefined || !sum.exact) {
    return settle.exact ? locationOfNode(settle.node, 'ancestor', settle.path) : undefined;
  }
  const amounts = childrenNamed(sum.node, 'TaxTotalAmount');
  if (amounts.length === 0) return locationOfNode(sum.node, 'ancestor', sum.path);
  // Mirrors `find(...) ?? taxTotals[0]` in parse/cii.ts, undefined currency included.
  const found = amounts.findIndex((a) => attrOf(a, 'currencyID') === currency);
  const pick = found >= 0 ? found : 0;
  return locationOfNode(amounts[pick]!, 'exact', `${sum.path}/TaxTotalAmount[${pick + 1}]`);
};

// ————————————————————————————————————————————————————————————————
// UBL 2.1
// ————————————————————————————————————————————————————————————————

/** The chains parse/ubl.ts reads a credit transfer from; any one makes it count. */
function ublCreditTransfer(leaf: readonly string[]): Resolver {
  return creditTransfer(
    '/Invoice',
    'PaymentMeans',
    'PayeeFinancialAccount',
    [
      ['PayeeFinancialAccount', 'ID'],
      ['PayeeFinancialAccount', 'Name'],
      ['PayeeFinancialAccount', 'FinancialInstitutionBranch', 'ID'],
    ],
    leaf,
  );
}

/** As above for parse/cii.ts — note the BIC hangs off the payment means, not the account. */
function ciiCreditTransfer(leaf: readonly string[]): Resolver {
  return creditTransfer(
    CII_SETTLE,
    'SpecifiedTradeSettlementPaymentMeans',
    'PayeePartyCreditorFinancialAccount',
    [
      ['PayeePartyCreditorFinancialAccount', 'IBANID'],
      ['PayeePartyCreditorFinancialAccount', 'AccountName'],
      ['PayeeSpecifiedCreditorFinancialInstitution', 'BICID'],
    ],
    leaf,
  );
}

/** BillingReference entries that survive parse/ubl.ts's `.filter(r => r.number)`. */
function ublPrecedingInvoice(leaf: readonly string[]): Resolver {
  return nthMatching(
    '/Invoice',
    'BillingReference',
    (ref) => textOf(descend(ref, 'InvoiceDocumentReference', 'ID')) !== undefined,
    leaf,
  );
}

/** InvoiceReferencedDocument entries that survive parse/cii.ts's `.filter(r => r.number)`. */
function ciiPrecedingInvoice(leaf: readonly string[]): Resolver {
  return nthMatching(
    CII_SETTLE,
    'InvoiceReferencedDocument',
    (ref) => textOf(childNamed(ref, 'IssuerAssignedID')) !== undefined,
    leaf,
  );
}

const UBL_SELLER = '/Invoice/AccountingSupplierParty/Party';
const UBL_BUYER = '/Invoice/AccountingCustomerParty/Party';
const UBL_PAYEE = '/Invoice/PayeeParty';

function ublParty(prefix: string, base: string): Record<string, Binding> {
  return {
    [prefix]: base,
    [`${prefix}.name`]: `${base}/PartyLegalEntity/RegistrationName`,
    [`${prefix}.tradingName`]: `${base}/PartyName/Name`,
    [`${prefix}.identifier`]: `${base}/PartyIdentification/ID`,
    [`${prefix}.legalRegistrationId`]: `${base}/PartyLegalEntity/CompanyID`,
    [`${prefix}.vatId`]: ublTaxScheme(base, 'VAT', ['CompanyID']),
    [`${prefix}.taxRegistrationId`]: ublTaxScheme(base, 'OTHER', ['CompanyID']),
    [`${prefix}.electronicAddress`]: `${base}/EndpointID`,
    [`${prefix}.electronicAddressScheme`]: `${base}/EndpointID/@schemeID`,
    [`${prefix}.address`]: `${base}/PostalAddress`,
    [`${prefix}.address.streetName`]: `${base}/PostalAddress/StreetName`,
    [`${prefix}.address.additionalStreet`]: `${base}/PostalAddress/AdditionalStreetName`,
    [`${prefix}.address.city`]: `${base}/PostalAddress/CityName`,
    [`${prefix}.address.postCode`]: `${base}/PostalAddress/PostalZone`,
    [`${prefix}.address.countrySubdivision`]: `${base}/PostalAddress/CountrySubentity`,
    [`${prefix}.address.countryCode`]: `${base}/PostalAddress/Country/IdentificationCode`,
    [`${prefix}.contact`]: `${base}/Contact`,
    [`${prefix}.contact.name`]: `${base}/Contact/Name`,
    [`${prefix}.contact.phone`]: `${base}/Contact/Telephone`,
    [`${prefix}.contact.email`]: `${base}/Contact/ElectronicMail`,
  };
}

/** vatBreakdown[n] lives under whichever TaxTotal is in the document currency. */
function ublVatBreakdown(leaf: readonly string[]): Resolver {
  return (index, indices) => {
    const main = ublMainTaxTotal(index);
    if (main === undefined) {
      const root = index.root;
      return root === undefined ? undefined : locationOfNode(root, 'ancestor', '/Invoice');
    }
    const subtotals = childrenNamed(main.node, 'TaxSubtotal');
    const wanted = subtotals[indices[0] ?? 0];
    if (wanted === undefined) return locationOfNode(main.node, 'ancestor', main.path);
    return descendLocation(wanted, `${main.path}/TaxSubtotal[${(indices[0] ?? 0) + 1}]`, leaf);
  };
}

const UBL_BINDINGS: Record<string, Binding> = {
  specificationIdentifier: '/Invoice/CustomizationID',
  businessProcessType: '/Invoice/ProfileID',
  number: '/Invoice/ID',
  issueDate: '/Invoice/IssueDate',
  dueDate: '/Invoice/DueDate',
  typeCode: '/Invoice/InvoiceTypeCode',
  currencyCode: '/Invoice/DocumentCurrencyCode',
  vatAccountingCurrencyCode: '/Invoice/TaxCurrencyCode',
  taxPointDate: '/Invoice/TaxPointDate',
  buyerReference: '/Invoice/BuyerReference',
  purchaseOrderReference: '/Invoice/OrderReference/ID',
  contractReference: '/Invoice/ContractDocumentReference/ID',
  projectReference: '/Invoice/ProjectReference/ID',
  paymentTerms: '/Invoice/PaymentTerms/Note',
  notes: '/Invoice/Note',
  'notes[]': '/Invoice/Note[{0}]',

  invoicePeriod: '/Invoice/InvoicePeriod',
  'invoicePeriod.startDate': '/Invoice/InvoicePeriod/StartDate',
  'invoicePeriod.endDate': '/Invoice/InvoicePeriod/EndDate',

  // parse/ubl.ts drops references with no ID, so document position and
  // semantic index diverge as soon as one is malformed.
  'precedingInvoices[]': ublPrecedingInvoice(['InvoiceDocumentReference']),
  'precedingInvoices[].number': ublPrecedingInvoice(['InvoiceDocumentReference', 'ID']),
  'precedingInvoices[].issueDate': ublPrecedingInvoice(['InvoiceDocumentReference', 'IssueDate']),

  ...ublParty('seller', UBL_SELLER),
  ...ublParty('buyer', UBL_BUYER),
  ...ublParty('payee', UBL_PAYEE),

  payment: '/Invoice/PaymentMeans',
  'payment.meansTypeCode': '/Invoice/PaymentMeans/PaymentMeansCode',
  'payment.meansText': '/Invoice/PaymentMeans/PaymentMeansCode/@name',
  'payment.remittanceInformation': '/Invoice/PaymentMeans/PaymentID',
  'payment.mandateReference': '/Invoice/PaymentMeans/PaymentMandate/ID',
  'payment.debitedAccountIban': '/Invoice/PaymentMeans/PaymentMandate/PayerFinancialAccount/ID',
  'payment.creditTransfers': '/Invoice/PaymentMeans/PayeeFinancialAccount',
  'payment.creditTransfers[]': ublCreditTransfer(['PayeeFinancialAccount']),
  'payment.creditTransfers[].iban': ublCreditTransfer(['PayeeFinancialAccount', 'ID']),
  'payment.creditTransfers[].accountName': ublCreditTransfer(['PayeeFinancialAccount', 'Name']),
  'payment.creditTransfers[].bic': ublCreditTransfer([
    'PayeeFinancialAccount',
    'FinancialInstitutionBranch',
    'ID',
  ]),

  'allowancesCharges[]': '/Invoice/AllowanceCharge[{0}]',
  'allowancesCharges[].isCharge': '/Invoice/AllowanceCharge[{0}]/ChargeIndicator',
  'allowancesCharges[].amount': '/Invoice/AllowanceCharge[{0}]/Amount',
  'allowancesCharges[].baseAmount': '/Invoice/AllowanceCharge[{0}]/BaseAmount',
  'allowancesCharges[].percentage': '/Invoice/AllowanceCharge[{0}]/MultiplierFactorNumeric',
  'allowancesCharges[].reason': '/Invoice/AllowanceCharge[{0}]/AllowanceChargeReason',
  'allowancesCharges[].reasonCode': '/Invoice/AllowanceCharge[{0}]/AllowanceChargeReasonCode',
  'allowancesCharges[].vatCategoryCode': '/Invoice/AllowanceCharge[{0}]/TaxCategory/ID',
  'allowancesCharges[].vatRate': '/Invoice/AllowanceCharge[{0}]/TaxCategory/Percent',

  'vatBreakdown[]': ublVatBreakdown([]),
  'vatBreakdown[].taxableAmount': ublVatBreakdown(['TaxableAmount']),
  'vatBreakdown[].taxAmount': ublVatBreakdown(['TaxAmount']),
  'vatBreakdown[].categoryCode': ublVatBreakdown(['TaxCategory', 'ID']),
  'vatBreakdown[].rate': ublVatBreakdown(['TaxCategory', 'Percent']),
  'vatBreakdown[].exemptionReason': ublVatBreakdown(['TaxCategory', 'TaxExemptionReason']),
  'vatBreakdown[].exemptionReasonCode': ublVatBreakdown(['TaxCategory', 'TaxExemptionReasonCode']),

  totals: '/Invoice/LegalMonetaryTotal',
  'totals.sumOfLineNet': '/Invoice/LegalMonetaryTotal/LineExtensionAmount',
  'totals.allowanceTotal': '/Invoice/LegalMonetaryTotal/AllowanceTotalAmount',
  'totals.chargeTotal': '/Invoice/LegalMonetaryTotal/ChargeTotalAmount',
  'totals.taxExclusive': '/Invoice/LegalMonetaryTotal/TaxExclusiveAmount',
  'totals.taxInclusive': '/Invoice/LegalMonetaryTotal/TaxInclusiveAmount',
  'totals.paidAmount': '/Invoice/LegalMonetaryTotal/PrepaidAmount',
  'totals.roundingAmount': '/Invoice/LegalMonetaryTotal/PayableRoundingAmount',
  'totals.amountDue': '/Invoice/LegalMonetaryTotal/PayableAmount',
  'totals.taxTotal': (index) => {
    const main = ublMainTaxTotal(index);
    if (main === undefined) return undefined;
    return descendLocation(main.node, main.path, ['TaxAmount']);
  },

  'lines[]': '/Invoice/InvoiceLine[{0}]',
  'lines[].id': '/Invoice/InvoiceLine[{0}]/ID',
  'lines[].note': '/Invoice/InvoiceLine[{0}]/Note',
  'lines[].quantity': '/Invoice/InvoiceLine[{0}]/InvoicedQuantity',
  'lines[].unitCode': '/Invoice/InvoiceLine[{0}]/InvoicedQuantity/@unitCode',
  'lines[].netAmount': '/Invoice/InvoiceLine[{0}]/LineExtensionAmount',
  'lines[].orderLineReference': '/Invoice/InvoiceLine[{0}]/OrderLineReference/LineID',
  'lines[].item': '/Invoice/InvoiceLine[{0}]/Item',
  'lines[].item.name': '/Invoice/InvoiceLine[{0}]/Item/Name',
  'lines[].item.description': '/Invoice/InvoiceLine[{0}]/Item/Description',
  'lines[].item.sellerItemId': '/Invoice/InvoiceLine[{0}]/Item/SellersItemIdentification/ID',
  'lines[].item.standardItemId': '/Invoice/InvoiceLine[{0}]/Item/StandardItemIdentification/ID',
  'lines[].price': '/Invoice/InvoiceLine[{0}]/Price',
  'lines[].price.netPrice': '/Invoice/InvoiceLine[{0}]/Price/PriceAmount',
  'lines[].price.baseQuantity': '/Invoice/InvoiceLine[{0}]/Price/BaseQuantity',
  'lines[].price.baseQuantityUnit': '/Invoice/InvoiceLine[{0}]/Price/BaseQuantity/@unitCode',
  'lines[].vat': '/Invoice/InvoiceLine[{0}]/Item/ClassifiedTaxCategory',
  'lines[].vat.categoryCode': '/Invoice/InvoiceLine[{0}]/Item/ClassifiedTaxCategory/ID',
  'lines[].vat.rate': '/Invoice/InvoiceLine[{0}]/Item/ClassifiedTaxCategory/Percent',
};

// ————————————————————————————————————————————————————————————————
// UN/CEFACT CII (ZUGFeRD / Factur-X / XRechnung-CII)
// ————————————————————————————————————————————————————————————————

const CII_CTX = '/CrossIndustryInvoice/ExchangedDocumentContext';
const CII_DOC = '/CrossIndustryInvoice/ExchangedDocument';
const CII_TX = '/CrossIndustryInvoice/SupplyChainTradeTransaction';
const CII_AGREE = `${CII_TX}/ApplicableHeaderTradeAgreement`;
const CII_SETTLE = `${CII_TX}/ApplicableHeaderTradeSettlement`;
const CII_SUM = `${CII_SETTLE}/SpecifiedTradeSettlementHeaderMonetarySummation`;
const CII_LINE = `${CII_TX}/IncludedSupplyChainTradeLineItem[{0}]`;

function ciiParty(prefix: string, base: string): Record<string, Binding> {
  return {
    [prefix]: base,
    [`${prefix}.name`]: `${base}/Name`,
    [`${prefix}.tradingName`]: `${base}/SpecifiedLegalOrganization/TradingBusinessName`,
    [`${prefix}.identifier`]: `${base}/ID`,
    [`${prefix}.legalRegistrationId`]: `${base}/SpecifiedLegalOrganization/ID`,
    [`${prefix}.vatId`]: ciiTaxRegistration(base, 'VAT'),
    [`${prefix}.taxRegistrationId`]: ciiTaxRegistration(base, 'OTHER'),
    [`${prefix}.electronicAddress`]: `${base}/URIUniversalCommunication/URIID`,
    [`${prefix}.electronicAddressScheme`]: `${base}/URIUniversalCommunication/URIID/@schemeID`,
    [`${prefix}.address`]: `${base}/PostalTradeAddress`,
    [`${prefix}.address.streetName`]: `${base}/PostalTradeAddress/LineOne`,
    [`${prefix}.address.additionalStreet`]: `${base}/PostalTradeAddress/LineTwo`,
    [`${prefix}.address.city`]: `${base}/PostalTradeAddress/CityName`,
    [`${prefix}.address.postCode`]: `${base}/PostalTradeAddress/PostcodeCode`,
    [`${prefix}.address.countrySubdivision`]: `${base}/PostalTradeAddress/CountrySubDivisionName`,
    [`${prefix}.address.countryCode`]: `${base}/PostalTradeAddress/CountryID`,
    [`${prefix}.contact`]: `${base}/DefinedTradeContact`,
    // parse/cii.ts reads PersonName ?? DepartmentName, so the binding must
    // consider both or it drops the contact name on documents using the latter.
    [`${prefix}.contact.name`]: firstOf(`${base}/DefinedTradeContact`, [['PersonName'], ['DepartmentName']]),
    [`${prefix}.contact.phone`]: `${base}/DefinedTradeContact/TelephoneUniversalCommunication/CompleteNumber`,
    [`${prefix}.contact.email`]: `${base}/DefinedTradeContact/EmailURIUniversalCommunication/URIID`,
  };
}

const CII_BINDINGS: Record<string, Binding> = {
  specificationIdentifier: `${CII_CTX}/GuidelineSpecifiedDocumentContextParameter/ID`,
  businessProcessType: `${CII_CTX}/BusinessProcessSpecifiedDocumentContextParameter/ID`,
  number: `${CII_DOC}/ID`,
  typeCode: `${CII_DOC}/TypeCode`,
  issueDate: `${CII_DOC}/IssueDateTime/DateTimeString`,
  notes: `${CII_DOC}/IncludedNote/Content`,
  'notes[]': `${CII_DOC}/IncludedNote[{0}]/Content`,

  buyerReference: `${CII_AGREE}/BuyerReference`,
  purchaseOrderReference: `${CII_AGREE}/BuyerOrderReferencedDocument/IssuerAssignedID`,
  contractReference: `${CII_AGREE}/ContractReferencedDocument/IssuerAssignedID`,
  projectReference: `${CII_AGREE}/SpecifiedProcuringProject/ID`,

  currencyCode: `${CII_SETTLE}/InvoiceCurrencyCode`,
  vatAccountingCurrencyCode: `${CII_SETTLE}/TaxCurrencyCode`,
  // CII carries the tax point date inside the repeatable ApplicableTradeTax
  // group, unlike UBL's document-level singleton. The corpus has exactly one
  // per document, so the first group is the only sensible anchor.
  taxPointDate: `${CII_SETTLE}/ApplicableTradeTax/TaxPointDate/DateString`,
  dueDate: `${CII_SETTLE}/SpecifiedTradePaymentTerms/DueDateDateTime/DateTimeString`,
  paymentTerms: `${CII_SETTLE}/SpecifiedTradePaymentTerms/Description`,

  invoicePeriod: `${CII_SETTLE}/BillingSpecifiedPeriod`,
  'invoicePeriod.startDate': `${CII_SETTLE}/BillingSpecifiedPeriod/StartDateTime/DateTimeString`,
  'invoicePeriod.endDate': `${CII_SETTLE}/BillingSpecifiedPeriod/EndDateTime/DateTimeString`,

  'precedingInvoices[]': ciiPrecedingInvoice([]),
  'precedingInvoices[].number': ciiPrecedingInvoice(['IssuerAssignedID']),
  'precedingInvoices[].issueDate': ciiPrecedingInvoice(['FormattedIssueDateTime', 'DateTimeString']),

  ...ciiParty('seller', `${CII_AGREE}/SellerTradeParty`),
  ...ciiParty('buyer', `${CII_AGREE}/BuyerTradeParty`),
  ...ciiParty('payee', `${CII_SETTLE}/PayeeTradeParty`),

  payment: `${CII_SETTLE}/SpecifiedTradeSettlementPaymentMeans`,
  'payment.meansTypeCode': `${CII_SETTLE}/SpecifiedTradeSettlementPaymentMeans/TypeCode`,
  'payment.meansText': `${CII_SETTLE}/SpecifiedTradeSettlementPaymentMeans/Information`,
  'payment.remittanceInformation': `${CII_SETTLE}/PaymentReference`,
  'payment.mandateReference': `${CII_SETTLE}/SpecifiedTradePaymentTerms/DirectDebitMandateID`,
  'payment.debitedAccountIban': `${CII_SETTLE}/SpecifiedTradeSettlementPaymentMeans/PayerPartyDebtorFinancialAccount/IBANID`,
  'payment.creditTransfers': `${CII_SETTLE}/SpecifiedTradeSettlementPaymentMeans/PayeePartyCreditorFinancialAccount`,
  'payment.creditTransfers[]': ciiCreditTransfer(['PayeePartyCreditorFinancialAccount']),
  'payment.creditTransfers[].iban': ciiCreditTransfer(['PayeePartyCreditorFinancialAccount', 'IBANID']),
  'payment.creditTransfers[].accountName': ciiCreditTransfer([
    'PayeePartyCreditorFinancialAccount',
    'AccountName',
  ]),
  'payment.creditTransfers[].bic': ciiCreditTransfer([
    'PayeeSpecifiedCreditorFinancialInstitution',
    'BICID',
  ]),

  'allowancesCharges[]': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]`,
  'allowancesCharges[].isCharge': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]/ChargeIndicator/Indicator`,
  'allowancesCharges[].amount': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]/ActualAmount`,
  'allowancesCharges[].baseAmount': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]/BasisAmount`,
  'allowancesCharges[].percentage': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]/CalculationPercent`,
  'allowancesCharges[].reason': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]/Reason`,
  'allowancesCharges[].reasonCode': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]/ReasonCode`,
  'allowancesCharges[].vatCategoryCode': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]/CategoryTradeTax/CategoryCode`,
  'allowancesCharges[].vatRate': `${CII_SETTLE}/SpecifiedTradeAllowanceCharge[{0}]/CategoryTradeTax/RateApplicablePercent`,

  'vatBreakdown[]': `${CII_SETTLE}/ApplicableTradeTax[{0}]`,
  'vatBreakdown[].taxableAmount': `${CII_SETTLE}/ApplicableTradeTax[{0}]/BasisAmount`,
  'vatBreakdown[].taxAmount': `${CII_SETTLE}/ApplicableTradeTax[{0}]/CalculatedAmount`,
  'vatBreakdown[].categoryCode': `${CII_SETTLE}/ApplicableTradeTax[{0}]/CategoryCode`,
  'vatBreakdown[].rate': `${CII_SETTLE}/ApplicableTradeTax[{0}]/RateApplicablePercent`,
  'vatBreakdown[].exemptionReason': `${CII_SETTLE}/ApplicableTradeTax[{0}]/ExemptionReason`,
  'vatBreakdown[].exemptionReasonCode': `${CII_SETTLE}/ApplicableTradeTax[{0}]/ExemptionReasonCode`,

  totals: CII_SUM,
  'totals.sumOfLineNet': `${CII_SUM}/LineTotalAmount`,
  'totals.allowanceTotal': `${CII_SUM}/AllowanceTotalAmount`,
  'totals.chargeTotal': `${CII_SUM}/ChargeTotalAmount`,
  'totals.taxExclusive': `${CII_SUM}/TaxBasisTotalAmount`,
  'totals.taxInclusive': `${CII_SUM}/GrandTotalAmount`,
  'totals.paidAmount': `${CII_SUM}/TotalPrepaidAmount`,
  'totals.roundingAmount': `${CII_SUM}/RoundingAmount`,
  'totals.amountDue': `${CII_SUM}/DuePayableAmount`,
  'totals.taxTotal': ciiTaxTotal,

  'lines[]': CII_LINE,
  'lines[].id': `${CII_LINE}/AssociatedDocumentLineDocument/LineID`,
  'lines[].note': `${CII_LINE}/AssociatedDocumentLineDocument/IncludedNote/Content`,
  'lines[].quantity': `${CII_LINE}/SpecifiedLineTradeDelivery/BilledQuantity`,
  'lines[].unitCode': `${CII_LINE}/SpecifiedLineTradeDelivery/BilledQuantity/@unitCode`,
  'lines[].netAmount': `${CII_LINE}/SpecifiedLineTradeSettlement/SpecifiedTradeSettlementLineMonetarySummation/LineTotalAmount`,
  // BT-132. parse/cii.ts does not read this yet; the binding is here so the
  // two tables stay symmetrical and the field is covered when it does.
  'lines[].orderLineReference': `${CII_LINE}/SpecifiedLineTradeAgreement/BuyerOrderReferencedDocument/LineID`,
  'lines[].item': `${CII_LINE}/SpecifiedTradeProduct`,
  'lines[].item.name': `${CII_LINE}/SpecifiedTradeProduct/Name`,
  'lines[].item.description': `${CII_LINE}/SpecifiedTradeProduct/Description`,
  'lines[].item.sellerItemId': `${CII_LINE}/SpecifiedTradeProduct/SellerAssignedID`,
  'lines[].item.standardItemId': `${CII_LINE}/SpecifiedTradeProduct/GlobalID`,
  'lines[].price': `${CII_LINE}/SpecifiedLineTradeAgreement/NetPriceProductTradePrice`,
  'lines[].price.netPrice': `${CII_LINE}/SpecifiedLineTradeAgreement/NetPriceProductTradePrice/ChargeAmount`,
  'lines[].price.baseQuantity': `${CII_LINE}/SpecifiedLineTradeAgreement/NetPriceProductTradePrice/BasisQuantity`,
  'lines[].price.baseQuantityUnit': `${CII_LINE}/SpecifiedLineTradeAgreement/NetPriceProductTradePrice/BasisQuantity/@unitCode`,
  'lines[].vat': `${CII_LINE}/SpecifiedLineTradeSettlement/ApplicableTradeTax`,
  'lines[].vat.categoryCode': `${CII_LINE}/SpecifiedLineTradeSettlement/ApplicableTradeTax/CategoryCode`,
  'lines[].vat.rate': `${CII_LINE}/SpecifiedLineTradeSettlement/ApplicableTradeTax/RateApplicablePercent`,
};

const TABLES: Record<Syntax, Record<string, Binding>> = { ubl: UBL_BINDINGS, cii: CII_BINDINGS };

// ————————————————————————————————————————————————————————————————
// Lookup
// ————————————————————————————————————————————————————————————————

/** `lines[2].vat.rate` → key `lines[].vat.rate`, indices `[2]`. */
function normalise(semanticPath: string): { key: string; indices: number[] } {
  const indices: number[] = [];
  const key = semanticPath.replace(/\[(\d+)\]/g, (_match, digits: string) => {
    indices.push(Number.parseInt(digits, 10));
    return '[]';
  });
  return { key, indices };
}

/** Substitute `{n}` with the 1-based XPath position for 0-based index n. */
function fill(template: string, indices: readonly number[]): string {
  return template.replace(/\{(\d+)\}/g, (_match, digits: string) => {
    const index = indices[Number.parseInt(digits, 10)];
    return String((index ?? 0) + 1);
  });
}

/** Every semantic path this syntax can bind. Exported for coverage tests. */
export function boundSemanticPaths(syntax: Syntax): string[] {
  return Object.keys(TABLES[syntax]).sort();
}

/** The raw binding for a normalised key, for tests that assert the table itself. */
export function bindingFor(syntax: Syntax, key: string): Binding | undefined {
  return TABLES[syntax][key];
}

/**
 * Locate a semantic model path in the source document.
 *
 * Falls back progressively: the exact element, then its nearest existing
 * ancestor, then — for an unbound path — the parent object's binding, so
 * `lines[4].item.someNewField` still lands on line 4's item rather than
 * nowhere. Returns undefined only when nothing in the chain is bound.
 */
export function locateSemanticPath(
  index: XmlDocumentIndex,
  syntax: Syntax,
  semanticPath: string,
): ResolvedLocation | undefined {
  const table = TABLES[syntax];
  const { key, indices } = normalise(semanticPath);

  // Walk up the path until a binding exists: `a.b.c` → `a.b` → `a`.
  let candidate = key;
  while (candidate.length > 0) {
    const binding = table[candidate];
    if (binding !== undefined) {
      const hit =
        typeof binding === 'string'
          ? resolveXmlPath(index, fill(binding, indices))
          : binding(index, indices);
      if (hit !== undefined) return hit;
    }
    const cut = Math.max(candidate.lastIndexOf('.'), candidate.lastIndexOf('['));
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
  }
  return undefined;
}
