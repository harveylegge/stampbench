/**
 * Exact money arithmetic in minor units.
 *
 * The invoice model stores amounts as plain numbers because that is what UBL
 * and CII carry on the wire, and `round2` keeps the engine's own sums honest.
 * That is fine for validating a document someone else produced. It is not
 * fine for *building* one: an invoice editor adds up dozens of line totals,
 * applies discounts, splits VAT across categories and shows the running total
 * to a human, and every one of those steps in binary floating point is a
 * chance for the number on screen to disagree with the number in the XML by a
 * cent. On a compliance document a cent is not cosmetic — BR-CO-13 and the
 * BR-S/E/Z family reject the whole invoice for it.
 *
 * So the arithmetic happens here, in integer minor units (cents), and floats
 * only ever appear at the boundary where the model demands them.
 *
 * Rounding is half-away-from-zero, which is what the EN 16931 rules assume
 * ("rounded to two decimals") and what `round2` already does for positive
 * amounts. Doing it on integers means -1.005 rounds to -1.01 rather than
 * -1.00, which is the answer a credit note needs.
 */

/** An exact amount, held as a whole number of minor units (e.g. cents). */
export interface Money {
  /** Signed amount in minor units. Always an integer. */
  readonly units: number;
  /** Decimal places the minor unit represents (2 for EUR/GBP/USD). */
  readonly scale: number;
}

/** Currencies whose minor unit is not 1/100. Everything else is assumed 2dp. */
const SCALE_OVERRIDES: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  ISK: 0,
  CLP: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  JOD: 3,
};

/** Minor-unit exponent for an ISO 4217 code. Unknown codes are treated as 2dp. */
export function currencyScale(currencyCode?: string): number {
  if (!currencyCode) return 2;
  return SCALE_OVERRIDES[currencyCode.toUpperCase()] ?? 2;
}

function pow10(n: number): number {
  return 10 ** n;
}

/** Round half away from zero — the direction EN 16931's "rounded to two
 *  decimals" assumes, and the one a credit note needs for negatives. */
function roundHalfAwayFromZero(scaled: number): number {
  return scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
}

/**
 * Multiply by a power of ten *without* a floating-point multiply.
 *
 * `1.005 * 100` is 100.49999999999999, because the double nearest 1.005 is
 * slightly below it — so a naive scaling rounds a VAT amount down by a cent.
 * Shifting the exponent in the decimal string instead asks the number parser
 * for the double nearest the decimal value 100.5, which is exactly
 * representable. The parse is correctly rounded by specification, so this is
 * exact wherever the result fits in a double.
 */
function shiftDecimal(value: number, places: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const [mantissa, exponent] = value.toExponential().split('e');
  return Number(`${mantissa}e${Number(exponent) + places}`);
}

export function money(units: number, scale = 2): Money {
  return { units: Math.trunc(units), scale };
}

export const ZERO = money(0);

/** Build from a decimal number (e.g. 12.34 → 1234 units at scale 2). */
export function fromDecimal(value: number, scale = 2): Money {
  if (!Number.isFinite(value)) return money(0, scale);
  return money(roundHalfAwayFromZero(shiftDecimal(value, scale)), scale);
}

/**
 * Move an amount to a different number of decimal places, rounding once.
 *
 * Unit prices are the reason this exists: EN 16931 does not constrain BT-146
 * to two decimals (€0.335 per unit is a legitimate price), so prices are held
 * at `PRICE_SCALE` and only the *line amount* comes back to currency scale.
 * Rounding the price first and then multiplying is the classic way to be a
 * cent out on a long line.
 */
export function rescale(m: Money, scale: number): Money {
  if (m.scale === scale) return m;
  const factor = pow10(Math.abs(scale - m.scale));
  return scale > m.scale
    ? money(m.units * factor, scale)
    : money(roundHalfAwayFromZero(m.units / factor), scale);
}

/**
 * Decimal places unit prices are held at. Four is what the UBL generator
 * emits for BT-146, so the builder and the document agree on precision.
 */
export const PRICE_SCALE = 4;

/**
 * Build from user input. Accepts "1,234.56", "1.234,56", "£1,234.56" and
 * plain numbers, because an invoice editor is typed into by humans who use
 * whichever separators their locale taught them. Returns null when the text
 * is not a number at all, so the caller can tell "empty" from "zero".
 */
export function parseMoney(input: string | number | null | undefined, scale = 2): Money | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? fromDecimal(input, scale) : null;

  const cleaned = input.replace(/[^\d.,\-+]/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '+') return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalised: string;
  if (lastComma === -1 && lastDot === -1) {
    normalised = cleaned;
  } else if (lastComma > lastDot) {
    // "1.234,56" — comma is the decimal separator.
    normalised = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // "1,234.56" — dot is the decimal separator.
    normalised = cleaned.replace(/,/g, '');
  }
  const value = Number(normalised);
  return Number.isFinite(value) ? fromDecimal(value, scale) : null;
}

/** Back to the plain number the invoice model stores. */
export function toDecimal(m: Money): number {
  return m.units / pow10(m.scale);
}

function assertSameScale(a: Money, b: Money): void {
  if (a.scale !== b.scale) {
    throw new Error(`Cannot combine amounts of different scale (${a.scale} and ${b.scale}).`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameScale(a, b);
  return money(a.units + b.units, a.scale);
}

export function subtract(a: Money, b: Money): Money {
  assertSameScale(a, b);
  return money(a.units - b.units, a.scale);
}

export function sum(amounts: Money[], scale = 2): Money {
  return amounts.reduce((total, m) => add(total, m), money(0, scale));
}

export function negate(a: Money): Money {
  return money(-a.units, a.scale);
}

export function isZero(a: Money): boolean {
  return a.units === 0;
}

export function isNegative(a: Money): boolean {
  return a.units < 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.scale === b.scale && a.units === b.units;
}

export function compare(a: Money, b: Money): number {
  assertSameScale(a, b);
  return a.units === b.units ? 0 : a.units < b.units ? -1 : 1;
}

/**
 * Multiply by a quantity that may itself have decimals (2.5 hours, 0.75 kg).
 * The quantity is exact input, so the only rounding is the final one back to
 * minor units — no intermediate value is ever rounded and re-used.
 */
export function multiply(a: Money, factor: number): Money {
  if (!Number.isFinite(factor)) return money(0, a.scale);
  return money(roundHalfAwayFromZero(a.units * factor), a.scale);
}

/** Apply a percentage (VAT rate, discount rate). 19 means 19%. */
export function percentOf(a: Money, percentage: number): Money {
  if (!Number.isFinite(percentage)) return money(0, a.scale);
  return money(roundHalfAwayFromZero((a.units * percentage) / 100), a.scale);
}

/**
 * A line's net amount: quantity × unit price, scaled by the base quantity the
 * price is quoted per (BT-149/BT-150 — "€12.00 per 100 sheets").
 *
 * The price arrives at whatever precision it was entered at (normally
 * `PRICE_SCALE`); the multiplication happens in integer units and the single
 * rounding is the rescale to currency at the end. Three units at €0.335 is
 * €1.005 → €1.01, not the €1.02 you get by rounding the price to €0.34 first.
 */
export function lineNet(unitPrice: Money, quantity: number, baseQuantity = 1, scale = 2): Money {
  const base = baseQuantity && Number.isFinite(baseQuantity) && baseQuantity !== 0 ? baseQuantity : 1;
  const factor = (Number.isFinite(quantity) ? quantity : 0) / base;
  return rescale(multiply(unitPrice, factor), scale);
}

/** Format for display. Uses the caller's locale; currency is optional. */
export function formatMoney(m: Money, currencyCode?: string, locale = 'en-GB'): string {
  const value = toDecimal(m);
  try {
    return new Intl.NumberFormat(locale, {
      style: currencyCode ? 'currency' : 'decimal',
      currency: currencyCode,
      minimumFractionDigits: m.scale,
      maximumFractionDigits: m.scale,
    }).format(value);
  } catch {
    // Unknown currency code — show the number and the code beside it rather
    // than throwing inside a render.
    return `${value.toFixed(m.scale)}${currencyCode ? ` ${currencyCode}` : ''}`;
  }
}

/** Plain decimal string, no grouping — what goes into XML. */
export function toFixedString(m: Money): string {
  return toDecimal(m).toFixed(m.scale);
}
