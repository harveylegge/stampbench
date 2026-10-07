'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fixXml,
  validateInvoice,
  validateXml,
  type FixResult,
  type ValidationResult,
} from '@stampbench/core';

import { BUTTON_PRIMARY, BUTTON_QUIET, BUTTON_SECONDARY } from '@/components/invoice/fields';
import { currentPlan } from '@/lib/account-client';
import type { GeneratedDocument } from '@/lib/invoice/build';
import { getFormat } from '@/lib/invoice/formats';
import type { InvoiceDraft } from '@/lib/invoice/draft';
import { JSON_FILE, PDF_FILE, XML_FILE, fileSlug, saveFile } from '@/lib/invoice/save-file';
import { RULESETS } from '@/lib/markets';

/**
 * What happened after Generate: the verdict, the violations, the deterministic
 * repair, and the ways out of the product.
 *
 * Two rules shape this screen, and they pull in opposite directions.
 *
 * **A verdict is meaningless without the ruleset that produced it.** "Valid"
 * must always be checkable: which ruleset ran, how many rules, which spec
 * version. A format with no ruleset says *that* instead of showing a green
 * tick it has not earned.
 *
 * **But the person reading it usually just made their first invoice.** They
 * did not ask what EN 16931 is, and answering in rule ids and spec versions
 * teaches them only that this software is not for them. So the plain-English
 * verdict leads, the downloads come next, and every technical fact stays one
 * click away behind a single page-level toggle rather than being deleted. A
 * developer flips it once and sees everything the old screen showed.
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

/**
 * The verdict, said the way a person would say it.
 *
 * `tech` is the page-level toggle: off, the card is one sentence and a
 * reassurance; on, it also carries the ruleset, the rule count and the spec
 * version: the evidence that makes "valid" a checkable claim rather than a
 * green tick. Nothing is computed differently between the two.
 */
function Verdict({ result, tech }: { result: ValidationResult; tech: boolean }) {
  const ok = result.valid;
  const german = result.profile === 'xrechnung';
  // The spec version has to follow the profile: reporting "EN 16931-1:2017"
  // under a verdict produced by the German CIUS would understate what ran.
  const specVersion = german ? result.meta.specVersions.xrechnung : result.meta.specVersions.en16931;
  const errors = result.errorCount;
  return (
    <div
      className={`rounded-xl border p-5 ${
        ok ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'
      }`}
    >
      <div className={`text-lg font-semibold tracking-tight ${ok ? 'text-success' : 'text-danger'}`}>
        {ok
          ? '✓ Your invoice looks good'
          : `${errors} thing${errors === 1 ? '' : 's'} still need${errors === 1 ? 's' : ''} your attention`}
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {ok
          ? 'Stampbench checked it against the e-invoicing requirements that apply where you bill, before you download it.'
          : 'Stampbench checked your invoice and found details a customer’s system would reject. They are listed below.'}
      </p>

      {result.warningCount > 0 && (
        <p className="mt-3 text-sm text-warning">
          {result.warningCount} warning{result.warningCount === 1 ? '' : 's'}: these will not stop the
          invoice, but they are worth reading.
        </p>
      )}

      {tech && (
        <>
          <div className="mt-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            Checked against
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
            <span className="text-accent-hi">{RULESETS[result.profile].label}</span>
            <span className="text-faint">·</span>
            <span>{result.meta.rulesRun} rules run</span>
            <span className="text-faint">·</span>
            <span>{specVersion}</span>
            <span className="text-faint">·</span>
            <span className="text-faint">ruleset {result.meta.rulesetVersion}</span>
          </div>
        </>
      )}
    </div>
  );
}

function Violations({ result, tech }: { result: ValidationResult; tech: boolean }) {
  if (result.violations.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {result.violations.map((violation, index) => (
        <li key={`${violation.ruleId}-${index}`} className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                violation.severity === 'error'
                  ? 'bg-danger/15 text-danger'
                  : 'bg-warning/15 text-warning'
              }`}
            >
              {violation.severity === 'error' ? 'Must fix' : 'Worth checking'}
            </span>
            {/* The rule id is what you quote to a customer's IT department or
                to support, so it is never far away: but it is a code, and a
                code above the sentence explaining the problem buries the
                sentence. */}
            {tech && (
              <>
                <span className="font-mono text-xs text-accent-hi">{violation.ruleId}</span>
                {violation.terms && violation.terms.length > 0 && (
                  <span className="font-mono text-xs text-faint">{violation.terms.join(', ')}</span>
                )}
              </>
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
          cannot fail on a document it built: which means what is left above is missing business data.
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
          ? `${fix.applied.length} fix${fix.applied.length === 1 ? '' : 'es'} available: errors ${fix.errorsBefore} → ${fix.errorsAfter}`
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
            Left alone ({fix.unfixable.length}): these need a decision, not arithmetic:
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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  /** The page-level "speak to me as a developer" switch. Off by default. */
  const [tech, setTech] = useState(false);
  /** null while unknown; drives the PDF footer and the plans nudge. */
  const [paidPlan, setPaidPlan] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    currentPlan().then((plan) => {
      if (!cancelled) setPaidPlan(plan !== null && plan !== 'free');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const validation = useMemo<ValidationResult | null>(() => {
    if (!format.validationProfile) return null;
    return xml
      ? validateXml(xml, { profile: format.validationProfile })
      : validateInvoice(generated.invoice, { profile: format.validationProfile });
  }, [xml, format.validationProfile, generated.invoice]);

  const filename = fileSlug(draft.document.number);

  function copy(kind: string, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  /** jsPDF is loaded on first click, not shipped with the page. */
  async function onDownloadPdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const plan = await currentPlan();
      const { invoicePdf } = await import('@/lib/invoice/pdf');
      const pdf = await invoicePdf(draft, { branded: plan === null || plan === 'free' });
      await saveFile(pdf.filename, pdf.blob, PDF_FILE);
    } catch {
      setPdfError('Could not build the PDF here: use Print and pick "Save as PDF" as the destination.');
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* One control for the whole screen. A business user never touches it; a
          developer flips it once and the page becomes the technical readout it
          used to be by default. */}
      <div className="flex justify-end">
        <button
          type="button"
          aria-pressed={tech}
          onClick={() => setTech((on) => !on)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-border-hi hover:text-text"
        >
          {tech ? 'Hide technical details' : 'View technical details'}
        </button>
      </div>

      {validation ? (
        <Verdict result={validation} tech={tech} />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-lg font-semibold tracking-tight">Invoice created</div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            There is no e-invoicing rulebook behind {format.name}, so Stampbench has nothing to check
            your invoice against and will not show a tick it has not earned. The totals were computed
            exactly and the invoice is ready to download. If you need a compliance check, go back and
            change the format to{' '}
            <span className="font-medium text-text">{RULESETS.en16931.label}</span>, then create it
            again.
          </p>
        </div>
      )}

      {validation && validation.violations.length > 0 && (
        <Violations result={validation} tech={tech} />
      )}

      {xml && validation && !validation.valid && format.validationProfile && (
        <RepairPanel xml={xml} profile={format.validationProfile} onUseRepaired={setXml} />
      )}

      {/* Downloads. Two buttons, both named for what the person receives: the
          copy they will recognise, and the file their customer's system reads.
          "XML", "UBL" and "JSON" are formats, not outcomes: they live under
          the fold with the rest of the machinery. */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-1 font-medium tracking-tight">Download your invoice</h3>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted">
          Send both to your customer if you are not sure which they need. Everything is produced here
          in your browser: nothing was uploaded.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void onDownloadPdf()} disabled={pdfBusy} className={BUTTON_PRIMARY}>
            {pdfBusy ? 'Building PDF…' : 'Download PDF'}
          </button>
          {xml && (
            <button
              onClick={() => void saveFile(`${filename}.xml`, xml, XML_FILE)}
              className={BUTTON_SECONDARY}
            >
              Download e-invoice file
            </button>
          )}
          <button onClick={() => window.print()} className={BUTTON_SECONDARY}>
            Print
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-faint">
          The PDF is the readable copy. The e-invoice file is the structured version your customer’s
          accounting software reads field by field
          {xml ? ': it is what the compliance check above was run on.' : '.'}
        </p>
        {pdfError && <p className="mt-3 text-sm text-danger">{pdfError}</p>}
        {paidPlan === false && (
          <p className="mt-3 text-xs leading-relaxed text-faint">
            The PDF carries a small &quot;Made with stampbench.com&quot; line.{' '}
            <Link href="/pricing" className="text-accent-hi hover:underline">
              Paid plans
            </Link>{' '}
            remove it: and back up every invoice you ever create.
          </p>
        )}

        {/* Everything a developer would want from this screen, in one place,
            revealed by the same switch as the rule ids above. */}
        {tech && (
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="mb-3 text-sm font-medium">Other formats</h4>
            <div className="flex flex-wrap gap-2">
              {xml && (
                <button onClick={() => copy('xml', xml)} className={BUTTON_SECONDARY}>
                  {copied === 'xml' ? 'Copied' : 'Copy UBL XML'}
                </button>
              )}
              <button
                onClick={() => void saveFile(`${filename}.json`, generated.json, JSON_FILE)}
                className={BUTTON_SECONDARY}
              >
                Download JSON
              </button>
              <button onClick={() => copy('json', generated.json)} className={BUTTON_SECONDARY}>
                {copied === 'json' ? 'Copied' : 'Copy JSON'}
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
        )}
      </div>

      {tech && xml && format.validationProfile && (
        <ApiPanel xml={xml} profile={format.validationProfile} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onStartAnother} className={BUTTON_SECONDARY}>
          Create another invoice
        </button>
        <button onClick={onBack} className={BUTTON_QUIET}>
          ← Back to the editor
        </button>
        <Link href="/my-invoices" className="text-sm text-muted transition hover:text-text">
          Saved to <span className="font-medium text-accent-hi">My invoices</span>: in this browser
          only
        </Link>
      </div>

      {/* The one bridge from the business experience to the developer one.
          Quiet, factual, and only shown while the technical view is off: a
          developer who has already flipped the switch is looking at the API
          panel instead. */}
      {!tech && xml && format.validationProfile && (
        <p className="text-xs leading-relaxed text-faint">
          Creating a lot of these?{' '}
          <Link href="/developers" className="text-accent-hi hover:underline">
            Stampbench has an API
          </Link>{' '}
          your software can call to produce the same invoice automatically.
        </p>
      )}
    </div>
  );
}
