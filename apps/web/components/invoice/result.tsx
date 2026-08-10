'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  fixXml,
  validateInvoice,
  validateXml,
  type FixResult,
  type ValidationResult,
} from '@stampbench/core';

import { BUTTON_PRIMARY, BUTTON_QUIET, BUTTON_SECONDARY } from '@/components/invoice/fields';
import type { GeneratedDocument } from '@/lib/invoice/build';
import { getFormat } from '@/lib/invoice/formats';
import type { InvoiceDraft } from '@/lib/invoice/draft';
import { RULESETS } from '@/lib/markets';

/**
 * What happened after Generate: the verdict, the violations, the deterministic
 * repair, and the ways out of the product.
 *
 * The whole screen is built around one rule — a verdict is meaningless without
 * the ruleset that produced it. "Valid" here always appears next to which of
 * the two rulesets ran and how many rules it contains, and a format with no
 * ruleset says *that* instead of showing a green tick it has not earned.
 *
 * Validation and repair both run in the browser, on the document that was just
 * built in the browser. Nothing is uploaded.
 */

function handoffToPlayground(xml: string): void {
  try {
    window.sessionStorage.setItem('sb_playground_xml', xml);
  } catch {
    // Private mode. The playground will simply open empty, which is a
    // survivable outcome for a convenience handoff.
  }
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(value: string): string {
  return (value || 'invoice').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice';
}

function Verdict({ result }: { result: ValidationResult }) {
  const ok = result.valid;
  const german = result.profile === 'xrechnung';
  // The spec version has to follow the profile: reporting "EN 16931-1:2017"
  // under a verdict produced by the German CIUS would understate what ran.
  const specVersion = german ? result.meta.specVersions.xrechnung : result.meta.specVersions.en16931;
  return (
    <div
      className={`rounded-xl border p-5 ${
        ok ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'
      }`}
    >
      <div className={`text-lg font-semibold tracking-tight ${ok ? 'text-success' : 'text-danger'}`}>
        {ok ? '✓ Invoice valid' : `✕ ${result.errorCount} error${result.errorCount === 1 ? '' : 's'} found`}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-faint">Checked against</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
        <span className="text-accent-hi">{RULESETS[result.profile].label}</span>
        <span className="text-faint">·</span>
        <span>{result.meta.rulesRun} rules run</span>
        <span className="text-faint">·</span>
        <span>{specVersion}</span>
        <span className="text-faint">·</span>
        <span className="text-faint">ruleset {result.meta.rulesetVersion}</span>
      </div>
      {result.warningCount > 0 && (
        <p className="mt-3 text-sm text-warning">
          {result.warningCount} warning{result.warningCount === 1 ? '' : 's'} — not blocking, but worth reading.
        </p>
      )}
    </div>
  );
}

function Violations({ result }: { result: ValidationResult }) {
  if (result.violations.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {result.violations.map((violation, index) => (
        <li key={`${violation.ruleId}-${index}`} className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                violation.severity === 'error'
                  ? 'bg-danger/15 text-danger'
                  : 'bg-warning/15 text-warning'
              }`}
            >
              {violation.severity === 'error' ? 'ERROR' : 'WARN'}
            </span>
            <span className="font-mono text-xs text-accent-hi">{violation.ruleId}</span>
            {violation.terms && violation.terms.length > 0 && (
              <span className="font-mono text-xs text-faint">{violation.terms.join(', ')}</span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted">{violation.message}</p>
        </li>
      ))}
    </ul>
  );
}

function RepairPanel({
  xml,
  profile,
  onUseRepaired,
}: {
  xml: string;
  profile: 'en16931' | 'xrechnung';
  onUseRepaired: (xml: string) => void;
}) {
  const [fix, setFix] = useState<FixResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    try {
      setFix(fixXml(xml, { profile }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!fix) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-1 font-medium tracking-tight">These need data, not arithmetic</h3>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted">
          Stampbench computed every total and the VAT breakdown from your lines, so the arithmetic rules
          cannot fail on a document it built — which means what is left above is missing business data.
          Go back to the editor and supply it. Repair can only write values it can derive, and it will
          never guess a VAT number or a buyer reference.
        </p>
        <button onClick={run} className={BUTTON_SECONDARY}>
          Try automatic repair anyway
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-2 font-medium tracking-tight">
        {fix.applied.length > 0
          ? `${fix.applied.length} fix${fix.applied.length === 1 ? '' : 'es'} available — errors ${fix.errorsBefore} → ${fix.errorsAfter}`
          : 'Nothing could be fixed automatically'}
      </h3>

      {fix.applied.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5 text-sm">
          {fix.applied.map((entry, index) => (
            <li key={index} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-accent-hi">{entry.ruleId}</span>
              <span className="font-mono text-xs text-muted">
                {entry.previous} → {entry.replacement}
              </span>
              <span className="font-mono text-xs text-faint">line {entry.line}</span>
            </li>
          ))}
        </ul>
      )}

      {fix.unfixable.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-sm text-muted">
            Left alone ({fix.unfixable.length}) — these need a decision, not arithmetic:
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {fix.unfixable.map((entry, index) => (
              <li key={index}>
                <span className="font-mono text-xs text-accent-hi">{entry.ruleId}</span>{' '}
                <span className="text-faint">{entry.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fix.applied.length > 0 && (
        <button onClick={() => onUseRepaired(fix.xml)} className={BUTTON_PRIMARY}>
          Use the repaired document and re-check
        </button>
      )}
    </div>
  );
}

/** Code that calls the real endpoints, with the real parameter names. */
function apiSnippets(xml: string, profile: string) {
  const escaped = JSON.stringify(xml.slice(0, 120) + (xml.length > 120 ? '\n…' : ''));
  return [
    {
      id: 'curl',
      label: 'cURL',
      code: `curl https://stampbench.com/api/v1/validate \\
  -H "Authorization: Bearer $STAMPBENCH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"profile":"${profile}","xml":"<?xml version=\\"1.0\\"?>…"}'`,
    },
    {
      id: 'node',
      label: 'JavaScript',
      code: `const res = await fetch('https://stampbench.com/api/v1/validate', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.STAMPBENCH_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ profile: '${profile}', xml }),
});
const { result } = await res.json();
if (!result.valid) console.error(result.violations);`,
    },
    {
      id: 'local',
      label: 'Local (no API key)',
      code: `import { validateXml, generateUblInvoice, withComputedTotals, withProfileDefaults } from '@stampbench/core';

const invoice = withComputedTotals(withProfileDefaults(model, { profile: '${profile}' }));
const xml = generateUblInvoice(invoice, { profile: '${profile}' });
const result = validateXml(xml, { profile: '${profile}' });
// ${escaped.slice(1, 40)}…`,
    },
    {
      id: 'python',
      label: 'Python',
      code: `import os, requests

res = requests.post(
    "https://stampbench.com/api/v1/validate",
    headers={"Authorization": f"Bearer {os.environ['STAMPBENCH_API_KEY']}"},
    json={"profile": "${profile}", "xml": xml},
)
result = res.json()["result"]
if not result["valid"]:
    for violation in result["violations"]:
        print(violation["ruleId"], violation["message"])`,
    },
  ];
}

function ApiPanel({ xml, profile }: { xml: string; profile: string }) {
  const snippets = useMemo(() => apiSnippets(xml, profile), [xml, profile]);
  const [active, setActive] = useState(snippets[0]!.id);
  const [copied, setCopied] = useState(false);
  const current = snippets.find((s) => s.id === active) ?? snippets[0]!;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-1 font-medium tracking-tight">Use this in your application</h3>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        The same check, from your own code. The local form needs no account and no network; the hosted API
        needs a key from your{' '}
        <Link href="/account" className="text-accent-hi hover:underline">
          account page
        </Link>
        .
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {snippets.map((snippet) => (
          <button
            key={snippet.id}
            onClick={() => setActive(snippet.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active === snippet.id ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            {snippet.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 font-mono text-xs leading-relaxed text-muted">
          {current.code}
        </pre>
        <button
          onClick={() => {
            navigator.clipboard.writeText(current.code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="absolute right-2 top-2 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:text-text"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export function GenerationResult({
  draft,
  generated,
  onBack,
  onStartAnother,
}: {
  draft: InvoiceDraft;
  generated: GeneratedDocument;
  onBack: () => void;
  onStartAnother: () => void;
}) {
  const format = getFormat(draft.formatId);
  const [xml, setXml] = useState(generated.xml);
  const [copied, setCopied] = useState<string | null>(null);

  const validation = useMemo<ValidationResult | null>(() => {
    if (!format.validationProfile) return null;
    return xml
      ? validateXml(xml, { profile: format.validationProfile })
      : validateInvoice(generated.invoice, { profile: format.validationProfile });
  }, [xml, format.validationProfile, generated.invoice]);

  const filename = slug(draft.document.number);

  function copy(kind: string, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {validation ? (
        <Verdict result={validation} />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-lg font-semibold tracking-tight">Invoice created</div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {format.name} carries no e-invoicing ruleset, so there is no compliance verdict to give — that
            would be a claim Stampbench cannot support. The totals arithmetic was computed exactly and the
            structured JSON is below. To get a verdict, switch the format to{' '}
            <span className="font-medium text-text">{RULESETS.en16931.label}</span> and generate again.
          </p>
        </div>
      )}

      {validation && validation.violations.length > 0 && <Violations result={validation} />}

      {xml && validation && !validation.valid && format.validationProfile && (
        <RepairPanel xml={xml} profile={format.validationProfile} onUseRepaired={setXml} />
      )}

      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-1 font-medium tracking-tight">Export</h3>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          The structured document is the deliverable; the printable version is a view of it. Everything is
          produced in your browser — nothing was uploaded.
        </p>
        <div className="flex flex-wrap gap-2">
          {xml && (
            <>
              <button
                onClick={() => download(`${filename}.xml`, xml, 'application/xml')}
                className={BUTTON_PRIMARY}
              >
                Download XML
              </button>
              <button onClick={() => copy('xml', xml)} className={BUTTON_SECONDARY}>
                {copied === 'xml' ? 'Copied' : 'Copy XML'}
              </button>
            </>
          )}
          <button
            onClick={() => download(`${filename}.json`, generated.json, 'application/json')}
            className={BUTTON_SECONDARY}
          >
            Download JSON
          </button>
          <button onClick={() => copy('json', generated.json)} className={BUTTON_SECONDARY}>
            {copied === 'json' ? 'Copied' : 'Copy JSON'}
          </button>
          <button onClick={() => window.print()} className={BUTTON_SECONDARY}>
            Print / Save as PDF
          </button>
          {xml && (
            <Link
              href="/playground"
              onClick={() => handoffToPlayground(xml)}
              className={BUTTON_SECONDARY}
            >
              Open in the playground
            </Link>
          )}
        </div>
      </div>

      {xml && format.validationProfile && <ApiPanel xml={xml} profile={format.validationProfile} />}

      <div className="flex flex-wrap gap-3">
        <button onClick={onBack} className={BUTTON_SECONDARY}>
          ← Back to the editor
        </button>
        <button onClick={onStartAnother} className={BUTTON_QUIET}>
          Create another invoice
        </button>
      </div>
    </div>
  );
}
