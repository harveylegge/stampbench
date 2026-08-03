import type { Invoice } from '../model/invoice.js';
import { EN16931_RULES } from './rules/en16931.js';
import { VAT_CATEGORY_RULES } from './rules/vat-categories.js';
import { XRECHNUNG_RULES } from './rules/xrechnung.js';
import type { Profile, Rule, Violation } from './rule.js';
import { InvoiceParseError, parseUblInvoice } from '../parse/ubl.js';
import { parseCiiInvoice } from '../parse/cii.js';

export const RULESET_VERSION = '2026-08.2';

/** Specification versions this ruleset targets — pinned in every result. */
export const SPEC_VERSIONS = {
  en16931: 'EN 16931-1:2017',
  xrechnung: 'XRechnung 3.0',
} as const;

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
    /** Which specification versions this ruleset targets (version pinning). */
    specVersions: typeof SPEC_VERSIONS;
  };
}

export function rulesForProfile(profile: Profile): Rule[] {
  const core = [...EN16931_RULES, ...VAT_CATEGORY_RULES];
  return profile === 'xrechnung' ? [...core, ...XRECHNUNG_RULES] : core;
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
    meta: { rulesRun: rules.length, rulesetVersion: RULESET_VERSION, specVersions: SPEC_VERSIONS },
  };
}

export type Syntax = 'ubl' | 'cii';

export interface ValidateXmlResult extends ValidationResult {
  /** The parsed semantic model, when the XML could be parsed at all. */
  invoice?: Invoice;
  /** Detected document syntax, when recognisable. */
  syntax?: Syntax;
}

function syntaxFailure(profile: Profile, message: string, syntax?: Syntax): ValidateXmlResult {
  const result: ValidateXmlResult = {
    valid: false,
    profile,
    errorCount: 1,
    warningCount: 0,
    violations: [{ ruleId: 'SYNTAX', severity: 'error', message }],
    meta: { rulesRun: 0, rulesetVersion: RULESET_VERSION, specVersions: SPEC_VERSIONS },
  };
  if (syntax) result.syntax = syntax;
  return result;
}

/** Validate a UBL XML document string. Parse failures become SYNTAX violations. */
export function validateUblXml(xml: string, options: ValidateOptions = {}): ValidateXmlResult {
  const profile = options.profile ?? 'xrechnung';
  try {
    const invoice = parseUblInvoice(xml);
    return { ...validateInvoice(invoice, options), invoice, syntax: 'ubl' };
  } catch (e) {
    const message = e instanceof InvoiceParseError ? e.message : 'Unrecognised document.';
    return syntaxFailure(profile, message, 'ubl');
  }
}

/**
 * Validate an e-invoice XML document, auto-detecting the syntax:
 * UBL Invoice or UN/CEFACT CrossIndustryInvoice (ZUGFeRD / Factur-X / XRechnung-CII).
 * This is the recommended entry point.
 */
export function validateXml(xml: string, options: ValidateOptions = {}): ValidateXmlResult {
  const profile = options.profile ?? 'xrechnung';
  const detected: Syntax = /CrossIndustryInvoice[\s>]/.test(xml.slice(0, 4000)) ? 'cii' : 'ubl';
  try {
    const invoice = detected === 'cii' ? parseCiiInvoice(xml) : parseUblInvoice(xml);
    return { ...validateInvoice(invoice, options), invoice, syntax: detected };
  } catch (e) {
    const message = e instanceof InvoiceParseError ? e.message : 'Unrecognised document.';
    return syntaxFailure(profile, message, detected);
  }
}
