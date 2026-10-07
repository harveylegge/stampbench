/**
 * Pins the payment webhook's pure decisions (workers/api/src/payment-hook.ts):
 * payload parsing for the three shapes, invoice matching, deterministic ids,
 * and: most load-bearing: that a server-built draft satisfies every guard
 * the browser applies before rendering it. The client silently DROPS any
 * pulled row whose payload fails those guards, so drift between the worker's
 * structural draft and the real InvoiceDraft must fail here, loudly, not in
 * production as invoices that never appear.
 */
import { describe, expect, it } from 'vitest';

import {
  autoInvoiceId,
  buildAutoDraft,
  decideHookAction,
  marketForCurrency,
  parsePaymentEvent,
  type PaymentEvent,
} from '../../../workers/api/src/payment-hook';
import { computeDraftTotals, decimals, toDecimal } from '@/lib/invoice/build';
import { emptyDraft, type InvoiceDraft } from '@/lib/invoice/draft';
import { invoiceStatus } from '@/lib/invoice/status';
import { isMarketId } from '@/lib/markets';

const NOW = new Date('2026-08-25T12:00:00Z');

function genericEvent(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  const parsed = parsePaymentEvent({
    amount: '149.50',
    currency: 'GBP',
    payerName: 'Acme GmbH',
    payerEmail: 'ap@acme.de',
    description: 'August retainer',
    id: 'pay_8f3k2',
    date: '2026-08-25',
  });
  expect(parsed).not.toBeNull();
  return { ...parsed!, ...overrides };
}

describe('parsePaymentEvent: generic shape', () => {
  it('accepts the documented shape', () => {
    const e = genericEvent();
    expect(e.provider).toBe('generic');
    expect(e.amount).toBe('149.50');
    expect(e.currency).toBe('GBP');
    expect(e.payerName).toBe('Acme GmbH');
    expect(e.reference).toBe('pay_8f3k2');
    expect(e.occurredOn).toBe('2026-08-25');
    expect(e.invoiceNumber).toBeNull();
  });

  it('accepts number amounts and comma decimals, and upcases currency', () => {
    expect(parsePaymentEvent({ amount: 149.5, currency: 'gbp' })).toMatchObject({
      amount: '149.50',
      currency: 'GBP',
    });
    expect(parsePaymentEvent({ amount: '99,90', currency: 'EUR' })).toMatchObject({ amount: '99.90' });
  });

  it('reads snake_case aliases and the nested payer object', () => {
    const e = parsePaymentEvent({
      amount: '10',
      currency: 'EUR',
      invoice_number: 'INV-7',
      payer: { name: 'N', email: 'e@x.y' },
    });
    expect(e).toMatchObject({ invoiceNumber: 'INV-7', payerName: 'N', payerEmail: 'e@x.y' });
  });

  it('rejects payloads without a usable amount and currency', () => {
    expect(parsePaymentEvent({})).toBeNull();
    expect(parsePaymentEvent({ amount: '10' })).toBeNull();
    expect(parsePaymentEvent({ amount: '-5', currency: 'EUR' })).toBeNull();
    expect(parsePaymentEvent({ amount: 'lots', currency: 'EUR' })).toBeNull();
    expect(parsePaymentEvent({ amount: '10', currency: 'EURO' })).toBeNull();
    expect(parsePaymentEvent(null)).toBeNull();
    expect(parsePaymentEvent('paid')).toBeNull();
  });

  it('rejects a zero amount so no $0 invoice is created', () => {
    expect(parsePaymentEvent({ amount: '0', currency: 'EUR' })).toBeNull();
    expect(parsePaymentEvent({ amount: 0, currency: 'EUR' })).toBeNull();
    expect(parsePaymentEvent({ amount: '0.00', currency: 'GBP' })).toBeNull();
  });
});

describe('parsePaymentEvent: Stripe', () => {
  it('reads checkout.session.completed in minor units', () => {
    const e = parsePaymentEvent({
      object: 'event',
      id: 'evt_1',
      type: 'checkout.session.completed',
      created: 1787011200,
      data: {
        object: {
          id: 'cs_123',
          amount_total: 14950,
          currency: 'gbp',
          customer_details: { name: 'Acme', email: 'a@b.c' },
          metadata: { invoice_number: 'INV-42' },
        },
      },
    });
    expect(e).toMatchObject({
      provider: 'stripe',
      amount: '149.50',
      currency: 'GBP',
      payerName: 'Acme',
      invoiceNumber: 'INV-42',
      reference: 'cs_123',
    });
  });

  it('does not divide zero-decimal currencies', () => {
    const jpy = parsePaymentEvent({
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1', amount_received: 5000, currency: 'jpy' } },
    });
    expect(jpy?.amount).toBe('5000');
    // XOF is genuinely zero-decimal on Stripe (regression for the old set).
    const xof = parsePaymentEvent({
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_x', amount_received: 1500, currency: 'xof' } },
    });
    expect(xof?.amount).toBe('1500');
  });

  it('divides HUF/TWD/UGX by 100: Stripe sends them ×100 despite ISO zero-decimal', () => {
    const huf = parsePaymentEvent({
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_h', amount_received: 500000, currency: 'huf' } },
    });
    expect(huf?.amount).toBe('5000.00');
  });

  it('divides three-decimal currencies by 1000 (KWD), not 100', () => {
    const kwd = parsePaymentEvent({
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_k', amount_total: 5000, currency: 'kwd', payment_status: 'paid' } },
    });
    expect(kwd?.amount).toBe('5.000');
  });

  it('gates checkout.session.completed on payment_status and accepts the delayed-settlement event', () => {
    const base = (payment_status: string, type = 'checkout.session.completed') => ({
      object: 'event',
      type,
      data: { object: { id: 'cs_1', amount_total: 2000, currency: 'eur', payment_status } },
    });
    expect(parsePaymentEvent(base('unpaid'))).toBeNull();
    expect(parsePaymentEvent(base('paid'))?.amount).toBe('20.00');
    expect(parsePaymentEvent(base('no_payment_required'))?.amount).toBe('20.00');
    expect(
      parsePaymentEvent(base('paid', 'checkout.session.async_payment_succeeded'))?.amount,
    ).toBe('20.00');
  });

  it('reads invoice.paid and takes the invoice number from the object', () => {
    const e = parsePaymentEvent({
      object: 'event',
      type: 'invoice.paid',
      data: {
        object: { id: 'in_1', amount_paid: 9900, currency: 'eur', number: 'F-2026-01', customer_email: 'x@y.z' },
      },
    });
    expect(e).toMatchObject({ amount: '99.00', invoiceNumber: 'F-2026-01', payerEmail: 'x@y.z' });
  });

  it('ignores Stripe event types that are not payments: a refund must not become an invoice', () => {
    expect(
      parsePaymentEvent({
        object: 'event',
        type: 'charge.refunded',
        data: { object: { id: 'ch_1', amount: 5000, currency: 'gbp' } },
      }),
    ).toBeNull();
  });
});

describe('parsePaymentEvent: PayPal', () => {
  it('reads PAYMENT.CAPTURE.COMPLETED with invoice_id', () => {
    const e = parsePaymentEvent({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: '3C679366HH908993F',
        amount: { value: '29.00', currency_code: 'GBP' },
        invoice_id: 'INV-2026-000007',
        create_time: '2026-08-25T09:00:00Z',
      },
    });
    expect(e).toMatchObject({
      provider: 'paypal',
      amount: '29.00',
      currency: 'GBP',
      invoiceNumber: 'INV-2026-000007',
      occurredOn: '2026-08-25',
    });
  });

  it('reads legacy PAYMENT.SALE.COMPLETED', () => {
    const e = parsePaymentEvent({
      event_type: 'PAYMENT.SALE.COMPLETED',
      resource: { id: 'S1', amount: { total: '15.00', currency: 'EUR' }, invoice_number: 'R-9' },
    });
    expect(e).toMatchObject({ amount: '15.00', currency: 'EUR', invoiceNumber: 'R-9' });
  });

  it('ignores non-payment PayPal events', () => {
    expect(
      parsePaymentEvent({ event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: { id: 'I-1' } }),
    ).toBeNull();
  });
});

describe('decideHookAction', () => {
  const rows = [
    { id: 'a1', number: 'INV-2026-000001', status: 'created' },
    { id: 'a2', number: 'INV-2026-000002', status: 'paid' },
  ];

  it('matches case-insensitively with stray whitespace and marks paid', () => {
    const e = genericEvent({ invoiceNumber: ' inv-2026-000001 ' });
    expect(decideHookAction(e, rows)).toEqual({ action: 'mark_paid', id: 'a1' });
  });

  it('reports an already-paid match instead of re-marking it', () => {
    const e = genericEvent({ invoiceNumber: 'INV-2026-000002' });
    expect(decideHookAction(e, rows)).toEqual({ action: 'already_paid', id: 'a2' });
  });

  it('creates when nothing matches or no number was given', () => {
    expect(decideHookAction(genericEvent({ invoiceNumber: 'INV-9999' }), rows)).toEqual({ action: 'create' });
    expect(decideHookAction(genericEvent(), rows)).toEqual({ action: 'create' });
  });

  it('marks the outstanding invoice when a number collides across a paid and an unpaid row', () => {
    const collide = [
      { id: 'dup-paid', number: 'INV-DUP', status: 'paid' },
      { id: 'dup-open', number: 'INV-DUP', status: 'created' },
    ];
    expect(decideHookAction(genericEvent({ invoiceNumber: 'INV-DUP' }), collide)).toEqual({
      action: 'mark_paid',
      id: 'dup-open',
    });
  });
});

describe('autoInvoiceId', () => {
  it('is deterministic per user + reference (so provider retries dedupe), and fits the route regex', async () => {
    const e = genericEvent();
    const id1 = await autoInvoiceId('user-1', e, 'nonce-a');
    const id2 = await autoInvoiceId('user-1', e, 'nonce-b'); // fallback ignored when a reference exists
    const other = await autoInvoiceId('user-2', e, 'nonce-a');
    expect(id1).toBe(id2);
    expect(other).not.toBe(id1);
    expect(id1).toMatch(/^wh[a-f0-9]{32}$/);
    expect(id1).toMatch(/^[A-Za-z0-9_-]{6,64}$/);
  });

  it('gives each reference-less delivery its own id, so distinct payments never collapse', async () => {
    const e = genericEvent({ reference: '' });
    // Two genuinely distinct same-content payments -> different nonces -> different rows.
    expect(await autoInvoiceId('u', e, 'delivery-1')).not.toBe(await autoInvoiceId('u', e, 'delivery-2'));
    // The same nonce is stable (a test can reproduce it), still 'wh'-prefixed.
    expect(await autoInvoiceId('u', e, 'delivery-1')).toBe(await autoInvoiceId('u', e, 'delivery-1'));
    expect(await autoInvoiceId('u', e, 'delivery-1')).toMatch(/^wh[a-f0-9]{32}$/);
  });
});

describe('buildAutoDraft: must satisfy every client-side guard', () => {
  const event = genericEvent();

  async function build(e: PaymentEvent = event) {
    const id = await autoInvoiceId('user-1', e);
    // The JSON round trip is the real interface: the worker stores a string,
    // the browser parses it back.
    return JSON.parse(JSON.stringify(buildAutoDraft(e, NOW, id))) as InvoiceDraft;
  }

  it('mirrors the real InvoiceDraft key-for-key, so drift fails here', async () => {
    const draft = await build();
    const reference = emptyDraft('uk', NOW);
    const keysOf = (o: object) => Object.keys(o).sort();
    // logo is optional and deliberately absent from webhook drafts.
    expect(keysOf(draft)).toEqual(keysOf(reference).filter((k) => k !== 'logo'));
    expect(keysOf(draft.seller)).toEqual(keysOf(reference.seller));
    expect(keysOf(draft.buyer)).toEqual(keysOf(reference.buyer));
    expect(keysOf(draft.document)).toEqual(keysOf(reference.document));
    expect(keysOf(draft.lines[0]!)).toEqual(keysOf(reference.lines[0]!));
    expect(keysOf(draft.payment)).toEqual(keysOf(reference.payment));
  });

  it('passes the sync-pull and history guards', async () => {
    const draft = await build();
    expect(Array.isArray(draft.lines)).toBe(true);
    expect(isMarketId(draft.market)).toBe(true);
  });

  it('totals to exactly the payment, settled', async () => {
    const draft = await build();
    const totals = computeDraftTotals(draft);
    expect(decimals(totals)).toEqual({ net: 149.5, tax: 0, gross: 149.5 });
    expect(toDecimal(totals.balance)).toBe(0);
  });

  it('renders as a paid invoice in the list', async () => {
    const draft = await build();
    const entry = { id: 'wh-x', savedAt: NOW.getTime(), paidAt: NOW.getTime(), draft };
    expect(invoiceStatus(entry, '2026-09-30')).toBe('paid');
    expect(draft.document.number).toMatch(/^AUTO-20260825-[A-Z0-9]{6}$/);
    expect(draft.document.note).toContain('Auto-created');
  });

  it('uses the unmatched invoice number as the document number', async () => {
    const draft = await build(genericEvent({ invoiceNumber: 'INV-77' }));
    expect(draft.document.number).toBe('INV-77');
  });

  it('guesses market and format from the currency', () => {
    expect(marketForCurrency('GBP')).toMatchObject({ market: 'uk', formatId: 'en16931-ubl' });
    expect(marketForCurrency('USD')).toMatchObject({ market: 'us', formatId: 'commercial' });
    expect(marketForCurrency('EUR').market).toBe('eu');
    expect(isMarketId(marketForCurrency('CHF').market)).toBe(true);
  });
});
