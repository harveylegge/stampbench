'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, getReport } from '@/lib/account-client';

/**
 * Read-only viewer for a shared validation report — the page an agency sends
 * its client, so it stays clean and makes no demands. The payload was written
 * by the playground's 'Share report' button and holds the verdict and
 * violation list only, never the XML. Parsed defensively: it crossed the
 * network, and an old link may carry an older shape.
 */

interface ReportViolation {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  terms?: string[];
  path?: string;
}

interface Report {
  verdict: boolean;
  violations: ReportViolation[];
  errorCount: number;
  warningCount: number;
  fileName?: string;
  createdAt: number;
}

function parseReport(payload: unknown, createdAt: number): Report {
  const p = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<
    string,
    unknown
  >;
  const violations: ReportViolation[] = Array.isArray(p.violations)
    ? p.violations.flatMap((v): ReportViolation[] => {
        if (typeof v !== 'object' || v === null) return [];
        const r = v as Record<string, unknown>;
        if (typeof r.ruleId !== 'string' || typeof r.message !== 'string') return [];
        return [
          {
            ruleId: r.ruleId,
            severity: r.severity === 'warning' ? 'warning' : 'error',
            message: r.message,
            ...(Array.isArray(r.terms)
              ? { terms: r.terms.filter((t): t is string => typeof t === 'string') }
              : {}),
            ...(typeof r.path === 'string' ? { path: r.path } : {}),
          },
        ];
      })
    : [];
  const errorCount =
    typeof p.errorCount === 'number'
      ? p.errorCount
      : violations.filter((v) => v.severity === 'error').length;
  const warningCount =
    typeof p.warningCount === 'number' ? p.warningCount : violations.length - errorCount;
  return {
    verdict: typeof p.verdict === 'boolean' ? p.verdict : errorCount === 0,
    violations,
    errorCount,
    warningCount,
    ...(typeof p.fileName === 'string' ? { fileName: p.fileName } : {}),
    createdAt,
  };
}

/** Mirrors the playground's violation cards — a report should look like the tool that made it. */
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

type ViewState =
  | { status: 'loading' }
  | { status: 'missing-id' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: Report };

export function ReportView() {
  const id = useSearchParams().get('id');
  const [state, setState] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    if (!id) {
      setState({ status: 'missing-id' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    getReport(id)
      .then((res) => {
        if (!cancelled) {
          setState({ status: 'ready', report: parseReport(res.payload, res.createdAt) });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setState({ status: 'not-found' });
        else {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Could not load the report.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const cta = (
    <Link
      href="/playground"
      className="mt-3 inline-block rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hi"
    >
      Validate your own invoice
    </Link>
  );

  if (state.status !== 'ready') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Validation report</h1>
        {state.status === 'loading' && <p className="mt-4 text-sm text-faint">Loading report…</p>}
        {state.status === 'missing-id' && (
          <p className="mt-4 text-sm text-muted">
            This link is missing its report id — check it was copied in full.
          </p>
        )}
        {state.status === 'not-found' && (
          <p className="mt-4 text-sm text-muted">
            Report not found. It may have been deleted, or the link was not copied in full.
          </p>
        )}
        {state.status === 'error' && <p className="mt-4 text-sm text-danger">{state.message}</p>}
        {state.status !== 'loading' && <div className="mt-6">{cta}</div>}
      </div>
    );
  }

  const { report } = state;
  const date = new Date(report.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Validation report</h1>
      <p className="mb-8 text-sm text-muted">
        {report.fileName ? `${report.fileName} · ` : ''}Shared {date} · Checked against EN 16931
        and XRechnung (BR-DE) rules.
      </p>

      {report.verdict ? (
        <div className="rounded-xl border border-success/40 bg-success/5 p-5">
          <p className="font-medium text-success">✓ Valid — no blocking errors</p>
          {report.warningCount > 0 && (
            <p className="mt-1 text-sm text-muted">
              {report.warningCount} warning{report.warningCount === 1 ? '' : 's'} worth reviewing
              below.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-5">
          <p className="font-medium text-danger">
            ✗ {report.errorCount} error{report.errorCount === 1 ? '' : 's'},{' '}
            {report.warningCount} warning{report.warningCount === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-sm text-muted">
            This document does not currently meet the rules it was checked against.
          </p>
        </div>
      )}

      {report.violations.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {report.violations.map((v, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <SeverityBadge severity={v.severity} />
                <span className="font-mono text-xs text-accent-hi">{v.ruleId}</span>
                {v.terms && v.terms.length > 0 && (
                  <span className="font-mono text-xs text-faint">{v.terms.join(', ')}</span>
                )}
                {v.path && <span className="font-mono text-xs text-faint">{v.path}</span>}
              </div>
              <p className="text-muted">{v.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">
          This report was produced with Stampbench — EN 16931 / XRechnung validation that runs
          entirely in the browser. The invoice itself was never uploaded; a report holds only the
          verdict and the rule violations.
        </p>
        {cta}
      </div>
    </div>
  );
}
