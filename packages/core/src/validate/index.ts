import type { Invoice } from '../model/invoice.js';
import { EN16931_RULES } from './rules/en16931.js';
import { XRECHNUNG_RULES } from './rules/xrechnung.js';
import type { Profile, Rule, Violation } from './rule.js';
import { InvoiceParseError, parseUblInvoice } from '../parse/ubl.js';

export const RULESET_VERSION = '2026-08.1';

export interface ValidateOptions {
  /**
   * 'en16931' runs the European core rules only;
   * 'xrechnung' (default) additionally runs the German BR-DE rules.
   */
  profile?: Profile;
}

export interface ValidationResult {
  valid: boolean;
  profile: Profile;
  errorCount: number;
  warningCount: number;
  violations: Violation[];
  meta: {
    rulesRun: number;
    rulesetVersion: string;
  };
}

export function rulesForProfile(profile: Profile): Rule[] {
  return profile === 'xrechnung' ? [...EN16931_RULES, ...XRECHNUNG_RULES] : EN16931_RULES;
}

/** Validate a semantic-model invoice. */
export function validateInvoice(invoice: Invoice, options: ValidateOptions = {}): ValidationResult {
  const profile = options.profile ?? 'xrechnung';
  const rules = rulesForProfile(profile);
  const violations: Violation[] = [];
  for (const rule of rules) {
    const found = rule.check(invoice);
    if (found?.length) violations.push(...found);
  }
  violations.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  return {
    valid: errorCount === 0,
    profile,
    errorCount,
    warningCount: violations.length - errorCount,
    violations,
    meta: { rulesRun: rules.length, rulesetVersion: RULESET_VERSION },
  };
}

export interface ValidateXmlResult extends ValidationResult {
  /** The parsed semantic model, when the XML could be parsed at all. */
  invoice?: Invoice;
}

/** Validate a UBL XML document string. Parse failures become SYNTAX violations. */
export function validateUblXml(xml: string, options: ValidateOptions = {}): ValidateXmlResult {
  const profile = options.profile ?? 'xrechnung';
  try {
    const invoice = parseUblInvoice(xml);
    return { ...validateInvoice(invoice, options), invoice };
  } catch (e) {
    const message = e instanceof InvoiceParseError ? e.message : 'Unrecognised document.';
    return {
      valid: false,
      profile,
      errorCount: 1,
      warningCount: 0,
      violations: [{ ruleId: 'SYNTAX', severity: 'error', message }],
      meta: { rulesRun: 0, rulesetVersion: RULESET_VERSION },
    };
  }
}
