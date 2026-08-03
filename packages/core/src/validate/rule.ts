import type { Invoice } from '../model/invoice.js';

export type Severity = 'error' | 'warning';

export type Profile = 'en16931' | 'xrechnung';

/** A single failed check. */
export interface Violation {
  /** Rule identifier — official EN 16931 / XRechnung ids (BR-*, BR-CO-*, BR-DE-*) or InvoiceGate diagnostics (IG-*). */
  ruleId: string;
  severity: Severity;
  /** Human-readable description of what failed, in our own words. */
  message: string;
  /** The business term(s) involved, e.g. "BT-10". */
  terms?: string[];
  /** JSON-path-ish pointer into the semantic model, e.g. "lines[2].quantity". */
  path?: string;
  /** The offending value, when useful. */
  value?: string | number;
}

export interface Rule {
  id: string;
  severity: Severity;
  profile: Profile;
  /** What the rule checks, in our own words. */
  description: string;
  terms?: string[];
  /** Return violations (empty array or null when the rule passes). */
  check(invoice: Invoice): Violation[] | null;
}

/**
 * Tolerance for the EN 16931 summation rules (BR-CO-10/13/14/15/16). These are
 * *exact* equalities over amounts already stated to 2 decimals, so the only
 * slack we allow is float-representation noise — half a cent is far below the
 * smallest real 2dp difference (0.01) yet far above accumulated float error.
 * A genuine one-cent discrepancy is a real error the official validator rejects,
 * so it must fail here too.
 */
export const SUM_TOLERANCE = 0.005;

/**
 * Tolerance for the multiplication rule BR-CO-17 (VAT amount = taxable × rate).
 * EN 16931 permits ±0.01 here because rounding methods (half-up vs half-even)
 * can legitimately differ by a cent on the product.
 */
export const ROUNDING_TOLERANCE = 0.01;

/** @deprecated Use {@link SUM_TOLERANCE} or {@link ROUNDING_TOLERANCE}. */
export const AMOUNT_TOLERANCE = SUM_TOLERANCE;

export function amountsEqual(a: number, b: number, tolerance = SUM_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** True when a value is present and non-empty. */
export function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
}

/** Helper to build a violation from a rule. */
export function violation(
  rule: Pick<Rule, 'id' | 'severity' | 'terms'>,
  message: string,
  extra?: Partial<Pick<Violation, 'path' | 'value' | 'terms'>>,
): Violation {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    message,
    terms: extra?.terms ?? rule.terms,
    ...(extra?.path !== undefined ? { path: extra.path } : {}),
    ...(extra?.value !== undefined ? { value: extra.value } : {}),
  };
}
