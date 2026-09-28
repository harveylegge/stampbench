/**
 * Inbound payment webhook → invoice rows (auto-invoicing).
 *
 * A paid account gets one secret URL (/api/hooks/payment/<token>). Point a
 * payment provider — or anything that can POST JSON — at it, and a received
 * payment either marks the matching invoice paid or creates a draft invoice
 * in the account's saved list, where the browser's normal sync picks it up.
 *
 * Everything in this file is pure decision-making so the web test suite can
 * exercise it directly; D1 and routing stay in index.ts. Three payload shapes
 * are understood: Stripe events, PayPal webhook events, and a documented
 * generic shape for everything else (Zapier, custom code, other PSPs).
 *
 * Signatures are NOT verified here on purpose: these are the *merchant's*
 * provider accounts, whose signing secrets Stampbench does not hold. The
 * secret URL is the authentication, and the blast radius of a leaked URL is
 * bounded — it can only create draft rows or mark invoices paid on that one
 * account, never move money or read anything back.
 */

import { sha256Hex } from './auth';

/** One normalised payment, whatever shape it arrived in. */
export interface PaymentEvent {
  provider: 'stripe' | 'paypal' | 'generic';
  /** Major units, as a decimal string ("150" or "149.50"). */
  amount: string;
  /** Upper-case ISO 4217 code. */
  currency: string;
  /** The invoice the payer says they are paying, when the payload names one. */
  invoiceNumber: string | null;
  payerName: string;
  payerEmail: string;
  /** Provider-side id of the payment, for the note and for dedup. */
  reference: string;
  description: string;
  /** ISO day (YYYY-MM-DD) the payment happened, when the payload says. */
  occurredOn: string | null;
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Stripe's amount representation, which is NOT plain ISO 4217 minor units.
 *  - ZERO_DECIMAL: the webhook amount already IS whole major units.
 *  - THREE_DECIMAL: sent multiplied by 1000 (smallest unit is a thousandth).
 *  - Everything else: sent multiplied by 100.
 * HUF, TWD and UGX are ISO zero-decimal but Stripe deliberately sends them ×100,
 * so they are absent from ZERO_DECIMAL and correctly fall to the ÷100 branch.
 * Only the Stripe path uses this; PayPal and the generic shape send major units.
 */
const ZERO_DECIMAL = new Set([
  'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'BIF', 'DJF', 'GNF', 'KMF', 'MGA', 'PYG', 'RWF', 'VUV', 'XAF', 'XOF', 'XPF',
]);
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

function minorToMajor(minor: number, currency: string): string {
  if (!Number.isFinite(minor) || minor <= 0) return '';
  if (ZERO_DECIMAL.has(currency)) return String(Math.round(minor));
  if (THREE_DECIMAL.has(currency)) return (Math.round(minor) / 1000).toFixed(3);
  return (Math.round(minor) / 100).toFixed(2);
}

/** A positive decimal-string amount from a "major units" field ("149.5", 149.5). */
function majorAmount(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v.toFixed(2);
  if (typeof v === 'string' && /^\d{1,10}([.,]\d{1,4})?$/.test(v.trim())) {
    const s = v.trim().replace(',', '.');
    if (Number(s) > 0) return s;
  }
  return '';
}

function isoDayOf(v: unknown): string | null {
  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    // Stripe sends epoch seconds; anything past ~2001 in ms is clearly ms.
    const ms = v > 10_000_000_000 ? v : v * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

type Dict = Record<string, unknown>;
const dict = (v: unknown): Dict => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {});

function parseStripe(body: Dict): PaymentEvent | null {
  const type = str(body.type, 64);
  const obj = dict(dict(body.data).object);
  const currency = str(obj.currency, 8).toUpperCase();
  if (!currency) return null;

  let amount = '';
  let payerName = '';
  let payerEmail = '';
  let invoiceNumber = '';
  const metadata = dict(obj.metadata);

  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    // A completed session is 'unpaid' for delayed-notification methods (SEPA,
    // Bacs, boleto, OXXO, Konbini) until funds settle via
    // async_payment_succeeded; setup/zero sessions are 'no_payment_required'.
    // Count only money actually received.
    const payStatus = str(obj.payment_status, 32);
    if (payStatus && payStatus !== 'paid' && payStatus !== 'no_payment_required') return null;
    amount = minorToMajor(Number(obj.amount_total), currency);
    const who = dict(obj.customer_details);
    payerName = str(who.name, 160);
    payerEmail = str(who.email, 160);
  } else if (type === 'payment_intent.succeeded') {
    amount = minorToMajor(Number(obj.amount_received ?? obj.amount), currency);
    payerEmail = str(obj.receipt_email, 160);
  } else if (type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
    amount = minorToMajor(Number(obj.amount_paid), currency);
    payerName = str(obj.customer_name, 160);
    payerEmail = str(obj.customer_email, 160);
    invoiceNumber = str(obj.number, 80);
  } else {
    // An event type we do not understand is not an error — providers send
    // plenty — but it is also not a payment we can act on.
    return null;
  }
  if (!amount) return null;

  return {
    provider: 'stripe',
    amount,
    currency,
    invoiceNumber: str(metadata.invoice_number, 80) || invoiceNumber || null,
    payerName,
    payerEmail,
    reference: str(obj.id, 80) || str(body.id, 80),
    description: str(obj.description, 300),
    occurredOn: isoDayOf(body.created),
  };
}

function parsePaypal(body: Dict): PaymentEvent | null {
  const type = str(body.event_type, 64);
  const resource = dict(body.resource);

  if (type === 'PAYMENT.CAPTURE.COMPLETED') {
    const amount = dict(resource.amount);
    const value = majorAmount(amount.value);
    const currency = str(amount.currency_code, 8).toUpperCase();
    if (!value || !currency) return null;
    return {
      provider: 'paypal',
      amount: value,
      currency,
      invoiceNumber: str(resource.invoice_id, 80) || null,
      payerName: '',
      payerEmail: '',
      reference: str(resource.id, 80),
      description: str(resource.note_to_payer, 300),
      occurredOn: isoDayOf(resource.create_time) ?? isoDayOf(body.create_time),
    };
  }
  if (type === 'PAYMENT.SALE.COMPLETED') {
    const amount = dict(resource.amount);
    const value = majorAmount(amount.total);
    const currency = str(amount.currency, 8).toUpperCase();
    if (!value || !currency) return null;
    return {
      provider: 'paypal',
      amount: value,
      currency,
      invoiceNumber: str(resource.invoice_number, 80) || null,
      payerName: '',
      payerEmail: '',
      reference: str(resource.id, 80),
      description: '',
      occurredOn: isoDayOf(resource.create_time) ?? isoDayOf(body.create_time),
    };
  }
  return null;
}

function parseGeneric(body: Dict): PaymentEvent | null {
  const amount = majorAmount(body.amount);
  const currency = str(body.currency, 8).toUpperCase();
  if (!amount || !/^[A-Z]{3}$/.test(currency)) return null;
  const payer = dict(body.payer);
  return {
    provider: 'generic',
    amount,
    currency,
    invoiceNumber:
      str(body.invoiceNumber, 80) || str(body.invoice_number, 80) || str(body.reference, 80) || null,
    payerName: str(body.payerName, 160) || str(body.payer_name, 160) || str(payer.name, 160),
    payerEmail: str(body.payerEmail, 160) || str(body.payer_email, 160) || str(payer.email, 160),
    reference: str(body.id, 80) || str(body.eventId, 80) || str(body.event_id, 80),
    description: str(body.description, 300),
    occurredOn: isoDayOf(body.date) ?? isoDayOf(body.paidAt),
  };
}

/**
 * Normalise whatever arrived into one PaymentEvent, or null when the payload
 * is not a payment we can act on. Provider shapes are detected before the
 * generic one so a Stripe refund event cannot fall through and be misread as
 * a generic payment.
 */
export function parsePaymentEvent(body: unknown): PaymentEvent | null {
  const b = dict(body);
  if (b.object === 'event' && typeof b.type === 'string') return parseStripe(b);
  if (typeof b.event_type === 'string' && b.resource !== undefined) return parsePaypal(b);
  return parseGeneric(b);
}

/** The subset of an invoices row the match decision needs. */
export interface InvoiceCandidate {
  id: string;
  number: string;
  status: string;
}

export type HookAction =
  | { action: 'mark_paid'; id: string }
  | { action: 'already_paid'; id: string }
  | { action: 'create' };

/**
 * Match by invoice number — the one identity that survives the round trip
 * between browser and account (row ids are client-minted). Case-insensitive
 * and trimmed, because payment references get retyped by humans.
 */
export function decideHookAction(event: PaymentEvent, rows: InvoiceCandidate[]): HookAction {
  const wanted = event.invoiceNumber?.trim().toLowerCase();
  if (wanted) {
    const matches = rows.filter((r) => r.number.trim().toLowerCase() === wanted);
    if (matches.length) {
      // Prefer an outstanding match, so a payment against a number that was
      // reused (credit note, resend) settles the invoice still owed rather
      // than an arbitrary row.
      const unpaid = matches.find((r) => r.status !== 'paid');
      return unpaid ? { action: 'mark_paid', id: unpaid.id } : { action: 'already_paid', id: matches[0]!.id };
    }
  }
  return { action: 'create' };
}

/**
 * Row id for a created invoice. When the payment carries its own reference the
 * id is deterministic, so a provider's retry collides on the primary key
 * (INSERT OR IGNORE) instead of duplicating. When there is NO reference we
 * cannot tell a retry from a genuinely distinct same-amount payment — and
 * silently dropping real money is the worse failure — so the caller passes a
 * per-delivery `fallback` (a random nonce) and every reference-less delivery
 * gets its own row. Senders that want idempotency include an id; the docs say
 * so. The `wh` prefix is load-bearing: it marks auto rows for the rolling
 * archive so they never evict a user's own saved invoices.
 */
export async function autoInvoiceId(userId: string, event: PaymentEvent, fallback = ''): Promise<string> {
  const identity = event.reference || fallback;
  const hash = await sha256Hex(`${userId}:${event.provider}:${identity}`);
  return `wh${hash.slice(0, 32)}`;
}

// ------------------------------------------------------------ draft building

/**
 * Structural mirror of the builder's InvoiceDraft (apps/web/lib/invoice/
 * draft.ts). Duplicated on purpose: importing the web module would drag its
 * path aliases and market tables into the worker build. The web test suite
 * assigns a built draft to the real InvoiceDraft type, so drift between the
 * two shapes fails the build loudly instead of dropping rows silently.
 */
interface AutoParty {
  name: string;
  tradingName: string;
  vatId: string;
  taxRegistrationId: string;
  companyId: string;
  electronicAddress: string;
  electronicAddressScheme: string;
  street: string;
  additionalStreet: string;
  city: string;
  postCode: string;
  subdivision: string;
  countryCode: string;
  contactName: string;
  phone: string;
  email: string;
}

export interface AutoDraft {
  market: string;
  formatId: string;
  seller: AutoParty;
  buyer: AutoParty;
  shipTo: AutoParty;
  shipToEnabled: boolean;
  document: {
    number: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    typeCode: string;
    buyerReference: string;
    orderReference: string;
    contractReference: string;
    deliveryDate: string;
    paymentTerms: string;
    note: string;
  };
  lines: {
    key: string;
    description: string;
    quantity: string;
    unitCode: string;
    unitPrice: string;
    sku: string;
    vatCategory: string;
    vatRate: string;
  }[];
  payment: {
    meansTypeCode: string;
    accountName: string;
    accountId: string;
    providerId: string;
    remittance: string;
  };
  tax: { rate: string };
  discount: { enabled: boolean; mode: 'percent' | 'amount'; value: string };
  shipping: { enabled: boolean; mode: 'percent' | 'amount'; value: string };
  amountPaid: string;
  exemptionReasons: Record<string, never>;
}

const EMPTY_AUTO_PARTY: AutoParty = {
  name: '',
  tradingName: '',
  vatId: '',
  taxRegistrationId: '',
  companyId: '',
  electronicAddress: '',
  electronicAddressScheme: '',
  street: '',
  additionalStreet: '',
  city: '',
  postCode: '',
  subdivision: '',
  countryCode: '',
  contactName: '',
  phone: '',
  email: '',
};

/** Market + seller country guessed from the payment currency. */
export function marketForCurrency(currency: string): { market: string; sellerCountry: string; formatId: string } {
  if (currency === 'GBP') return { market: 'uk', sellerCountry: 'GB', formatId: 'en16931-ubl' };
  if (currency === 'USD') return { market: 'us', sellerCountry: 'US', formatId: 'commercial' };
  if (currency === 'EUR') return { market: 'eu', sellerCountry: '', formatId: 'en16931-ubl' };
  return { market: 'multi', sellerCountry: '', formatId: 'en16931-ubl' };
}

const PROVIDER_LABEL: Record<PaymentEvent['provider'], string> = {
  stripe: 'a Stripe payment',
  paypal: 'a PayPal payment',
  generic: 'a payment',
};

/**
 * A complete, renderable draft for a payment that matched no invoice.
 *
 * The payment is money already received, so the draft documents a settled
 * sale: one zero-VAT line whose gross equals the payment, amountPaid set so
 * the balance due reads zero, and a note that says where it came from. VAT
 * is deliberately NOT guessed — a wrong rate on a legal document is worse
 * than a rate the user has to fill in, and the note says to review it.
 */
export function buildAutoDraft(event: PaymentEvent, now: Date, id: string): AutoDraft {
  const { market, sellerCountry, formatId } = marketForCurrency(event.currency);
  const day = event.occurredOn ?? now.toISOString().slice(0, 10);
  const reference = event.reference ? ` ${event.reference}` : '';
  const number = event.invoiceNumber?.trim() || `AUTO-${day.replace(/-/g, '')}-${id.slice(2, 8).toUpperCase()}`;
  return {
    market,
    formatId,
    seller: { ...EMPTY_AUTO_PARTY, countryCode: sellerCountry },
    buyer: { ...EMPTY_AUTO_PARTY, name: event.payerName, email: event.payerEmail },
    shipTo: { ...EMPTY_AUTO_PARTY, countryCode: sellerCountry },
    shipToEnabled: false,
    document: {
      number,
      issueDate: day,
      dueDate: day,
      currency: event.currency,
      typeCode: '380',
      buyerReference: '',
      orderReference: '',
      contractReference: '',
      deliveryDate: '',
      paymentTerms: 'Paid.',
      note: `Auto-created from ${PROVIDER_LABEL[event.provider]}${reference}. Review the details and VAT before sending.`,
    },
    lines: [
      {
        key: 'wh-line-1',
        description: event.description || 'Payment received',
        quantity: '1',
        unitCode: 'C62',
        unitPrice: event.amount,
        sku: '',
        vatCategory: 'S',
        vatRate: '0',
      },
    ],
    payment: { meansTypeCode: '30', accountName: '', accountId: '', providerId: '', remittance: event.reference },
    tax: { rate: '0' },
    discount: { enabled: false, mode: 'percent', value: '' },
    shipping: { enabled: false, mode: 'amount', value: '' },
    amountPaid: event.amount,
    exemptionReasons: {},
  };
}
