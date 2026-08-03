/**
 * Versioned rulesets and regression comparison.
 *
 * Regulatory rule sets change on a published cadence, and the artefacts are
 * normally released *before* they become legally binding. That gap is the
 * whole point of this module: it lets you answer "which of my invoices will
 * start failing when the next rule set takes effect?" while you still have
 * time to fix them, instead of finding out in production on the switchover
 * date.
 *
 * A ruleset is an immutable, addressable set of rules with an id like
 * `xrechnung@3.0`. Register a new one the day a standards body publishes it
 * (see `registerRuleset`), then diff a corpus across the two.
 */
import type { Invoice } from '../model/invoice.js';
import { EN16931_RULES } from './rules/en16931.js';
import { VAT_CATEGORY_RULES } from './rules/vat-categories.js';
import { XRECHNUNG_RULES } from './rules/xrechnung.js';
import type { Profile, Rule } from './rule.js';

export type RulesetStatus =
  /** In force now. */
  | 'current'
  /** Published by the standards body but not yet binding — test against this. */
  | 'candidate'
  /** No longer in force; kept so historical documents can be re-checked for audit. */
  | 'superseded';

export interface RulesetDefinition {
  /** Addressable id, e.g. "xrechnung@3.0". */
  id: string;
  label: string;
  profile: Profile;
  /** The specification release this ruleset implements. */
  specVersion: string;
  status: RulesetStatus;
  /** ISO date the ruleset becomes (or became) binding, when known. */
  effectiveFrom?: string;
  rules: Rule[];
}

const CORE = [...EN16931_RULES, ...VAT_CATEGORY_RULES];

const BUILT_IN: RulesetDefinition[] = [
  {
    id: 'en16931@2017',
    label: 'EN 16931 core (European semantic standard)',
    profile: 'en16931',
    specVersion: 'EN 16931-1:2017',
    status: 'current',
    rules: CORE,
  },
  {
    id: 'xrechnung@3.0',
    label: 'XRechnung 3.0 (German CIUS)',
    profile: 'xrechnung',
    specVersion: 'XRechnung 3.0',
    status: 'current',
    effectiveFrom: '2024-02-01',
    rules: [...CORE, ...XRECHNUNG_RULES],
  },
];

const registry = new Map<string, RulesetDefinition>(BUILT_IN.map((r) => [r.id, r]));

/**
 * Register an additional ruleset — a newly published specification release, a
 * draft you want to test against early, or your own house rules layered on top
 * of a built-in set.
 */
export function registerRuleset(definition: RulesetDefinition): void {
  if (!definition.id.includes('@')) {
    throw new Error(`Ruleset id must be of the form "name@version", got "${definition.id}".`);
  }
  registry.set(definition.id, definition);
}

export function listRulesets(): RulesetDefinition[] {
  return [...registry.values()];
}

export function getRuleset(id: string): RulesetDefinition {
  const found = registry.get(id);
  if (!found) {
    throw new Error(
      `Unknown ruleset "${id}". Available: ${[...registry.keys()].join(', ')}.`,
    );
  }
  return found;
}

// ————————————————————————————————————————————————————————————————
// Regression comparison
// ————————————————————————————————————————————————————————————————

export type Transition =
  /** Passed before, passes now. */
  | 'unchanged-pass'
  /** Failed before, still fails. */
  | 'unchanged-fail'
  /** Passed before, fails now — the documents you must fix. */
  | 'regression'
  /** Failed before, passes now. */
  | 'improvement';

export interface DocumentInput {
  /** Stable identifier — a filename, invoice number, or database id. */
  id: string;
  invoice: Invoice;
}

export interface RegressionEntry {
  id: string;
  transition: Transition;
  from: { valid: boolean; errorCount: number };
  to: { valid: boolean; errorCount: number };
  /** Error rules failing under `to` that were not failing under `from`. */
  newRuleIds: string[];
  /** Error rules that were failing under `from` and no longer fail. */
  resolvedRuleIds: string[];
  /** Human-readable messages for the newly failing rules. */
  newMessages: string[];
}

export interface RegressionReport {
  from: { id: string; label: string; specVersion: string; rulesRun: number };
  to: { id: string; label: string; specVersion: string; rulesRun: number };
  summary: {
    total: number;
    regressions: number;
    improvements: number;
    unchangedPass: number;
    unchangedFail: number;
  };
  /** Newly failing rules ranked by how many documents they break — fix these first. */
  byNewRule: Array<{ ruleId: string; documents: number; message: string }>;
  entries: RegressionEntry[];
}

function runRules(invoice: Invoice, rules: Rule[]) {
  const violations = [];
  for (const rule of rules) {
    const found = rule.check(invoice);
    if (found?.length) violations.push(...found);
  }
  const errors = violations.filter((v) => v.severity === 'error');
  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    ruleIds: [...new Set(errors.map((v) => v.ruleId))],
    messageByRule: new Map(errors.map((v) => [v.ruleId, v.message])),
  };
}

function transitionOf(fromValid: boolean, toValid: boolean): Transition {
  if (fromValid && toValid) return 'unchanged-pass';
  if (!fromValid && !toValid) return 'unchanged-fail';
  return fromValid ? 'regression' : 'improvement';
}

/**
 * Validate a corpus under two rulesets and report what changes.
 *
 * The headline number is `summary.regressions`: documents that are valid today
 * and would not be under the target ruleset. `byNewRule` tells you which rule
 * to fix first for the biggest reduction.
 */
export function compareRulesets(
  documents: DocumentInput[],
  fromId: string,
  toId: string,
): RegressionReport {
  const from = getRuleset(fromId);
  const to = getRuleset(toId);

  const entries: RegressionEntry[] = [];
  const ruleCounts = new Map<string, { documents: number; message: string }>();

  for (const doc of documents) {
    const before = runRules(doc.invoice, from.rules);
    const after = runRules(doc.invoice, to.rules);

    const beforeSet = new Set(before.ruleIds);
    const afterSet = new Set(after.ruleIds);
    const newRuleIds = after.ruleIds.filter((id) => !beforeSet.has(id));
    const resolvedRuleIds = before.ruleIds.filter((id) => !afterSet.has(id));

    for (const id of newRuleIds) {
      const existing = ruleCounts.get(id);
      if (existing) existing.documents += 1;
      else ruleCounts.set(id, { documents: 1, message: after.messageByRule.get(id) ?? '' });
    }

    entries.push({
      id: doc.id,
      transition: transitionOf(before.valid, after.valid),
      from: { valid: before.valid, errorCount: before.errorCount },
      to: { valid: after.valid, errorCount: after.errorCount },
      newRuleIds,
      resolvedRuleIds,
      newMessages: newRuleIds.map((id) => after.messageByRule.get(id) ?? '').filter(Boolean),
    });
  }

  const count = (t: Transition) => entries.filter((e) => e.transition === t).length;

  return {
    from: { id: from.id, label: from.label, specVersion: from.specVersion, rulesRun: from.rules.length },
    to: { id: to.id, label: to.label, specVersion: to.specVersion, rulesRun: to.rules.length },
    summary: {
      total: entries.length,
      regressions: count('regression'),
      improvements: count('improvement'),
      unchangedPass: count('unchanged-pass'),
      unchangedFail: count('unchanged-fail'),
    },
    byNewRule: [...ruleCounts.entries()]
      .map(([ruleId, v]) => ({ ruleId, documents: v.documents, message: v.message }))
      .sort((a, b) => b.documents - a.documents || a.ruleId.localeCompare(b.ruleId)),
    entries,
  };
}
