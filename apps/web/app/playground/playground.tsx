'use client';

import { useState } from 'react';
import { SAMPLE_GENERATE_JSON, SAMPLE_XML } from './samples';

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

export function Playground() {
  const [tab, setTab] = useState<'validate' | 'generate'>('validate');
  const [xml, setXml] = useState('');
  const [genJson, setGenJson] = useState(SAMPLE_GENERATE_JSON);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [genResult, setGenResult] = useState<{ xml: string; validation?: ValidationResult } | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
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

  async function runValidate() {
    setBusy('validate');
    setError(null);
    setExplanation(null);
    setResult(null);
    try {
      setResult(await post('/api/v1/validate', { xml, profile: 'xrechnung' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runGenerate() {
    setBusy('generate');
    setError(null);
    setGenResult(null);
    try {
      const parsed = JSON.parse(genJson);
      setGenResult(await post('/api/v1/generate', parsed));
    } catch (e) {
      setError(e instanceof SyntaxError ? 'Input is not valid JSON.' : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runExplain() {
    if (!result?.violations.length) return;
    setBusy('explain');
    setError(null);
    try {
      const data = await post('/api/ai/explain', { violations: result.violations });
      setExplanation(data.explanation);
    } catch (e) {
      setError((e as Error).message);
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
                <button onClick={() => setXml(SAMPLE_XML)} className="text-accent-hi hover:underline">
                  Load valid sample
                </button>
                <button
                  onClick={() =>
                    setXml(SAMPLE_XML.replace(/ *<cbc:BuyerReference>.*<\/cbc:BuyerReference>\n/, '').replace('<cbc:Percent>19</cbc:Percent>', '<cbc:Percent>16</cbc:Percent>'))
                  }
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
                file.text().then(setXml).catch(() => setError('Could not read the dropped file.'));
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
                </p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              {result && (
                <>
                  <ViolationList result={result} />
                  {result.violations.length > 0 && (
                    <button
                      onClick={runExplain}
                      disabled={busy !== null}
                      className="mt-4 rounded-lg border border-accent/40 bg-accent-dim/40 px-4 py-2 text-sm font-medium text-accent-hi transition hover:bg-accent-dim disabled:opacity-40"
                    >
                      {busy === 'explain' ? 'Thinking…' : '✦ Explain with AI'}
                    </button>
                  )}
                  {explanation && (
                    <div
                      className="prose-ig mt-4 rounded-lg border border-border bg-surface p-4 text-sm"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownish(explanation) }}
                    />
                  )}
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
                  Send lines with quantities, prices and VAT categories — InvoiceGate computes the
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
