'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  compareRulesets,
  generateXRechnungUbl,
  listRulesets,
  validateInvoice,
  validateXml,
  withComputedTotals,
  withXRechnungDefaults,
  type Invoice,
  type RegressionReport,
} from '@stampbench/core';
import { aiExplain, aiStatus, ApiError, regressCredit, shareReport } from '@/lib/account-client';
import { FEATURE_LIMITS } from '@/lib/plans';
import { FixPanel } from './fix-panel';
import { SAMPLE_GENERATE_JSON, SAMPLE_XML } from './samples';

/**
 * Validation and generation run entirely in the browser — the engine is pure
 * TypeScript, so the playground IS the product claim: your invoice never
 * leaves your machine. Only the optional AI explanation calls the server; its
 * button renders only when /api/ai/status says the feature is switched on.
 */

interface Violation {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  terms?: string[];
  path?: string;
}

interface ValidationResult {
  valid: boolean;
  profile: string;
  syntax?: 'ubl' | 'cii';
  errorCount: number;
  warningCount: number;
  violations: Violation[];
}

/** Escape HTML then apply minimal markdown (bold, inline code) for AI output. */
function renderMarkdownish(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

function SeverityBadge({ severity }: { severity: 'error' | 'warning' }) {
  return severity === 'error' ? (
    <span className="rounded bg-danger/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-danger">
      ERROR
    </span>
  ) : (
    <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-warning">
      WARN
    </span>
  );
}

function ViolationList({ result }: { result: ValidationResult }) {
  const syntaxLabel = result.syntax === 'cii' ? 'CII (ZUGFeRD/Factur-X)' : result.syntax === 'ubl' ? 'UBL' : null;
  return (
    <div className="flex flex-col gap-2">
      <div className={`text-sm font-medium ${result.valid ? 'text-success' : 'text-danger'}`}>
        {result.valid
          ? '✓ Valid — no blocking errors'
          : `✗ ${result.errorCount} error${result.errorCount === 1 ? '' : 's'}, ${result.warningCount} warning${result.warningCount === 1 ? '' : 's'}`}
        {syntaxLabel && (
          <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted">
            {syntaxLabel}
          </span>
        )}
      </div>
      {result.violations.map((v, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-3 text-sm">
          <div className="mb-1 flex items-center gap-2">
            <SeverityBadge severity={v.severity} />
            <span className="font-mono text-xs text-accent-hi">{v.ruleId}</span>
            {v.terms && <span className="font-mono text-xs text-faint">{v.terms.join(', ')}</span>}
          </div>
          <p className="text-muted">{v.message}</p>
        </div>
      ))}
    </div>
  );
}

const SECONDARY_BUTTON =
  'rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:border-border-hi hover:text-text disabled:opacity-40';

/**
 * 'Share report' — the one playground feature that stores something
 * server-side: the verdict and violation list (never the XML), keyed for
 * /report?id=…. Metered per FEATURE_LIMITS.share, which is why the two
 * expected failures get bespoke prompts rather than a generic error.
 */
function SharePanel({ result, fileName }: { result: ValidationResult; fileName: string | null }) {
  const [shared, setShared] = useState<{ url: string } | null>(null);
  const [gate, setGate] = useState<'signup' | 'quota' | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // A link describes one specific run — a new result invalidates all of it.
  useEffect(() => {
    setShared(null);
    setGate(null);
    setShareError(null);
    setCopied(false);
  }, [result]);

  async function onShare() {
    setBusy(true);
    setGate(null);
    setShareError(null);
    try {
      const res = await shareReport({
        verdict: result.valid,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        syntax: result.syntax,
        violations: result.violations,
        fileName: fileName ?? undefined,
        sharedAt: Date.now(),
        source: 'playground',
      });
      setShared(res);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthenticated') setGate('signup');
      else if (e instanceof ApiError && e.code === 'quota') setGate('quota');
      else setShareError(e instanceof Error ? e.message : 'Sharing failed.');
    } finally {
      setBusy(false);
    }
  }

  // Only computed after a successful share, so window is always available.
  const absoluteUrl = shared
    ? shared.url.startsWith('http')
      ? shared.url
      : `${window.location.origin}${shared.url}`
    : null;

  function copy() {
    if (!absoluteUrl) return;
    navigator.clipboard.writeText(absoluteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mt-4 border-t border-border pt-4 text-sm">
      {!shared && (
        <>
          <button onClick={onShare} disabled={busy} className={SECONDARY_BUTTON}>
            {busy ? 'Sharing…' : 'Share report'}
          </button>
          <p className="mt-2 text-xs text-faint">
            Stores the verdict and violation list — never the XML itself.
          </p>
        </>
      )}
      {gate === 'signup' && (
        <p className="mt-2 text-muted">
          <Link href="/signup" className="text-accent-hi hover:underline">
            Create a free account
          </Link>{' '}
          to share validation reports ({FEATURE_LIMITS.free.share}/month free).
        </p>
      )}
      {gate === 'quota' && (
        <p className="mt-2 text-muted">
          Sharing quota reached this month.{' '}
          <Link href="/account" className="text-accent-hi hover:underline">
            See plans on your account page
          </Link>
          .
        </p>
      )}
      {shareError && <p className="mt-2 text-danger">{shareError}</p>}
      {shared && absoluteUrl && (
        <div>
          <p className="mb-1.5 text-muted">Anyone with this link can view the report:</p>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <span className="truncate font-mono text-xs">{absoluteUrl}</span>
            <button
              onClick={copy}
              className="ml-auto shrink-0 text-sm text-accent-hi hover:underline"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One line the reader can act on, per ruleset transition. */
function transitionVerdict(report: RegressionReport): { tone: string; text: string } {
  const entry = report.entries[0];
  if (!entry) return { tone: 'text-muted', text: 'No document was compared.' };
  const n = entry.newRuleIds.length;
  const failures = `${n} new failure${n === 1 ? '' : 's'}`;
  switch (entry.transition) {
    case 'unchanged-pass':
      return { tone: 'text-success', text: `✓ This invoice would still pass ${report.to.label}.` };
    case 'regression':
      return {
        tone: 'text-danger',
        text: `✗ This invoice breaks under ${report.to.label} (${failures}).`,
      };
    case 'improvement':
      return {
        tone: 'text-success',
        text: `✓ This invoice fails under ${report.from.label} but would pass ${report.to.label}.`,
      };
    case 'unchanged-fail':
      return {
        tone: 'text-danger',
        text: `✗ This invoice already fails under ${report.from.label} and still fails under ${report.to.label}${n > 0 ? ` (${failures})` : ''}.`,
      };
  }
}

interface RegressData {
  remaining: number;
  hasCandidate: boolean;
  reports: RegressionReport[];
}

/**
 * 'Check against upcoming rules' — validates the current input under every
 * registered ruleset version and reports what changes at each step. The maths
 * is client-side (the library is open source); regressCredit() is purely the
 * account/quota gate, and it is asked only *after* the XML parses — a parse
 * failure should not cost a credit.
 */
function RegressPanel({ xml, fileName }: { xml: string; fileName: string | null }) {
  const [data, setData] = useState<RegressData | null>(null);
  const [gate, setGate] = useState<'signup' | 'quota' | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The check describes one specific document — new input, fresh panel.
  useEffect(() => {
    setData(null);
    setGate(null);
    setCheckError(null);
  }, [xml]);

  async function onCheck() {
    setGate(null);
    setCheckError(null);
    const invoice = validateXml(xml, { profile: 'xrechnung' }).invoice;
    if (!invoice) {
      setCheckError('The XML could not be parsed, so there is nothing to check.');
      return;
    }
    setBusy(true);
    try {
      const credit = await regressCredit();
      // Rulesets ordered current-first by effective date, candidates last;
      // comparing consecutive pairs reports what changes at each step towards
      // the newest published set. Superseded sets are for audit, not futures.
      const rank: Record<string, number> = { current: 0, candidate: 1 };
      const chain = listRulesets()
        .filter((r) => r.status !== 'superseded')
        .sort(
          (a, b) =>
            (rank[a.status] ?? 0) - (rank[b.status] ?? 0) ||
            (a.effectiveFrom ?? '').localeCompare(b.effectiveFrom ?? '') ||
            a.rules.length - b.rules.length ||
            a.id.localeCompare(b.id),
        );
      const documents = [{ id: fileName ?? 'playground-input', invoice }];
      setData({
        remaining: credit.remaining,
        hasCandidate: chain.some((r) => r.status === 'candidate'),
        reports: chain.slice(1).map((to, i) => compareRulesets(documents, chain[i].id, to.id)),
      });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthenticated') setGate('signup');
      else if (e instanceof ApiError && e.code === 'quota') setGate('quota');
      else setCheckError(e instanceof Error ? e.message : 'The check failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4 text-sm">
      {!data && (
        <>
          <button onClick={onCheck} disabled={busy} className={SECONDARY_BUTTON}>
            {busy ? 'Checking…' : 'Check against upcoming rules'}
          </button>
          <p className="mt-2 text-xs text-faint">
            Runs this invoice under every registered ruleset version, in your browser.
          </p>
        </>
      )}
      {gate === 'signup' && (
        <p className="mt-2 text-muted">
          <Link href="/signup" className="text-accent-hi hover:underline">
            Create a free account
          </Link>{' '}
          to run future-ruleset checks — free accounts get {FEATURE_LIMITS.free.regress} a month.
        </p>
      )}
      {gate === 'quota' && (
        <p className="mt-2 text-muted">
          You have used all future-ruleset checks for this month.{' '}
          <Link href="/account" className="text-accent-hi hover:underline">
            Paid plans have no cap
          </Link>
          .
        </p>
      )}
      {checkError && <p className="mt-2 text-danger">{checkError}</p>}
      {data && (
        <div className="flex flex-col gap-3">
          {data.reports.map((r) => {
            const entry = r.entries[0];
            const verdict = transitionVerdict(r);
            return (
              <div
                key={`${r.from.id}->${r.to.id}`}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="mb-1.5 font-mono text-xs text-faint">
                  {r.from.id} → {r.to.id}
                </div>
                <p className={`font-medium ${verdict.tone}`}>{verdict.text}</p>
                {r.byNewRule.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted">Newly failing:</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {r.byNewRule.map((rule) => (
                        <li key={rule.ruleId}>
                          <span className="font-mono text-xs text-accent-hi">{rule.ruleId}</span>{' '}
                          <span className="text-muted">{rule.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {entry && entry.resolvedRuleIds.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    No longer failing:{' '}
                    <span className="font-mono text-success">
                      {entry.resolvedRuleIds.join(', ')}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
          {!data.hasCandidate && (
            <p className="text-xs text-faint">
              No future ruleset is published yet — new specification releases are registered the
              day they appear. Until then this covers the step from the European core to the German
              CIUS.
            </p>
          )}
          {data.remaining >= 0 && (
            <p className="text-xs text-faint">
              {data.remaining} check{data.remaining === 1 ? '' : 's'} left this month.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Playground() {
  const [tab, setTab] = useState<'validate' | 'generate'>('validate');
  const [xml, setXml] = useState('');
  /** Name of a dropped file, kept only to name the fixed-XML download. */
  const [fileName, setFileName] = useState<string | null>(null);
  const [genJson, setGenJson] = useState(SAMPLE_GENERATE_JSON);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [genResult, setGenResult] = useState<{ xml: string; validation?: ValidationResult } | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  // null until the one-time server probe answers; the button only renders
  // when the feature is actually switched on, so a dormant key costs nothing.
  const [aiEnabled, setAiEnabled] = useState(false);
  const [explainGate, setExplainGate] = useState<'signup' | 'quota' | null>(null);
  useEffect(() => {
    aiStatus()
      .then((s) => setAiEnabled(s.enabled))
      .catch(() => setAiEnabled(false));
  }, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? `Request failed (${res.status})`);
    return data;
  }

  function runValidate() {
    setBusy('validate');
    setError(null);
    setExplanation(null);
    setResult(null);
    try {
      setResult(validateXml(xml, { profile: 'xrechnung' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Accept either the bare invoice object or a { "invoice": { … } } wrapper. */
  function unwrapInvoice(parsed: unknown): Invoice {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Input must be a JSON object — the invoice itself, or { "invoice": { … } }.');
    }
    const inner = (parsed as Record<string, unknown>)['invoice'];
    return (typeof inner === 'object' && inner !== null && !Array.isArray(inner) ? inner : parsed) as Invoice;
  }

  function runGenerate() {
    setBusy('generate');
    setError(null);
    setGenResult(null);
    try {
      const invoice = withComputedTotals(withXRechnungDefaults(unwrapInvoice(JSON.parse(genJson))));
      const generatedXml = generateXRechnungUbl(invoice);
      setGenResult({ xml: generatedXml, validation: validateInvoice(invoice) });
    } catch (e) {
      setError(e instanceof SyntaxError ? 'Input is not valid JSON.' : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** 'Use fixed XML': swap the input for the repaired text and re-validate at once. */
  function applyFixed(fixed: string) {
    setXml(fixed);
    setExplanation(null);
    setError(null);
    setResult(validateXml(fixed, { profile: 'xrechnung' }));
  }

  async function runExplain() {
    if (!result?.violations.length) return;
    setBusy('explain');
    setError(null);
    setExplainGate(null);
    try {
      const data = await aiExplain(result.violations);
      setExplanation(data.explanation);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthenticated') {
        setExplainGate('signup');
      } else if (e instanceof ApiError && e.code === 'quota') {
        setExplainGate('quota');
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(null);
    }
  }

  const tabClass = (t: string) =>
    `rounded-lg px-4 py-1.5 text-sm font-medium transition ${
      tab === t ? 'bg-accent text-white' : 'text-muted hover:text-text'
    }`;

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-surface p-1 w-fit">
        <button className={tabClass('validate')} onClick={() => setTab('validate')}>
          Validate XML
        </button>
        <button className={tabClass('generate')} onClick={() => setTab('generate')}>
          Generate from JSON
        </button>
      </div>

      {tab === 'validate' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted">UBL Invoice XML</span>
              <div className="flex gap-3 text-sm">
                <button
                  onClick={() => {
                    setXml(SAMPLE_XML);
                    setFileName(null);
                  }}
                  className="text-accent-hi hover:underline"
                >
                  Load valid sample
                </button>
                <button
                  onClick={() => {
                    setXml(SAMPLE_XML.replace(/ *<cbc:BuyerReference>.*<\/cbc:BuyerReference>\n/, '').replace('<cbc:Percent>19</cbc:Percent>', '<cbc:Percent>16</cbc:Percent>'));
                    setFileName(null);
                  }}
                  className="text-accent-hi hover:underline"
                >
                  Load broken sample
                </button>
              </div>
            </div>
            <textarea
              value={xml}
              onChange={(e) => setXml(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                file
                  .text()
                  .then((text) => {
                    setXml(text);
                    setFileName(file.name);
                  })
                  .catch(() => setError('Could not read the dropped file.'));
              }}
              spellCheck={false}
              placeholder="Paste — or drop a file: XRechnung, UBL, or CII/ZUGFeRD XML…"
              className="h-105 w-full resize-none rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed outline-none transition focus:border-accent"
            />
            <button
              onClick={runValidate}
              disabled={busy !== null || !xml.trim()}
              className="mt-3 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-40"
            >
              {busy === 'validate' ? 'Validating…' : 'Validate'}
            </button>
          </div>
          <div>
            <span className="mb-2 block text-sm text-muted">Result</span>
            <div className="min-h-105 rounded-xl border border-border bg-bg p-4">
              {!result && !error && (
                <p className="text-sm text-faint">
                  Validation runs against EN 16931 core rules (including the BR-S/E/AE/Z/G/O VAT
                  families) plus the German XRechnung (BR-DE) profile. Both syntaxes are
                  auto-detected: UBL and CII (ZUGFeRD/Factur-X XML). Load the broken sample to see
                  it catch a missing buyer reference and a VAT arithmetic error.
                  <span className="mt-2 block">
                    Everything runs in your browser — the XML never leaves your machine.
                  </span>
                </p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              {result && (
                <>
                  <ViolationList result={result} />
                  {aiEnabled && result.violations.length > 0 && (
                    <>
                      <button
                        onClick={runExplain}
                        disabled={busy !== null}
                        className="mt-4 rounded-lg border border-accent/40 bg-accent-dim/40 px-4 py-2 text-sm font-medium text-accent-hi transition hover:bg-accent-dim disabled:opacity-40"
                      >
                        {busy === 'explain' ? 'Thinking…' : '✦ Explain with AI'}
                      </button>
                      {explainGate === 'signup' && (
                        <p className="mt-2 text-xs text-muted">
                          AI explanations need a free account ({FEATURE_LIMITS.free.ai}/month).{' '}
                          <Link href="/signup" className="text-accent-hi hover:underline">
                            Create one
                          </Link>
                          .
                        </p>
                      )}
                      {explainGate === 'quota' && (
                        <p className="mt-2 text-xs text-muted">
                          AI explanations used up for this month.{' '}
                          <Link href="/account" className="text-accent-hi hover:underline">
                            Upgrade for more
                          </Link>
                          .
                        </p>
                      )}
                    </>
                  )}
                  {explanation && (
                    <div
                      className="prose-ig mt-4 rounded-lg border border-border bg-surface p-4 text-sm"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownish(explanation) }}
                    />
                  )}
                  {result.violations.length > 0 && (
                    <FixPanel xml={xml} fileName={fileName} onUseFixed={applyFixed} />
                  )}
                  <SharePanel result={result} fileName={fileName} />
                  <RegressPanel xml={xml} fileName={fileName} />
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted">Invoice JSON (totals are computed for you)</span>
              <button onClick={() => setGenJson(SAMPLE_GENERATE_JSON)} className="text-sm text-accent-hi hover:underline">
                Reset sample
              </button>
            </div>
            <textarea
              value={genJson}
              onChange={(e) => setGenJson(e.target.value)}
              spellCheck={false}
              className="h-105 w-full resize-none rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed outline-none transition focus:border-accent"
            />
            <button
              onClick={runGenerate}
              disabled={busy !== null}
              className="mt-3 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-40"
            >
              {busy === 'generate' ? 'Generating…' : 'Generate XRechnung'}
            </button>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted">Generated XML</span>
              {genResult && (
                <button
                  onClick={() => navigator.clipboard.writeText(genResult.xml)}
                  className="text-sm text-accent-hi hover:underline"
                >
                  Copy
                </button>
              )}
            </div>
            <div className="min-h-105 rounded-xl border border-border bg-bg p-4">
              {!genResult && !error && (
                <p className="text-sm text-faint">
                  Send lines with quantities, prices and VAT categories — Stampbench computes the
                  totals (BT-106…BT-115) and the VAT breakdown so the BR-CO arithmetic rules pass by
                  construction.
                </p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              {genResult && (
                <>
                  {genResult.validation && (
                    <div className={`mb-3 text-sm font-medium ${genResult.validation.valid ? 'text-success' : 'text-warning'}`}>
                      {genResult.validation.valid
                        ? '✓ Generated document passes validation'
                        : `Generated with ${genResult.validation.errorCount} validation error(s) — check required fields`}
                    </div>
                  )}
                  <pre className="max-h-96 overflow-auto font-mono text-xs leading-relaxed text-muted">
                    {genResult.xml}
                  </pre>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
