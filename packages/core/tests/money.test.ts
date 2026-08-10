import { describe, expect, it } from 'vitest';
import {
  add,
  currencyScale,
  formatMoney,
  fromDecimal,
  lineNet,
  PRICE_SCALE,
  rescale,
  money,
  multiply,
  parseMoney,
  percentOf,
  subtract,
  sum,
  toDecimal,
  toFixedString,
  withComputedTotals,
} from '../src/index.js';

/**
 * These tests exist because the invoice builder shows a total to a human and
 * then puts a total in an XML document, and those two numbers must be the
 * same number. Every case below is one where naive `+` and `*` on JavaScript
 * numbers gives a different answer.
 */
describe('money', () => {
  it('adds amounts that float addition gets wrong', () => {
    // 0.1 + 0.2 === 0.30000000000000004
    const total = add(fromDecimal(0.1), fromDecimal(0.2));
    expect(total.units).toBe(30);
    expect(toDecimal(total)).toBe(0.3);
  });

  it('stays exact over a long invoice', () => {
    // 100 lines of 0.07 is 7.00 exactly; summing floats drifts off it.
    const lines = Array.from({ length: 100 }, () => fromDecimal(0.07));
    expect(toFixedString(sum(lines))).toBe('7.00');
    const naive = lines.reduce((s, m) => s + toDecimal(m), 0);
    expect(naive).not.toBe(7); // the bug this module exists to avoid
  });

  it('rounds halves away from zero, including negatives', () => {
    expect(fromDecimal(1.005).units).toBe(101);
    expect(fromDecimal(2.675).units).toBe(268);
    // Credit notes carry negative amounts; -1.005 must not round to -1.00.
    expect(fromDecimal(-1.005).units).toBe(-101);
    expect(percentOf(money(-1005, 2), 100).units).toBe(-1005);
  });

  it('computes a line net by rounding once, at the end', () => {
    // 3 × €0.335 = €1.005 → €1.01. Rounding the price to €0.34 first, as a
    // 2dp-only money type is forced to, gives €1.02 — a cent wrong.
    const price = fromDecimal(0.335, PRICE_SCALE);
    expect(toFixedString(lineNet(price, 3))).toBe('1.01');
    expect(toFixedString(lineNet(fromDecimal(0.34), 3))).toBe('1.02');
    // Fractional quantities are ordinary: 7.5 hours at £82.50.
    expect(toFixedString(lineNet(fromDecimal(82.5, PRICE_SCALE), 7.5))).toBe('618.75');
  });

  it('honours the base quantity a price is quoted per', () => {
    // €12.00 per 100 sheets, 250 sheets ordered.
    expect(toFixedString(lineNet(fromDecimal(12, PRICE_SCALE), 250, 100))).toBe('30.00');
    // A zero base quantity must not produce Infinity in an invoice total.
    expect(toFixedString(lineNet(fromDecimal(12, PRICE_SCALE), 250, 0))).toBe('3000.00');
  });

  it('rescales prices to currency exactly once', () => {
    expect(rescale(fromDecimal(1.005, PRICE_SCALE), 2).units).toBe(101);
    expect(rescale(fromDecimal(-1.005, PRICE_SCALE), 2).units).toBe(-101);
    expect(rescale(fromDecimal(12.34, 2), PRICE_SCALE).units).toBe(123400);
  });

  it('applies VAT rates exactly', () => {
    expect(toFixedString(percentOf(fromDecimal(314.86), 7))).toBe('22.04');
    expect(toFixedString(percentOf(fromDecimal(2450), 20))).toBe('490.00');
    expect(toFixedString(percentOf(fromDecimal(10.05), 10))).toBe('1.01');
  });

  it('agrees with the engine’s own totals arithmetic', () => {
    // The builder computes what it displays; the engine computes what it
    // writes. A disagreement here is a cent of difference on a real invoice.
    const netPrice = 82.5;
    const quantity = 7.5;
    const rate = 20;
    const invoice = withComputedTotals({
      lines: [{ quantity, price: { netPrice }, vat: { categoryCode: 'S', rate } }],
    });
    const ourNet = lineNet(fromDecimal(netPrice), quantity);
    const ourVat = percentOf(ourNet, rate);
    expect(invoice.totals?.sumOfLineNet).toBe(toDecimal(ourNet));
    expect(invoice.vatBreakdown?.[0]?.taxAmount).toBe(toDecimal(ourVat));
    expect(invoice.totals?.taxInclusive).toBe(toDecimal(add(ourNet, ourVat)));
  });

  it('parses what humans actually type', () => {
    expect(parseMoney('1,234.56')?.units).toBe(123456);
    expect(parseMoney('1.234,56')?.units).toBe(123456);
    expect(parseMoney('£2,450.00')?.units).toBe(245000);
    expect(parseMoney('  19,99 € ')?.units).toBe(1999);
    expect(parseMoney('-45')?.units).toBe(-4500);
    expect(parseMoney(12.5)?.units).toBe(1250);
    // Empty and nonsense are distinguishable from zero, so an untouched field
    // does not silently become 0.00 on the invoice.
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney('0')?.units).toBe(0);
  });

  it('knows which currencies do not have cents', () => {
    expect(currencyScale('EUR')).toBe(2);
    expect(currencyScale('jpy')).toBe(0);
    expect(currencyScale('KWD')).toBe(3);
    expect(currencyScale(undefined)).toBe(2);
    // Unknown codes fall back to 2dp rather than throwing mid-invoice.
    expect(currencyScale('XYZ')).toBe(2);
  });

  it('refuses to combine different scales rather than silently mis-adding', () => {
    expect(() => add(money(100, 2), money(100, 0))).toThrow(/different scale/);
  });

  it('survives non-finite input instead of writing NaN to an invoice', () => {
    expect(fromDecimal(Number.NaN).units).toBe(0);
    expect(multiply(fromDecimal(10), Number.POSITIVE_INFINITY).units).toBe(0);
    expect(percentOf(fromDecimal(10), Number.NaN).units).toBe(0);
    expect(toFixedString(lineNet(fromDecimal(10), Number.NaN))).toBe('0.00');
  });

  it('formats for display and for XML differently', () => {
    const amount = fromDecimal(2940);
    expect(formatMoney(amount, 'GBP', 'en-GB')).toBe('£2,940.00');
    // XML carries a bare decimal — no grouping, no symbol.
    expect(toFixedString(amount)).toBe('2940.00');
    expect(toFixedString(subtract(amount, fromDecimal(0.01)))).toBe('2939.99');
  });
});
