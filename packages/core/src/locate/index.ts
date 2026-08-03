/**
 * Attach source positions to validation violations.
 *
 * This is what turns `BR-DE-15: missing buyer reference` into an annotation on
 * a specific line of a specific file — the thing a CI reviewer can act on
 * without opening the XML and hunting.
 *
 * Every violation gets a location, but the `precision` field says how much to
 * trust it, and callers are expected to surface that rather than hide it:
 *
 * - `exact`    — the element or attribute the rule is about was found.
 * - `ancestor` — the field is *missing*, so the nearest containing element is
 *                the closest honest answer (this is the common case: most
 *                rules fire because something is absent).
 * - `document` — nothing could be located; the annotation sits on the root
 *                element. Reported, never disguised as a real position.
 */
import type { Violation } from '../validate/rule.js';
import type { Syntax } from '../validate/index.js';
import { locateSemanticPath } from './bindings.js';
import { indexXml, type XmlDocumentIndex } from './xml-index.js';

export type LocationPrecision = 'exact' | 'ancestor' | 'document';

export interface ViolationLocation {
  /** 1-based line of the element, attribute, or fallback anchor. */
  line: number;
  /** 1-based column. */
  column: number;
  /** 1-based line where the anchor element closes. */
  endLine: number;
  /** The document path that was resolved. */
  xpath: string;
  precision: LocationPrecision;
  /**
   * What produced the location: the violation's own path, a single-occurrence
   * business term, a business *group* (a section anchor), or the document root.
   */
  via: 'path' | 'term' | 'group' | 'root';
  /** The text found at that location, when there is any. */
  value?: string;
}

export interface LocatedViolation extends Violation {
  location: ViolationLocation;
}

/**
 * Business terms that identify exactly one element per document, mapped to the
 * semantic path that carries them.
 *
 * Terms inside repeatable groups (BT-116..121 in the VAT breakdown, BT-126..153
 * on a line) are deliberately absent: without an index, a term-only lookup
 * would point at the *first* group, which for a fault in the fourth line is a
 * confidently wrong line number. Those rules already emit an indexed `path`,
 * and when they do not, a document-level annotation is the honest answer.
 */
const SINGLETON_TERM_PATHS: Readonly<Record<string, string>> = {
  'BT-1': 'number',
  'BT-2': 'issueDate',
  'BT-3': 'typeCode',
  'BT-5': 'currencyCode',
  'BT-6': 'vatAccountingCurrencyCode',
  'BT-7': 'taxPointDate',
  'BT-9': 'dueDate',
  'BT-10': 'buyerReference',
  'BT-11': 'projectReference',
  'BT-12': 'contractReference',
  'BT-13': 'purchaseOrderReference',
  'BT-20': 'paymentTerms',
  'BT-23': 'businessProcessType',
  'BT-24': 'specificationIdentifier',
  // Seller (BG-4)
  'BT-27': 'seller.name',
  'BT-28': 'seller.tradingName',
  'BT-29': 'seller.identifier',
  'BT-30': 'seller.legalRegistrationId',
  'BT-31': 'seller.vatId',
  'BT-32': 'seller.taxRegistrationId',
  'BT-34': 'seller.electronicAddress',
  'BT-35': 'seller.address.streetName',
  'BT-36': 'seller.address.additionalStreet',
  'BT-37': 'seller.address.city',
  'BT-38': 'seller.address.postCode',
  'BT-39': 'seller.address.countrySubdivision',
  'BT-40': 'seller.address.countryCode',
  'BT-41': 'seller.contact.name',
  'BT-42': 'seller.contact.phone',
  'BT-43': 'seller.contact.email',
  // Buyer (BG-7)
  'BT-44': 'buyer.name',
  'BT-45': 'buyer.tradingName',
  'BT-46': 'buyer.identifier',
  'BT-47': 'buyer.legalRegistrationId',
  'BT-48': 'buyer.vatId',
  'BT-49': 'buyer.electronicAddress',
  'BT-50': 'buyer.address.streetName',
  'BT-51': 'buyer.address.additionalStreet',
  'BT-52': 'buyer.address.city',
  'BT-53': 'buyer.address.postCode',
  'BT-54': 'buyer.address.countrySubdivision',
  'BT-55': 'buyer.address.countryCode',
  'BT-56': 'buyer.contact.name',
  'BT-57': 'buyer.contact.phone',
  'BT-58': 'buyer.contact.email',
  // Payment (BG-16)
  'BT-81': 'payment.meansTypeCode',
  'BT-82': 'payment.meansText',
  'BT-83': 'payment.remittanceInformation',
  'BT-89': 'payment.mandateReference',
  'BT-91': 'payment.debitedAccountIban',
  // Totals (BG-22)
  'BT-106': 'totals.sumOfLineNet',
  'BT-107': 'totals.allowanceTotal',
  'BT-108': 'totals.chargeTotal',
  'BT-109': 'totals.taxExclusive',
  'BT-110': 'totals.taxTotal',
  'BT-112': 'totals.taxInclusive',
  'BT-113': 'totals.paidAmount',
  'BT-114': 'totals.roundingAmount',
  'BT-115': 'totals.amountDue',
};

/**
 * Business *groups* (BG-*), mapped to the section that represents them.
 *
 * These serve rules whose complaint is that a whole group is missing or
 * duplicated — "the invoice uses VAT category S but has no VAT breakdown with
 * category S". There is no element for the thing that is absent, but the
 * section it belongs in is exactly where the fix goes, so anchoring there beats
 * line 1. A group anchor is always reported as approximate, never as exact.
 */
const GROUP_TERM_PATHS: Readonly<Record<string, string>> = {
  'BG-3': 'precedingInvoices[0]',
  'BG-4': 'seller',
  'BG-5': 'seller.address',
  'BG-6': 'seller.contact',
  'BG-7': 'buyer',
  'BG-8': 'buyer.address',
  'BG-9': 'buyer.contact',
  'BG-10': 'payee',
  'BG-14': 'invoicePeriod',
  'BG-16': 'payment',
  'BG-17': 'payment.creditTransfers',
  'BG-20': 'allowancesCharges[0]',
  'BG-21': 'allowancesCharges[0]',
  'BG-22': 'totals',
  'BG-23': 'vatBreakdown[0]',
  'BG-25': 'lines[0]',
};

/** The business terms that can be resolved to a line without an index. */
export function locatableTerms(): string[] {
  return [...Object.keys(SINGLETON_TERM_PATHS), ...Object.keys(GROUP_TERM_PATHS)].sort();
}

function documentLocation(index: XmlDocumentIndex): ViolationLocation {
  const root = index.root;
  if (root === undefined) {
    return { line: 1, column: 1, endLine: 1, xpath: '/', precision: 'document', via: 'root' };
  }
  return {
    line: root.line,
    column: root.column,
    endLine: root.endLine,
    xpath: `/${root.name}`,
    precision: 'document',
    via: 'root',
  };
}

/**
 * Attach a source location to each violation.
 *
 * `xml` must be the same text that produced the violations; `syntax` the one
 * reported by {@link validateXml}. Indexing happens once for the whole batch.
 */
export function locateViolations(
  xml: string,
  violations: readonly Violation[],
  syntax: Syntax,
): LocatedViolation[] {
  const index = indexXml(xml);
  const fallback = documentLocation(index);

  return violations.map((violation): LocatedViolation => {
    const attach = (
      hit: ReturnType<typeof locateSemanticPath>,
      via: 'path' | 'term' | 'group',
    ): LocatedViolation | undefined => {
      if (hit === undefined) return undefined;
      const location: ViolationLocation = {
        line: hit.line,
        column: hit.column,
        endLine: hit.endLine,
        xpath: hit.resolvedPath,
        // A group anchor points at a section, not at the offending element —
        // the element does not exist. Never present that as exact.
        precision: via === 'group' ? 'ancestor' : hit.match,
        via,
      };
      if (hit.value !== undefined) location.value = hit.value;
      return { ...violation, location };
    };

    if (violation.path !== undefined) {
      const located = attach(locateSemanticPath(index, syntax, violation.path), 'path');
      if (located !== undefined) return located;
    }

    for (const term of violation.terms ?? []) {
      const semanticPath = SINGLETON_TERM_PATHS[term];
      if (semanticPath === undefined) continue;
      const located = attach(locateSemanticPath(index, syntax, semanticPath), 'term');
      if (located !== undefined) return located;
    }

    // Group anchors last: a section is a weaker answer than a specific field,
    // so it is only used when no term in the list resolved.
    for (const term of violation.terms ?? []) {
      const semanticPath = GROUP_TERM_PATHS[term];
      if (semanticPath === undefined) continue;
      const located = attach(locateSemanticPath(index, syntax, semanticPath), 'group');
      if (located !== undefined) return located;
    }

    return { ...violation, location: fallback };
  });
}

export { indexXml, resolveXmlPath, resolveFirstXmlPath } from './xml-index.js';
export type {
  PathMatch,
  ResolvedLocation,
  XmlAttributeLocation,
  XmlDocumentIndex,
  XmlNode,
} from './xml-index.js';
export { boundSemanticPaths, locateSemanticPath } from './bindings.js';
