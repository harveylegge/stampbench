'use client';

import { useEffect, useState } from 'react';
import { fixXml, type FixResult } from '@stampbench/core';

/**
 * 'Fix automatically' — the flagship demo. Free and unmetered on purpose: the
 * repair engine ships in the open-source library, and the pricing page promises
 * local validation stays unlimited, so gating it here would contradict our own
 * copy. Everything runs in the browser; the XML never leaves the machine.
 *
 * The engine only ever writes values it derived arithmetically from the rest
 * of the document. Anything needing business data is reported as unfixable
 * with the reason — shown verbatim, because "we refused to guess" is the
 * feature, not a shortcoming.
 */

interface ChangedLine {
  /** 1-based line number in the original document. */
  line: number;
  before: string;
  after: string;
}

/**
 * Line-level diff. Repairs are in-place value replacements, so the fixed
 * document has exactly the same line count as the input and a pairwise
 * comparison is the whole diff; the padding is belt-and-braces.
 */
function changedLines(before: string, after: string): ChangedLine[] {
  const a = before.split(/\r\n|\r|\n/);
  const b = after.split(/\r\n|\r|\n/);
  const changed: ChangedLine[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? '') !== (b[i] ?? '')) {
      changed.push({ line: i + 1, before: a[i] ?? '', after: b[i] ?? '' });
    }
  }
  return changed;
}

/** "rechnung-042.xml" → "rechnung-042.fixed.xml"; pasted input → "invoice.fixed.xml". */
function fixedFilename(original: string | null): string {
  return (original ?? 'invoice.xml').replace(/\.xml$/i, '') + '.fixed.xml';
}

export function FixPanel({
  xml,
  fileName,
  onUseFixed,
}: {
  xml: string;
  fileName: string | null;
  onUseFixed: (fixed: string) => void;
}) {
  const [fix, setFix] = useState<FixResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A fix belongs to the exact text it was computed from — new input, fresh panel.
  useEffect(() => {
    setFix(null);
    setError(null);
  }, [xml]);

  function runFix() {
    setError(null);
    try {
      setFix(fixXml(xml, { profile: 'xrechnung' }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function download() {
    if (!fix) return;
    const url = URL.createObjectURL(new Blob([fix.xml], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fixedFilename(fileName);
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!fix) {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <button
          onClick={runFix}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hi"
        >
          Fix automatically
        </button>
        <p className="mt-2 text-xs text-faint">
          Free, in your browser. Repairs only values the rules can derive arithmetically — it will
          not guess business data.
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const applied = fix.applied.length;
  const diff = changedLines(xml, fix.xml);

  return (
    <div className="mt-4 border-t border-border pt-4 text-sm">
      {applied > 0 ? (
        <p className={`font-medium ${fix.valid ? 'text-success' : 'text-text'}`}>
          {fix.valid ? '✓ ' : ''}
          {applied} fix{applied === 1 ? '' : 'es'} applied — errors {fix.errorsBefore} →{' '}
          {fix.errorsAfter}.{fix.valid && ' The document now validates.'}
        </p>
      ) : (
        <p className="font-medium">
          {fix.errorsBefore === 0
            ? 'Nothing to fix — there are no blocking errors. Warnings usually need business context, not arithmetic.'
            : 'Nothing could be fixed automatically.'}
        </p>
      )}

      {applied > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {fix.applied.map((e, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-xs text-accent-hi">{e.ruleId}</span>
              <span className="font-mono text-xs text-muted">
                {e.previous} → {e.replacement}
              </span>
              <span className="font-mono text-xs text-faint">
                line {e.line}
                {e.path ? ` · ${e.path}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {fix.unfixable.length > 0 && (
        <div className="mt-3">
          <p className="text-muted">
            Not fixed ({fix.unfixable.length}) — these need business data or a decision we will not
            guess:
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {fix.unfixable.map((u, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-accent-hi">{u.ruleId}</span>{' '}
                <span className="text-faint">{u.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted">Changed lines</p>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface py-1 font-mono text-xs leading-relaxed">
            {diff.map((d) => (
              <div key={d.line} className="min-w-max">
                <div className="flex bg-danger/10 text-danger">
                  <span className="w-12 shrink-0 select-none pr-2 text-right text-faint">
                    {d.line}
                  </span>
                  <span className="whitespace-pre pr-4">- {d.before}</span>
                </div>
                <div className="flex bg-success/10 text-success">
                  <span className="w-12 shrink-0 select-none pr-2 text-right text-faint">
                    {d.line}
                  </span>
                  <span className="whitespace-pre pr-4">+ {d.after}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {applied > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onUseFixed(fix.xml)}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hi"
          >
            Use fixed XML
          </button>
          <button
            onClick={download}
            className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-muted transition hover:border-border-hi hover:text-text"
          >
            Download fixed XML
          </button>
        </div>
      )}
    </div>
  );
}
