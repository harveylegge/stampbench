/**
 * XRechnung CIUS rules (BR-DE-*) — the German national tightening of
 * EN 16931 that applies to invoices sent to German public authorities and,
 * from the 2025–2028 B2B mandate, increasingly between German businesses.
 *
 * Rule ids follow the official BR-DE numbering for the well-established
 * rules; IG-DE-* are InvoiceGate's own supporting diagnostics. Messages are
 * our own wording.
 */
import type { Invoice } from '../../model/invoice.js';
import {
  CREDIT_TRANSFER_MEANS_CODES,
  DIRECT_DEBIT_MEANS_CODES,
  IBAN_RE,
  XRECHNUNG_SPEC_FRAGMENT,
  XRECHNUNG_TYPE_CODES,
} from '../../model/codes.js';
import { present, violation, type Rule, type Violation } from '../rule.js';

function reqDE(
  id: string,
  terms: string[],
  description: string,
  get: (inv: Invoice) => unknown,
  message: string,
): Rule {
  return {
    id,
    severity: 'error',
    profile: 'xrechnung',
    description,
    terms,
    check(inv) {
      return present(get(inv)) ? null : [violation({ id, severity: 'error', terms }, message)];
    },
  };
}

export const XRECHNUNG_RULES: Rule[] = [
  reqDE('BR-DE-1', ['BG-16'], 'Payment instructions must be provided.',
    (i) => i.payment,
    'XRechnung requires payment instructions (BG-16) — add a payment means code, e.g. 58 for SEPA credit transfer with an IBAN.'),
  reqDE('BR-DE-2', ['BG-6'], 'The seller must provide a contact point.',
    (i) => i.seller?.contact,
    'XRechnung requires a seller contact (BG-6) with name, telephone and email.'),
  reqDE('BR-DE-3', ['BT-37'], 'The seller address must include a city.',
    (i) => i.seller?.address?.city, 'Missing seller city (BT-37) — required by XRechnung.'),
  reqDE('BR-DE-4', ['BT-38'], 'The seller address must include a post code.',
    (i) => i.seller?.address?.postCode, 'Missing seller post code (BT-38) — required by XRechnung.'),
  reqDE('BR-DE-5', ['BT-41'], 'The seller contact must include a name.',
    (i) => i.seller?.contact?.name, 'Missing seller contact name (BT-41) — required by XRechnung.'),
  reqDE('BR-DE-6', ['BT-42'], 'The seller contact must include a telephone number.',
    (i) => i.seller?.contact?.phone, 'Missing seller contact telephone (BT-42) — required by XRechnung.'),
  reqDE('BR-DE-7', ['BT-43'], 'The seller contact must include an email address.',
    (i) => i.seller?.contact?.email, 'Missing seller contact email (BT-43) — required by XRechnung.'),
  reqDE('BR-DE-8', ['BT-52'], 'The buyer address must include a city.',
    (i) => i.buyer?.address?.city, 'Missing buyer city (BT-52) — required by XRechnung.'),
  reqDE('BR-DE-9', ['BT-53'], 'The buyer address must include a post code.',
    (i) => i.buyer?.address?.postCode, 'Missing buyer post code (BT-53) — required by XRechnung.'),
  reqDE('BR-DE-15', ['BT-10'], 'The buyer reference must be provided.',
    (i) => i.buyerReference,
    'Missing buyer reference (BT-10). For German public-sector buyers this is the Leitweg-ID; B2B buyers usually supply their own reference. Use "n/a" only if the buyer explicitly has none.'),
  {
    id: 'BR-DE-16', severity: 'error', profile: 'xrechnung', terms: ['BT-31', 'BT-32', 'BT-63'],
    description: 'The seller must provide a VAT identifier or tax registration identifier.',
    check(inv) {
      if (!inv.seller) return null;
      return present(inv.seller.vatId) || present(inv.seller.taxRegistrationId)
        ? null
        : [violation({ id: 'BR-DE-16', severity: 'error', terms: ['BT-31', 'BT-32'] },
            'XRechnung requires the seller VAT identifier (BT-31, e.g. DE123456789) or tax registration number (BT-32, Steuernummer).')];
    },
  },
  {
    id: 'BR-DE-17', severity: 'warning', profile: 'xrechnung', terms: ['BT-3'],
    description: 'Only a restricted set of invoice type codes should be used.',
    check(inv) {
      if (!present(inv.typeCode)) return null;
      return XRECHNUNG_TYPE_CODES.has(inv.typeCode as string)
        ? null
        : [violation({ id: 'BR-DE-17', severity: 'warning', terms: ['BT-3'] },
            `Invoice type code "${inv.typeCode}" is outside the set XRechnung admits (326, 380, 381, 384, 386, 389).`,
            { path: 'typeCode', value: inv.typeCode })];
    },
  },
  {
    id: 'BR-DE-21', severity: 'error', profile: 'xrechnung', terms: ['BT-24'],
    description: 'The specification identifier must reference the XRechnung CIUS.',
    check(inv) {
      if (!present(inv.specificationIdentifier)) return null; // BR-01 covers absence
      return (inv.specificationIdentifier as string).toLowerCase().includes(XRECHNUNG_SPEC_FRAGMENT)
        ? null
        : [violation({ id: 'BR-DE-21', severity: 'error', terms: ['BT-24'] },
            `Specification identifier (BT-24) does not reference XRechnung. Expected the urn:…xrechnung_3.0 customization id, got "${inv.specificationIdentifier}".`,
            { path: 'specificationIdentifier', value: inv.specificationIdentifier })];
    },
  },
  {
    id: 'IG-DE-23', severity: 'error', profile: 'xrechnung', terms: ['BT-81', 'BG-17', 'BT-84'],
    description: 'Credit-transfer payments must include an account (IBAN); direct debits a debited account.',
    check(inv) {
      const pm = inv.payment;
      if (!pm || !present(pm.meansTypeCode)) return null;
      const out: Violation[] = [];
      if (CREDIT_TRANSFER_MEANS_CODES.has(pm.meansTypeCode as string)) {
        const hasAccount = (pm.creditTransfers ?? []).some((ct) => present(ct.iban));
        if (!hasAccount) {
          out.push(violation({ id: 'IG-DE-23', severity: 'error', terms: ['BG-17', 'BT-84'] },
            `Payment means code ${pm.meansTypeCode} (credit transfer) requires a payment account with an IBAN (BT-84).`,
            { path: 'payment.creditTransfers' }));
        }
      }
      if (DIRECT_DEBIT_MEANS_CODES.has(pm.meansTypeCode as string) && !present(pm.debitedAccountIban)) {
        out.push(violation({ id: 'IG-DE-23', severity: 'error', terms: ['BT-91'] },
          `Payment means code ${pm.meansTypeCode} (direct debit) requires the debited account IBAN (BT-91).`,
          { path: 'payment.debitedAccountIban' }));
      }
      return out.length ? out : null;
    },
  },
  {
    id: 'IG-DE-IBAN', severity: 'warning', profile: 'xrechnung', terms: ['BT-84'],
    description: 'IBANs should match the standard shape.',
    check(inv) {
      const out: Violation[] = [];
      (inv.payment?.creditTransfers ?? []).forEach((ct, idx) => {
        if (present(ct.iban) && !IBAN_RE.test((ct.iban as string).replace(/\s+/g, ''))) {
          out.push(violation({ id: 'IG-DE-IBAN', severity: 'warning', terms: ['BT-84'] },
            `"${ct.iban}" does not look like a valid IBAN.`,
            { path: `payment.creditTransfers[${idx}].iban`, value: ct.iban }));
        }
      });
      return out.length ? out : null;
    },
  },
  {
    id: 'IG-DE-W1', severity: 'warning', profile: 'xrechnung', terms: ['BT-49'],
    description: 'The buyer should have an electronic address for automated routing.',
    check(inv) {
      if (!inv.buyer) return null;
      return present(inv.buyer.electronicAddress)
        ? null
        : [violation({ id: 'IG-DE-W1', severity: 'warning', terms: ['BT-49'] },
            'Buyer electronic address (BT-49) is missing — Peppol delivery and many workflow systems need it.')];
    },
  },
];
