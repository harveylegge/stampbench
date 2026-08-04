/**
 * Repair invoices in place.
 *
 * Validators tell you an invoice is wrong. The question people actually have is
 * *what do I change*. Where a rule can derive the right answer arithmetically —
 * a total that disagrees with the figures it sums — we can answer that exactly,
 * because every violation carries the value it expected and the precise
 * position of the value it found.
 *
 * ## Two rules this module exists to obey
 *
 * **1. Never regenerate the document.** The semantic model is a documented
 * subset of UBL/CII, so `parse → generate` silently discards everything it does
 * not model — measured at 25.9% of elements over the official test suite,
 * including whole nested `SubInvoiceLine` structures. Repairs are therefore
 * *text edits* against the original bytes: everything not being corrected stays
 * byte-for-byte identical, including formatting, comments, namespace prefixes
 * and line endings.
 *
 * **2. Never invent business data.** Only values a rule computed from the rest
 * of the document are ever written. A missing VAT identifier, buyer reference
 * or address has no derivable answer, and guessing one would turn an invoice
 * that is merely invalid into one that is quietly wrong — far worse, because it
 * would then pass validation. Those violations are reported as unfixable, with
 * the reason.
 *
 * The result is verified, not assumed: {@link fixXml} re-validates after
 * editing and discards the whole attempt if the error count did not fall.
 */
import type { Violation } from '../validate/rule.js';
import type { Syntax } from '../validate/index.js';
import { validateXml } from '../validate/index.js';
import { locateViolations, type LocatedViolation } from '../locate/index.js';

/** A single replacement of a value in the source text. */
export interface TextEdit {
  /** 1-based line of the text being replaced. */
  line: number;
  /** 1-based column of the text being replaced. */
  column: number;
  /** The exact text being replaced, as it appears in the document. */
  previous: string;
  /** The text to write in its place. */
  replacement: string;
  /** The rule that justifies this edit. */
  ruleId: string;
  /** Semantic-model path of the field being corrected, when the rule gave one. */
  path?: string;
  /** Why this edit is correct, in one line, for a diff preview or a PR comment. */
  reason: string;
  /**
   * Position in the arithmetic dependency chain, lowest first. Totals are
   * computed from other totals, so a document with a corrupted figure produces
   * contradictory advice: one rule says "this total is wrong", the next says
   * "the total derived from it disagrees". Repairing the most upstream value
   * first and re-deriving is what resolves that — see {@link DEPENDENCY_ORDER}.
   */
  depth: number;
}

/**
 * The EN 16931 totals chain, upstream first:
 * line amounts → VAT breakdown → net total → VAT total → gross total → due.
 *
 * Only the upstream-most level is repaired per round; everything downstream is
 * then recomputed from corrected inputs rather than being dragged into
 * agreement with a corrupted one.
 */
const DEPENDENCY_ORDER: readonly string[] = [
  'vatBreakdown[].taxableAmount',
  'vatBreakdown[].taxAmount',
  'totals.sumOfLineNet',
  'totals.taxExclusive',
  'totals.taxTotal',
  'totals.taxInclusive',
  'totals.amountDue',
];

function dependencyDepth(path: string | undefined): number {
  if (path === undefined) return DEPENDENCY_ORDER.length;
  const key = path.replace(/\[\d+\]/g, '[]');
  const found = DEPENDENCY_ORDER.indexOf(key);
  return found === -1 ? DEPENDENCY_ORDER.length : found;
}

/** A violation that cannot be repaired mechanically, and why not. */
export interface Unfixable {
  ruleId: string;
  message: string;
  reason: string;
}

export interface FixPlan {
  edits: TextEdit[];
  unfixable: Unfixable[];
}

/** Why a located violation was rejected for automatic repair. */
function rejectionReason(v: LocatedViolation): string | undefined {
  if (v.expected === undefined) {
    return 'no derivable correct value — this needs a human decision, not arithmetic';
  }
  if (v.location.precision !== 'exact') {
    return 'the field is absent from the document; there is nothing to replace';
  }
  if (v.location.valueLine === undefined || v.location.value === undefined) {
    return 'the element carries no text value to replace';
  }
  return undefined;
}

/**
 * Work out which violations can be repaired by editing the text, without
 * changing anything.
 *
 * Edits are returned in reverse document order so a caller applying them
 * sequentially never invalidates a later position.
 */
export function planFixes(
  xml: string,
  violations: readonly Violation[],
  syntax: Syntax,
): FixPlan {
  const located = locateViolations(xml, violations, syntax);
  const lines = xml.split(/\r\n|\r|\n/);
  const edits: TextEdit[] = [];
  const unfixable: Unfixable[] = [];

  for (const v of located) {
    const rejected = rejectionReason(v);
    if (rejected !== undefined) {
      unfixable.push({ ruleId: v.ruleId, message: v.message, reason: rejected });
      continue;
    }

    const line = v.location.valueLine!;
    const column = v.location.valueColumn!;
    const previous = v.location.value!;
    const replacement = String(v.expected);

    // Defensive: confirm the text really is where we think it is before
    // proposing to overwrite it. A position that has drifted would corrupt the
    // document rather than repair it.
    const actual = lines[line - 1]?.slice(column - 1, column - 1 + previous.length);
    if (actual !== previous) {
      unfixable.push({
        ruleId: v.ruleId,
        message: v.message,
        reason: `the value at ${line}:${column} is "${actual ?? ''}", not the reported "${previous}"`,
      });
      continue;
    }

    if (replacement === previous) continue; // nothing to do

    edits.push({
      line,
      column,
      previous,
      replacement,
      ruleId: v.ruleId,
      ...(v.path !== undefined ? { path: v.path } : {}),
      reason: `${v.ruleId}: ${previous} → ${replacement}`,
      depth: dependencyDepth(v.path),
    });
  }

  // Two rules may target the same value. Agreeing duplicates collapse; a
  // disagreement is ambiguous, so neither is applied.
  const byPosition = new Map<string, TextEdit[]>();
  for (const edit of edits) {
    const key = `${edit.line}:${edit.column}`;
    byPosition.set(key, [...(byPosition.get(key) ?? []), edit]);
  }
  const resolved: TextEdit[] = [];
  for (const [key, group] of byPosition) {
    const replacements = new Set(group.map((e) => e.replacement));
    if (replacements.size > 1) {
      for (const e of group) {
        unfixable.push({
          ruleId: e.ruleId,
          message: e.reason,
          reason: `rules disagree about the value at ${key} (${[...replacements].join(' vs ')}); refusing to choose`,
        });
      }
      continue;
    }
    const first = group[0]!;
    const rules = [...new Set(group.map((e) => e.ruleId))].join(', ');
    resolved.push({
      ...first,
      ruleId: rules,
      reason: `${rules}: ${first.previous} → ${first.replacement}`,
      depth: Math.min(...group.map((e) => e.depth)),
    });
  }

  // Reverse document order keeps earlier positions valid as edits are applied.
  resolved.sort((a, b) => (a.line === b.line ? b.column - a.column : b.line - a.line));
  return { edits: resolved, unfixable };
}

/**
 * Apply edits to the source text.
 *
 * Splits on the document's own line terminator and rejoins with it, so a CRLF
 * file stays CRLF and a file with no trailing newline gains none.
 */
export function applyEdits(xml: string, edits: readonly TextEdit[]): string {
  if (edits.length === 0) return xml;
  const terminator = xml.includes('\r\n') ? '\r\n' : xml.includes('\r') ? '\r' : '\n';
  const lines = xml.split(/\r\n|\r|\n/);
  // Applied in reverse document order; planFixes already sorts that way, but
  // a caller may have filtered or reordered them.
  const ordered = [...edits].sort((a, b) => (a.line === b.line ? b.column - a.column : b.line - a.line));
  for (const edit of ordered) {
    const index = edit.line - 1;
    const current = lines[index];
    if (current === undefined) continue;
    const start = edit.column - 1;
    if (current.slice(start, start + edit.previous.length) !== edit.previous) continue;
    lines[index] = current.slice(0, start) + edit.replacement + current.slice(start + edit.previous.length);
  }
  return lines.join(terminator);
}

export interface FixOptions {
  profile?: 'en16931' | 'xrechnung';
  /**
   * Cap on validate-edit rounds. Correcting a line total changes the totals
   * derived from it, so repair converges over a few passes rather than one.
   */
  maxRounds?: number;
  /**
   * Allow edits that change the amount due (BT-115) on a document that states
   * a prepaid or rounding amount.
   *
   * When BR-CO-16 fails on such a document, the arithmetic alone cannot tell
   * whether the amount due is wrong or the prepaid amount is — and rewriting
   * the amount due to agree with a mistyped prepaid amount changes what the
   * customer owes while leaving the invoice fully valid. Measured across 917
   * successful repairs, every one of the 39 that altered the payable amount
   * was exactly this case. So by default those edits are withheld and reported
   * as needing confirmation; set this to true only after a person has decided
   * the amount due is the wrong figure.
   */
  confirmAmountDue?: boolean;
}

export interface FixResult {
  /** The repaired document, or the original when nothing could be repaired. */
  xml: string;
  /** Every edit applied, oldest round first. */
  applied: TextEdit[];
  /** Violations left, with the reason each was not repaired. */
  unfixable: Unfixable[];
  rounds: number;
  errorsBefore: number;
  errorsAfter: number;
  /** True when the document became valid. */
  valid: boolean;
}

/**
 * Repair a document as far as arithmetic allows.
 *
 * Loops validate → plan → apply, because correcting one figure changes the
 * totals computed from it. Stops when nothing further can be repaired, and
 * **abandons the whole attempt if the error count fails to fall** — a repair
 * that does not demonstrably improve the document is a bug, and the original
 * is returned untouched.
 */
export function fixXml(xml: string, options: FixOptions = {}): FixResult {
  const profile = options.profile ?? 'xrechnung';
  const maxRounds = options.maxRounds ?? 8;

  const initial = validateXml(xml, { profile });
  const errorsBefore = initial.errorCount;
  if (initial.syntax === undefined) {
    return {
      xml,
      applied: [],
      unfixable: initial.violations.map((v) => ({
        ruleId: v.ruleId,
        message: v.message,
        reason: 'the document could not be parsed, so nothing can be located or repaired',
      })),
      rounds: 0,
      errorsBefore,
      errorsAfter: errorsBefore,
      valid: false,
    };
  }

  let current = xml;
  let previousErrors = errorsBefore;
  const applied: TextEdit[] = [];
  let unfixable: Unfixable[] = [];
  let rounds = 0;

  for (; rounds < maxRounds; rounds++) {
    const result = validateXml(current, { profile });
    if (result.syntax === undefined) break;
    unfixable = [];
    const plan = planFixes(current, result.violations, result.syntax);
    unfixable = plan.unfixable;
    if (result.errorCount === 0) break;

    // The amount-due guard. On a document stating a prepaid or rounding
    // amount, BR-CO-16 cannot tell whether the amount due or the prepaid
    // figure is the wrong one — and picking the amount due silently changes
    // what the customer owes. That choice belongs to a person.
    const totals = result.invoice?.totals;
    const ambiguousDue =
      options.confirmAmountDue !== true &&
      ((totals?.paidAmount ?? 0) !== 0 || (totals?.roundingAmount ?? 0) !== 0);
    let edits = plan.edits;
    if (ambiguousDue) {
      const withheld = edits.filter((e) => e.path === 'totals.amountDue');
      edits = edits.filter((e) => e.path !== 'totals.amountDue');
      for (const e of withheld) {
        unfixable.push({
          ruleId: e.ruleId,
          message: e.reason,
          reason:
            'changing the amount due needs your confirmation — either the amount due or the prepaid/rounding amount is wrong, and only you know which',
        });
      }
    }
    if (edits.length === 0) break;

    // Only the most upstream level this round; the rest re-derive next pass
    // from corrected inputs instead of being pulled toward a corrupted value.
    const shallowest = Math.min(...edits.map((e) => e.depth));
    const round = edits.filter((e) => e.depth === shallowest);
    const candidate = applyEdits(current, round);
    const after = validateXml(candidate, { profile });

    // The whole point of editing was to reduce errors. If it did not, the
    // repair logic is wrong for this document — keep the previous text.
    if (after.syntax === undefined || after.errorCount >= previousErrors) {
      unfixable = [
        ...unfixable,
        ...round.map((e) => ({
          ruleId: e.ruleId,
          message: e.reason,
          reason: 'applying this edit did not reduce the error count, so it was discarded',
        })),
      ];
      break;
    }

    current = candidate;
    previousErrors = after.errorCount;
    applied.push(...round);
  }

  const final = validateXml(current, { profile });
  return {
    xml: current,
    applied,
    unfixable,
    rounds,
    errorsBefore,
    errorsAfter: final.errorCount,
    valid: final.errorCount === 0,
  };
}
