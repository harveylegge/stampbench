/**
 * EN 16931 semantic model → XRechnung-flavoured UBL 2.1 Invoice XML.
 *
 * Elements are emitted in UBL schema order (order is not optional in XSD
 * sequences). Only present fields are emitted. All text is XML-escaped.
 */
import type { AllowanceCharge, Invoice, Party } from '../model/invoice.js';
import { XRECHNUNG_30_SPEC_ID } from '../model/codes.js';
import { round2 } from '../validate/rule.js';

const UBL_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
const CAC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const CBC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';

/** Default Peppol billing process id (BT-23) used by XRechnung. */
export const DEFAULT_PROCESS_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Monetary amounts (totals, line amounts, VAT amounts) are stated to 2 decimals. */
function money(n: number): string {
  // Defense in depth: never emit NaN/Infinity into XML (a non-finite value that
  // slipped past input validation would otherwise serialise as "Infinity").
  if (!Number.isFinite(n)) return '0.00';
  return round2(n).toFixed(2);
}

/**
 * Unit price (BT-146) may carry more than 2 decimals — EN 16931 does not
 * constrain it to 2dp, and forcing rounding corrupts fractional prices
 * (e.g. €0.125/unit). Emit up to 4 decimals, trailing zeros trimmed, but
 * always at least 2 so the value reads as a monetary figure.
 */
function priceAmount(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  const rounded = Math.round((n + Number.EPSILON) * 1e4) / 1e4;
  const s = rounded.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return s.includes('.') ? s : `${s}.00`;
}

class Xml {
  private out: string[] = [];
  private depth = 0;

  raw(line: string): void {
    this.out.push(`${'  '.repeat(this.depth)}${line}`);
  }

  /** Emit a leaf element if the value is present. */
  leaf(tag: string, value: string | number | undefined, attrs?: Record<string, string | undefined>): void {
    if (value === undefined || value === '') return;
    const a = Object.entries(attrs ?? {})
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => ` ${k}="${esc(v as string)}"`)
      .join('');
    this.raw(`<${tag}${a}>${esc(String(value))}</${tag}>`);
  }

  /** Emit a wrapper element; the body callback decides its children. Skipped when body emits nothing. */
  wrap(tag: string, body: () => void, attrs?: Record<string, string | undefined>): void {
    const a = Object.entries(attrs ?? {})
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => ` ${k}="${esc(v as string)}"`)
      .join('');
    const marker = this.out.length;
    this.raw(`<${tag}${a}>`);
    this.depth++;
    body();
    this.depth--;
    if (this.out.length === marker + 1) {
      this.out.length = marker; // nothing inside — drop the wrapper
      return;
    }
    this.raw(`</${tag}>`);
  }

  toString(): string {
    return this.out.join('\n');
  }
}

function emitParty(
  x: Xml,
  wrapperTag: string,
  party: Party | undefined,
  opts: { role?: 'seller' | 'buyer' | 'payee' } = {},
): void {
  if (!party) return;
  const isPayee = opts.role === 'payee';
  x.wrap(wrapperTag, () => {
    x.wrap('cac:Party', () => {
      x.leaf('cbc:EndpointID', party.electronicAddress, { schemeID: party.electronicAddressScheme });
      if (party.identifier) {
        x.wrap('cac:PartyIdentification', () => x.leaf('cbc:ID', party.identifier));
      }
      // Payee name (BT-59) lives in PartyName/Name; seller/buyer names are the
      // legal RegistrationName. Trading name also uses PartyName.
      const partyName = isPayee ? party.name ?? party.tradingName : party.tradingName;
      if (partyName) {
        x.wrap('cac:PartyName', () => x.leaf('cbc:Name', partyName));
      }
      x.wrap('cac:PostalAddress', () => {
        x.leaf('cbc:StreetName', party.address?.streetName);
        x.leaf('cbc:AdditionalStreetName', party.address?.additionalStreet);
        x.leaf('cbc:CityName', party.address?.city);
        x.leaf('cbc:PostalZone', party.address?.postCode);
        x.leaf('cbc:CountrySubentity', party.address?.countrySubdivision);
        x.wrap('cac:Country', () => x.leaf('cbc:IdentificationCode', party.address?.countryCode));
      });
      if (party.vatId) {
        x.wrap('cac:PartyTaxScheme', () => {
          x.leaf('cbc:CompanyID', party.vatId);
          x.wrap('cac:TaxScheme', () => x.leaf('cbc:ID', 'VAT'));
        });
      }
      if (party.taxRegistrationId) {
        x.wrap('cac:PartyTaxScheme', () => {
          x.leaf('cbc:CompanyID', party.taxRegistrationId);
          x.wrap('cac:TaxScheme', () => x.leaf('cbc:ID', 'FC'));
        });
      }
      x.wrap('cac:PartyLegalEntity', () => {
        // For the payee, the name already went to PartyName (BT-59); here we
        // only carry the legal registration id if present.
        x.leaf('cbc:RegistrationName', isPayee ? undefined : party.name);
        x.leaf('cbc:CompanyID', party.legalRegistrationId);
      });
      if (party.contact) {
        x.wrap('cac:Contact', () => {
          x.leaf('cbc:Name', party.contact?.name);
          x.leaf('cbc:Telephone', party.contact?.phone);
          x.leaf('cbc:ElectronicMail', party.contact?.email);
        });
      }
    });
  });
}

function emitAllowanceCharge(x: Xml, ac: AllowanceCharge, currency: string): void {
  x.wrap('cac:AllowanceCharge', () => {
    x.leaf('cbc:ChargeIndicator', ac.isCharge ? 'true' : 'false');
    x.leaf('cbc:AllowanceChargeReasonCode', ac.reasonCode);
    x.leaf('cbc:AllowanceChargeReason', ac.reason);
    x.leaf('cbc:MultiplierFactorNumeric', ac.percentage);
    x.leaf('cbc:Amount', money(ac.amount), { currencyID: currency });
    if (ac.baseAmount !== undefined) x.leaf('cbc:BaseAmount', money(ac.baseAmount), { currencyID: currency });
    if (ac.vatCategoryCode) {
      x.wrap('cac:TaxCategory', () => {
        x.leaf('cbc:ID', ac.vatCategoryCode);
        x.leaf('cbc:Percent', ac.vatRate);
        x.wrap('cac:TaxScheme', () => x.leaf('cbc:ID', 'VAT'));
      });
    }
  });
}

export interface GenerateOptions {
  /** Override BT-24. Defaults to the XRechnung 3.0 customization id. */
  specificationIdentifier?: string;
  /** Override BT-23. Defaults to the Peppol billing process id. */
  businessProcessType?: string;
}

/**
 * Fill the defaults the generator would emit anyway (BT-24 spec id, BT-23
 * process, BT-3 type code 380, BT-5 EUR) so that validating the model gives
 * the same verdict as validating the generated XML.
 */
export function withXRechnungDefaults(invoice: Invoice, options?: GenerateOptions): Invoice {
  return {
    ...invoice,
    specificationIdentifier:
      options?.specificationIdentifier ?? invoice.specificationIdentifier ?? XRECHNUNG_30_SPEC_ID,
    businessProcessType:
      options?.businessProcessType ?? invoice.businessProcessType ?? DEFAULT_PROCESS_ID,
    typeCode: invoice.typeCode ?? '380',
    currencyCode: invoice.currencyCode ?? 'EUR',
  };
}

/**
 * Generate an XRechnung (UBL syntax) document from the semantic model.
 * Fields the model omits are simply not emitted — run validate() on the
 * model first (or on the produced XML) to catch what's missing.
 */
export function generateXRechnungUbl(invoice: Invoice, options?: GenerateOptions): string {
  const currency = invoice.currencyCode ?? 'EUR';
  const doc = new Xml();
  doc.raw('<?xml version="1.0" encoding="UTF-8"?>');
  doc.wrap(
    'Invoice',
    () => {
      doc.leaf('cbc:CustomizationID', options?.specificationIdentifier ?? invoice.specificationIdentifier ?? XRECHNUNG_30_SPEC_ID);
      doc.leaf('cbc:ProfileID', options?.businessProcessType ?? invoice.businessProcessType ?? DEFAULT_PROCESS_ID);
      doc.leaf('cbc:ID', invoice.number);
      doc.leaf('cbc:IssueDate', invoice.issueDate);
      doc.leaf('cbc:DueDate', invoice.dueDate);
      doc.leaf('cbc:InvoiceTypeCode', invoice.typeCode ?? '380');
      for (const note of invoice.notes ?? []) doc.leaf('cbc:Note', note);
      doc.leaf('cbc:TaxPointDate', invoice.taxPointDate);
      doc.leaf('cbc:DocumentCurrencyCode', currency);
      doc.leaf('cbc:TaxCurrencyCode', invoice.vatAccountingCurrencyCode);
      doc.leaf('cbc:BuyerReference', invoice.buyerReference);
      if (invoice.invoicePeriod) {
        doc.wrap('cac:InvoicePeriod', () => {
          doc.leaf('cbc:StartDate', invoice.invoicePeriod?.startDate);
          doc.leaf('cbc:EndDate', invoice.invoicePeriod?.endDate);
        });
      }
      if (invoice.purchaseOrderReference) {
        doc.wrap('cac:OrderReference', () => doc.leaf('cbc:ID', invoice.purchaseOrderReference));
      }
      for (const ref of invoice.precedingInvoices ?? []) {
        doc.wrap('cac:BillingReference', () => {
          doc.wrap('cac:InvoiceDocumentReference', () => {
            doc.leaf('cbc:ID', ref.number);
            doc.leaf('cbc:IssueDate', ref.issueDate);
          });
        });
      }
      if (invoice.contractReference) {
        doc.wrap('cac:ContractDocumentReference', () => doc.leaf('cbc:ID', invoice.contractReference));
      }
      if (invoice.projectReference) {
        doc.wrap('cac:ProjectReference', () => doc.leaf('cbc:ID', invoice.projectReference));
      }
      emitParty(doc, 'cac:AccountingSupplierParty', invoice.seller, { role: 'seller' });
      emitParty(doc, 'cac:AccountingCustomerParty', invoice.buyer, { role: 'buyer' });
      if (invoice.payee) emitParty(doc, 'cac:PayeeParty', invoice.payee, { role: 'payee' });

      if (invoice.payment) {
        const pm = invoice.payment;
        const transfers = pm.creditTransfers?.length ? pm.creditTransfers : [undefined];
        for (const ct of transfers) {
          doc.wrap('cac:PaymentMeans', () => {
            doc.leaf('cbc:PaymentMeansCode', pm.meansTypeCode, { name: pm.meansText });
            doc.leaf('cbc:PaymentID', pm.remittanceInformation);
            if (ct) {
              doc.wrap('cac:PayeeFinancialAccount', () => {
                doc.leaf('cbc:ID', ct.iban?.replace(/\s+/g, ''));
                doc.leaf('cbc:Name', ct.accountName);
                if (ct.bic) {
                  doc.wrap('cac:FinancialInstitutionBranch', () => doc.leaf('cbc:ID', ct.bic));
                }
              });
            }
            // BT-89 mandate reference / BT-91 debited account (SEPA direct debit).
            if (pm.mandateReference || pm.debitedAccountIban) {
              doc.wrap('cac:PaymentMandate', () => {
                doc.leaf('cbc:ID', pm.mandateReference);
                if (pm.debitedAccountIban) {
                  doc.wrap('cac:PayerFinancialAccount', () =>
                    doc.leaf('cbc:ID', pm.debitedAccountIban?.replace(/\s+/g, '')),
                  );
                }
              });
            }
          });
        }
      }
      if (invoice.paymentTerms) {
        doc.wrap('cac:PaymentTerms', () => doc.leaf('cbc:Note', invoice.paymentTerms));
      }
      for (const ac of invoice.allowancesCharges ?? []) emitAllowanceCharge(doc, ac, currency);

      if (invoice.vatBreakdown?.length || invoice.totals?.taxTotal !== undefined) {
        doc.wrap('cac:TaxTotal', () => {
          const taxTotal =
            invoice.totals?.taxTotal ??
            round2((invoice.vatBreakdown ?? []).reduce((s, bd) => s + bd.taxAmount, 0));
          doc.leaf('cbc:TaxAmount', money(taxTotal), { currencyID: currency });
          for (const bd of invoice.vatBreakdown ?? []) {
            doc.wrap('cac:TaxSubtotal', () => {
              doc.leaf('cbc:TaxableAmount', money(bd.taxableAmount), { currencyID: currency });
              doc.leaf('cbc:TaxAmount', money(bd.taxAmount), { currencyID: currency });
              doc.wrap('cac:TaxCategory', () => {
                doc.leaf('cbc:ID', bd.categoryCode);
                if (bd.rate !== undefined) doc.leaf('cbc:Percent', bd.rate);
                doc.leaf('cbc:TaxExemptionReasonCode', bd.exemptionReasonCode);
                doc.leaf('cbc:TaxExemptionReason', bd.exemptionReason);
                doc.wrap('cac:TaxScheme', () => doc.leaf('cbc:ID', 'VAT'));
              });
            });
          }
        });
      }

      if (invoice.totals) {
        const t = invoice.totals;
        doc.wrap('cac:LegalMonetaryTotal', () => {
          if (t.sumOfLineNet !== undefined) doc.leaf('cbc:LineExtensionAmount', money(t.sumOfLineNet), { currencyID: currency });
          if (t.allowanceTotal !== undefined) doc.leaf('cbc:AllowanceTotalAmount', money(t.allowanceTotal), { currencyID: currency });
          if (t.chargeTotal !== undefined) doc.leaf('cbc:ChargeTotalAmount', money(t.chargeTotal), { currencyID: currency });
          if (t.taxExclusive !== undefined) doc.leaf('cbc:TaxExclusiveAmount', money(t.taxExclusive), { currencyID: currency });
          if (t.taxInclusive !== undefined) doc.leaf('cbc:TaxInclusiveAmount', money(t.taxInclusive), { currencyID: currency });
          if (t.paidAmount !== undefined) doc.leaf('cbc:PrepaidAmount', money(t.paidAmount), { currencyID: currency });
          if (t.roundingAmount !== undefined) doc.leaf('cbc:PayableRoundingAmount', money(t.roundingAmount), { currencyID: currency });
          if (t.amountDue !== undefined) doc.leaf('cbc:PayableAmount', money(t.amountDue), { currencyID: currency });
        });
      }

      for (const [idx, line] of (invoice.lines ?? []).entries()) {
        doc.wrap('cac:InvoiceLine', () => {
          doc.leaf('cbc:ID', line.id ?? String(idx + 1));
          doc.leaf('cbc:Note', line.note);
          if (line.quantity !== undefined) {
            doc.leaf('cbc:InvoicedQuantity', line.quantity, { unitCode: line.unitCode });
          }
          if (line.netAmount !== undefined) {
            doc.leaf('cbc:LineExtensionAmount', money(line.netAmount), { currencyID: currency });
          }
          if (line.orderLineReference) {
            doc.wrap('cac:OrderLineReference', () => doc.leaf('cbc:LineID', line.orderLineReference));
          }
          doc.wrap('cac:Item', () => {
            doc.leaf('cbc:Description', line.item?.description);
            doc.leaf('cbc:Name', line.item?.name);
            if (line.item?.sellerItemId) {
              doc.wrap('cac:SellersItemIdentification', () => doc.leaf('cbc:ID', line.item?.sellerItemId));
            }
            if (line.item?.standardItemId) {
              doc.wrap('cac:StandardItemIdentification', () => doc.leaf('cbc:ID', line.item?.standardItemId));
            }
            if (line.vat?.categoryCode) {
              doc.wrap('cac:ClassifiedTaxCategory', () => {
                doc.leaf('cbc:ID', line.vat?.categoryCode);
                if (line.vat?.rate !== undefined) doc.leaf('cbc:Percent', line.vat.rate);
                doc.wrap('cac:TaxScheme', () => doc.leaf('cbc:ID', 'VAT'));
              });
            }
          });
          if (line.price?.netPrice !== undefined) {
            doc.wrap('cac:Price', () => {
              doc.leaf('cbc:PriceAmount', priceAmount(line.price!.netPrice!), { currencyID: currency });
              if (line.price?.baseQuantity !== undefined) {
                doc.leaf('cbc:BaseQuantity', line.price.baseQuantity, { unitCode: line.price.baseQuantityUnit });
              }
            });
          }
        });
      }
    },
    { xmlns: UBL_NS, 'xmlns:cac': CAC_NS, 'xmlns:cbc': CBC_NS },
  );
  return doc.toString() + '\n';
}
