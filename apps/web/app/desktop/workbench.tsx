'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { locateViolations, validateXml, type Profile as EngineProfile } from '@stampbench/core';
import { StampbenchMark } from '@/components/logo';
import { SAMPLE_XML } from '@/app/playground/samples';

const FAILING_SAMPLE = SAMPLE_XML.replace(
  '<cbc:LineExtensionAmount currencyID="EUR">950.00</cbc:LineExtensionAmount>',
  '<cbc:LineExtensionAmount currencyID="EUR">940.00</cbc:LineExtensionAmount>',
);

const NAV = [
  ['overview', 'Overview', '⌂'],
  ['workbench', 'Workbench', '⌘'],
  ['recent', 'Documents', '◫'],
  ['rules', 'Rulesets', '≡'],
  ['exports', 'Reports', '↗'],
  ['connections', 'Connections', '⎋'],
] as const;

type Screen = (typeof NAV)[number][0];
type CheckedDocument = {
  name: string;
  source: string;
  valid: boolean;
  errors: number;
  warnings: number;
  syntax: string;
  profile: EngineProfile;
  checkedAt: string;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

export function DesktopWorkbench() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<Screen>('overview');
  const [profile, setProfile] = useState<EngineProfile>('xrechnung');
  const [source, setSource] = useState(FAILING_SAMPLE);
  const [fileName, setFileName] = useState('invoice-0042.xml');
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState(() => validateXml(FAILING_SAMPLE, { profile: 'xrechnung' }));
  const [validatedSource, setValidatedSource] = useState(FAILING_SAMPLE);
  const [checkedAt, setCheckedAt] = useState(() => new Date().toISOString());
  const [sha256, setSha256] = useState('Calculating');
  const [documents, setDocuments] = useState<CheckedDocument[]>([]);
  const [archiveReady, setArchiveReady] = useState(false);

  const located = useMemo(
    () => locateViolations(validatedSource, result.violations, result.syntax ?? 'ubl'),
    [result, validatedSource],
  );
  const edited = source !== validatedSource;

  useEffect(() => {
    let cancelled = false;
    void crypto.subtle.digest('SHA-256', new TextEncoder().encode(validatedSource)).then((digest) => {
      if (cancelled) return;
      const next = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      setSha256(next);
    });
    return () => { cancelled = true; };
  }, [validatedSource]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('stampbench.desktop.documents.v1');
      if (saved) setDocuments(JSON.parse(saved) as CheckedDocument[]);
    } finally {
      setArchiveReady(true);
    }
  }, []);

  useEffect(() => {
    if (!archiveReady) return;
    localStorage.setItem('stampbench.desktop.documents.v1', JSON.stringify(documents));
  }, [archiveReady, documents]);

  function inspect(nextSource = source, nextProfile = profile, nextName = fileName, addToBatch = false) {
    const nextResult = validateXml(nextSource, { profile: nextProfile });
    const timestamp = new Date().toISOString();
    setResult(nextResult);
    setValidatedSource(nextSource);
    setCheckedAt(timestamp);
    if (addToBatch) {
      const next: CheckedDocument = {
        name: nextName,
        source: nextSource,
        valid: nextResult.valid,
        errors: nextResult.errorCount,
        warnings: nextResult.warningCount,
        syntax: nextResult.syntax?.toUpperCase() ?? 'Unknown',
        profile: nextProfile,
        checkedAt: timestamp,
      };
      setDocuments((current) => [next, ...current.filter((item) => item.name !== nextName)].slice(0, 50));
    }
    return nextResult;
  }

  async function openFiles(files: FileList | File[]) {
    const selected = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.xml'));
    if (!selected.length) return;
    const loaded = await Promise.all(selected.map(async (file) => ({ name: file.name, source: await file.text() })));
    const batch = loaded.map(({ name, source: documentSource }) => {
      const checked = validateXml(documentSource, { profile });
      return {
        name,
        source: documentSource,
        valid: checked.valid,
        errors: checked.errorCount,
        warnings: checked.warningCount,
        syntax: checked.syntax?.toUpperCase() ?? 'Unknown',
        profile,
        checkedAt: new Date().toISOString(),
      } satisfies CheckedDocument;
    });
    setDocuments((current) => [...batch, ...current.filter((item) => !batch.some((next) => next.name === item.name))].slice(0, 50));
    const first = loaded[0];
    setFileName(first.name);
    setSource(first.source);
    inspect(first.source, profile, first.name);
    if (loaded.length > 1) setActive('recent');
  }

  function loadSample(passing: boolean) {
    const nextSource = passing ? SAMPLE_XML : FAILING_SAMPLE;
    const nextName = passing ? 'valid-xrechnung.xml' : 'invoice-0042.xml';
    setFileName(nextName);
    setSource(nextSource);
    inspect(nextSource, profile, nextName, true);
  }

  function openDocument(document: CheckedDocument) {
    setFileName(document.name);
    setSource(document.source);
    setProfile(document.profile);
    inspect(document.source, document.profile, document.name);
    setActive('workbench');
  }

  function exportReport() {
    const report = {
      product: 'Stampbench Desktop',
      document: fileName,
      sha256,
      checkedAt,
      profile: result.profile,
      syntax: result.syntax,
      rulesetVersion: result.meta.rulesetVersion,
      rulesRun: result.meta.rulesRun,
      valid: result.valid,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      findings: located,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName.replace(/\.xml$/i, '')}-validation-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const titles: Record<Screen, [string, string]> = {
    overview: ['Local desk / 00', 'Invoice control centre'],
    workbench: ['Inspection desk / 01', 'Invoice workbench'],
    recent: ['Document register / 02', 'Local invoice archive'],
    rules: ['Configuration / 03', 'Validation profiles'],
    exports: ['Evidence / 04', 'Audit report'],
    connections: ['Delivery / 05', 'Connections'],
  };

  return (
    <div className="desktop-app-preview min-h-screen bg-[#d8d2c6] p-0 text-[#20231f] sm:p-4 lg:p-6">
      <section className="mx-auto flex min-h-screen max-w-[1540px] flex-col overflow-hidden border-[#20231f]/25 bg-[#f4efe3] shadow-[0_24px_80px_rgba(41,35,24,.16)] sm:min-h-[calc(100vh-2rem)] sm:border lg:min-h-[calc(100vh-3rem)]">
        <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#20231f]/15 px-4">
          <div className="flex gap-2" aria-hidden="true"><i className="h-2.5 w-2.5 rounded-full bg-[#c7442d]" /><i className="h-2.5 w-2.5 rounded-full border border-[#20231f]/30" /><i className="h-2.5 w-2.5 rounded-full border border-[#20231f]/30" /></div>
          <div className="flex items-center gap-2 text-xs font-semibold"><StampbenchMark size={16} /> Stampbench</div>
          <div className="justify-self-end font-mono text-[8px] uppercase tracking-[.14em] text-[#767970]">Desktop · local session</div>
        </header>

        <div className="grid flex-1 md:grid-cols-[216px_1fr]">
          <aside className="flex flex-col border-b border-[#20231f]/15 bg-[#eee8dc] md:border-b-0 md:border-r">
            <div className="border-b border-[#20231f]/15 p-4"><p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#777970]">Workspace</p><p className="mt-2 truncate text-sm font-semibold">Local invoices</p><p className="mt-1 text-[11px] text-[#6a6d65]">Files stay on this device</p></div>
            <nav className="grid grid-cols-2 p-2 md:grid-cols-1" aria-label="Desktop sections">
              {NAV.map(([id, label, icon]) => <button key={id} type="button" onClick={() => setActive(id)} className={`flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-left text-xs transition-colors ${active === id ? 'bg-[#20231f] text-[#f6f1e6]' : 'text-[#555850] hover:bg-[#ded7c9] hover:text-[#20231f]'}`}><span className="w-4 font-mono text-[11px] text-[#c7442d]">{icon}</span>{label}{id === 'recent' && documents.length > 0 ? <span className="ml-auto font-mono text-[8px]">{documents.length}</span> : null}</button>)}
            </nav>
            <div className="mt-auto hidden border-t border-[#20231f]/15 p-4 md:block"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#35765b]" /><span className="font-mono text-[8px] uppercase tracking-[.12em] text-[#62665e]">Engine ready</span></div><p className="mt-2 text-[10px] leading-4 text-[#777970]">No network connection required for validation.</p></div>
          </aside>

          <main className="min-w-0 bg-[#f7f3e9]">
            <div className="flex flex-col gap-4 border-b border-[#20231f]/15 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
              <div><p className="font-mono text-[8px] uppercase tracking-[.15em] text-[#c7442d]">{titles[active][0]}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-.035em]">{titles[active][1]}</h1></div>
              <div className="flex flex-wrap gap-2">
                <input ref={inputRef} multiple type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={(event) => event.target.files && void openFiles(event.target.files)} />
                <button type="button" onClick={() => inputRef.current?.click()} className="rounded-[4px] border border-[#20231f]/25 bg-[#fbf8f0] px-4 py-2 text-xs font-semibold transition-colors hover:border-[#20231f]">Open XML files</button>
                {active === 'overview' && <button type="button" onClick={() => setActive('workbench')} className="rounded-[4px] bg-[#20231f] px-4 py-2 text-xs font-semibold text-[#faf7ef]">Inspect an invoice ↗</button>}
                {active === 'workbench' && <button type="button" onClick={() => inspect()} className="rounded-[4px] bg-[#20231f] px-4 py-2 text-xs font-semibold text-[#faf7ef] transition-transform hover:-translate-y-px">Run inspection ↗</button>}
                {active === 'exports' && <button type="button" onClick={exportReport} className="rounded-[4px] bg-[#20231f] px-4 py-2 text-xs font-semibold text-[#faf7ef]">Download JSON report</button>}
              </div>
            </div>

            {active === 'overview' && <OverviewScreen documents={documents} fileName={fileName} result={result} openWorkbench={() => setActive('workbench')} openDocuments={() => setActive('recent')} />}
            {active === 'workbench' && <WorkbenchScreen fileName={fileName} source={source} setSource={setSource} result={result} edited={edited} located={located} profile={profile} setProfile={(next) => { setProfile(next); inspect(source, next); }} isDragging={isDragging} setIsDragging={setIsDragging} openFiles={openFiles} loadSample={loadSample} exportReport={exportReport} />}
            {active === 'recent' && <BatchScreen documents={documents} openDocument={openDocument} openPicker={() => inputRef.current?.click()} />}
            {active === 'rules' && <RulesScreen profile={profile} selectProfile={(next) => { setProfile(next); inspect(source, next); }} />}
            {active === 'exports' && <ReportScreen fileName={fileName} result={result} located={located} checkedAt={checkedAt} sha256={sha256} exportReport={exportReport} />}
            {active === 'connections' && <ConnectionsScreen />}
          </main>
        </div>
      </section>
    </div>
  );
}

type Result = ReturnType<typeof validateXml>;
type Located = ReturnType<typeof locateViolations>;

function OverviewScreen({ documents, fileName, result, openWorkbench, openDocuments }: { documents: CheckedDocument[]; fileName: string; result: Result; openWorkbench: () => void; openDocuments: () => void }) {
  const passed = documents.filter((item) => item.valid).length;
  const blocked = documents.length - passed;
  return <section className="p-5 lg:p-7">
    <div className="grid border-y border-l border-[#20231f]/15 sm:grid-cols-4">
      {[
        ['Local documents', String(documents.length)],
        ['Ready', String(passed)],
        ['Needs attention', String(blocked)],
        ['Active profile', result.profile === 'xrechnung' ? 'XRechnung' : 'EN 16931'],
      ].map(([label, value]) => <div key={label} className="border-r border-b border-[#20231f]/15 p-5 sm:border-b-0"><p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#777a72]">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-.04em]">{value}</p></div>)}
    </div>
    <div className="mt-7 grid gap-7 xl:grid-cols-[1.2fr_.8fr]">
      <div className="border border-[#20231f]/15 bg-[#fbf8f0]">
        <div className="flex items-center justify-between border-b border-[#20231f]/15 p-5"><div><p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#777a72]">Open inspection</p><h2 className="mt-2 text-lg font-semibold">{fileName}</h2></div><span className={`border px-3 py-2 font-mono text-[8px] uppercase ${result.valid ? 'border-[#35765b] text-[#35765b]' : 'border-[#b33f2b] text-[#b33f2b]'}`}>{result.valid ? 'Ready' : `${result.errorCount} blocking`}</span></div>
        <div className="grid sm:grid-cols-3">{[['Syntax', result.syntax?.toUpperCase() ?? 'Unknown'], ['Rules', String(result.meta.rulesRun)], ['Ruleset', result.meta.rulesetVersion]].map(([term, value]) => <dl key={term} className="border-b border-[#20231f]/15 p-5 sm:border-r"><dt className="font-mono text-[8px] uppercase tracking-[.12em] text-[#7a7d75]">{term}</dt><dd className="mt-2 text-xs font-semibold">{value}</dd></dl>)}</div>
        <div className="flex flex-wrap gap-2 p-5"><button type="button" onClick={openWorkbench} className="rounded-[4px] bg-[#20231f] px-4 py-2.5 text-xs font-semibold text-[#f8f4ea]">Open inspection</button><button type="button" onClick={openDocuments} className="rounded-[4px] border border-[#20231f]/25 px-4 py-2.5 text-xs font-semibold">View local archive</button></div>
      </div>
      <div className="border border-[#20231f]/15 p-5">
        <p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#c7442d]">Document route</p>
        <ol className="mt-5 space-y-4">{[['01', 'Receive', 'Open one XML or drop a batch.'], ['02', 'Inspect', 'Run the selected semantic profile.'], ['03', 'Resolve', 'Use rule IDs and source locations.'], ['04', 'Evidence', 'Export a fingerprinted report.']].map(([index, title, detail]) => <li key={index} className="grid grid-cols-[28px_1fr] gap-3 border-b border-[#20231f]/10 pb-4"><span className="font-mono text-[8px] text-[#c7442d]">{index}</span><span><strong className="block text-xs">{title}</strong><span className="mt-1 block text-[11px] leading-4 text-[#6d7068]">{detail}</span></span></li>)}</ol>
      </div>
    </div>
    <div className="mt-7 flex flex-col justify-between gap-4 border border-[#20231f]/15 bg-[#eee8dc] p-5 sm:flex-row sm:items-center"><div><p className="font-mono text-[8px] uppercase tracking-[.13em] text-[#777a72]">Invoice creation</p><p className="mt-2 text-xs text-[#5f635b]">Create a structured invoice with Stampbench’s existing local builder.</p></div><a href="/invoice-generator" className="rounded-[4px] border border-[#20231f]/25 bg-[#f9f5eb] px-4 py-2.5 text-center text-xs font-semibold">Open invoice builder ↗</a></div>
  </section>;
}

function ConnectionsScreen() {
  const connections = [
    ['Local folder', 'Available now', 'Open or drop XML documents. Nothing is transmitted.', 'READY'],
    ['Xero', 'Not connected', 'A future OAuth connection can exchange invoice data after explicit user approval.', 'PLANNED'],
    ['Peppol access point', 'Not configured', 'Delivery requires a contracted access-point provider and recipient routing.', 'PLANNED'],
    ['Accounting export', 'Local files', 'Structured reports can be downloaded without connecting an external account.', 'READY'],
  ];
  return <section className="p-5 lg:p-7"><p className="max-w-2xl text-sm leading-6 text-[#5c6058]">Connections are optional. Local validation remains available without an account or network connection. Stampbench does not currently claim a Xero partnership or operate a Peppol access point.</p><div className="mt-8 border-t border-[#20231f]/15">{connections.map(([name, status, detail, state]) => <div key={name} className="grid gap-3 border-b border-[#20231f]/15 p-5 lg:grid-cols-[180px_150px_1fr_80px]"><strong className="text-xs">{name}</strong><span className="font-mono text-[9px] text-[#676b62]">{status}</span><span className="max-w-2xl text-xs leading-5 text-[#676b62]">{detail}</span><span className={`justify-self-start border px-2 py-1 font-mono text-[8px] ${state === 'READY' ? 'border-[#35765b] text-[#35765b]' : 'border-[#20231f]/20 text-[#7a7d75]'}`}>{state}</span></div>)}</div><div className="mt-8 border-l-2 border-[#c7442d] bg-[#eee8dc] p-5"><p className="text-xs font-semibold">Integration rule</p><p className="mt-2 max-w-3xl text-xs leading-5 text-[#666a62]">No external service receives invoice data until the user connects that service and chooses a document action. Connection status and destination will remain visible beside every future send operation.</p></div></section>;
}

function WorkbenchScreen({ fileName, source, setSource, result, edited, located, profile, setProfile, isDragging, setIsDragging, openFiles, loadSample, exportReport }: {
  fileName: string; source: string; setSource: (value: string) => void; result: Result; edited: boolean; located: Located; profile: EngineProfile; setProfile: (value: EngineProfile) => void; isDragging: boolean; setIsDragging: (value: boolean) => void; openFiles: (files: FileList | File[]) => Promise<void>; loadSample: (passing: boolean) => void; exportReport: () => void;
}) {
  return <>
    <div className="grid border-b border-[#20231f]/15 sm:grid-cols-4">{[['Document', fileName], ['Syntax', result.syntax?.toUpperCase() ?? 'Unknown'], ['Rules executed', String(result.meta.rulesRun)], ['Status', edited ? 'Needs inspection' : result.valid ? 'Ready' : `${result.errorCount} blocking`]].map(([term, value], index) => <dl key={term} className={`px-5 py-3.5 ${index ? 'border-t border-[#20231f]/15 sm:border-l sm:border-t-0' : ''}`}><dt className="font-mono text-[8px] uppercase tracking-[.13em] text-[#7b7e75]">{term}</dt><dd className={`mt-1 truncate text-xs font-semibold ${term === 'Status' ? result.valid && !edited ? 'text-[#35765b]' : 'text-[#b33f2b]' : ''}`}>{value}</dd></dl>)}</div>
    <div className="grid min-h-[620px] xl:grid-cols-[1.08fr_.92fr]">
      <section className="min-w-0 border-b border-[#20231f]/15 xl:border-b-0 xl:border-r"><div className="flex h-11 items-center justify-between border-b border-[#20231f]/15 px-5"><span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#666a62]">Source document</span><div className="flex gap-1"><button type="button" onClick={() => loadSample(false)} className="px-2 py-1 font-mono text-[8px] text-[#777970] hover:text-[#20231f]">Failing sample</button><button type="button" onClick={() => loadSample(true)} className="px-2 py-1 font-mono text-[8px] text-[#777970] hover:text-[#20231f]">Passing sample</button></div></div><div className={`relative min-h-[576px] transition-colors ${isDragging ? 'bg-[#c7442d]/10' : 'bg-[#151714]'}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void openFiles(event.dataTransfer.files); }}>{isDragging && <div className="absolute inset-4 z-10 grid place-items-center border border-dashed border-[#e5a38e] bg-[#151714]/90 font-mono text-[10px] uppercase tracking-[.14em] text-[#efb39e]">Drop one or more XML invoices</div>}<div className="grid grid-cols-[46px_1fr]"><div className="select-none overflow-hidden border-r border-white/10 py-4 pr-3 text-right font-mono text-[10px] leading-6 text-[#53584f]" aria-hidden="true">{Array.from({ length: Math.max(24, source.split('\n').length) }, (_, index) => <div key={index}>{String(index + 1).padStart(2, '0')}</div>)}</div><textarea value={source} onChange={(event) => setSource(event.target.value)} aria-label="Invoice XML source" spellCheck={false} className="min-h-[576px] w-full resize-none bg-transparent p-4 font-mono text-[10px] leading-6 text-[#d7d9d1] outline-none focus:bg-white/[.02]" /></div></div></section>
      <section className="min-w-0 bg-[#f4efe3]"><div className="flex h-11 items-center justify-between border-b border-[#20231f]/15 px-5"><span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#666a62]">Findings</span><select value={profile} onChange={(event) => setProfile(event.target.value as EngineProfile)} aria-label="Validation ruleset" className="border-0 bg-transparent font-mono text-[8px] uppercase tracking-[.1em] text-[#5e625a] outline-none"><option value="xrechnung">XRechnung 3.0</option><option value="en16931">EN 16931 core</option></select></div><div className="p-5 lg:p-6" aria-live="polite"><div className={`border-l-2 p-4 ${edited ? 'border-[#a67b32] bg-[#a67b32]/8' : result.valid ? 'border-[#35765b] bg-[#35765b]/8' : 'border-[#c7442d] bg-[#c7442d]/8'}`}><p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#6e7169]">Inspection result</p><p className="mt-2 text-lg font-semibold tracking-[-.02em]">{edited ? 'Document changed' : result.valid ? 'Ready to send' : `${result.errorCount} blocking ${result.errorCount === 1 ? 'finding' : 'findings'}`}</p><p className="mt-1 text-xs leading-5 text-[#64675f]">{edited ? 'Run the inspection again to refresh the findings.' : result.valid ? `Passed all ${result.meta.rulesRun} rules in this profile.` : 'Resolve blocking findings before sending this invoice.'}</p></div>{!edited && !result.valid && <div className="mt-5 divide-y divide-[#20231f]/15 border-y border-[#20231f]/15">{located.slice(0, 6).map((violation, index) => <article key={`${violation.ruleId}-${index}`} className="py-4"><div className="flex items-start justify-between gap-4"><strong className="font-mono text-[10px] text-[#b33f2b]">{violation.ruleId}</strong><span className="font-mono text-[8px] uppercase tracking-[.1em] text-[#85887f]">{violation.severity}{violation.location.line ? ` · line ${violation.location.line}` : ''}</span></div><p className="mt-2 text-xs leading-5 text-[#4f534c]">{violation.message}</p><div className="mt-2 flex flex-wrap gap-3 font-mono text-[8px] text-[#83867d]">{violation.terms?.length ? <span>{violation.terms.join(' / ')}</span> : null}<span>{violation.location.precision} location</span></div></article>)}</div>}<div className="mt-6 border-t border-[#20231f]/15 pt-5"><p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#797c74]">Evidence</p><button type="button" onClick={exportReport} disabled={edited} className="mt-3 w-full rounded-[4px] bg-[#20231f] px-3 py-2.5 text-xs font-semibold text-[#f8f4ea] disabled:cursor-not-allowed disabled:opacity-35">Export validation report</button></div></div></section>
    </div>
  </>;
}

function BatchScreen({ documents, openDocument, openPicker }: { documents: CheckedDocument[]; openDocument: (document: CheckedDocument) => void; openPicker: () => void }) {
  const passed = documents.filter((item) => item.valid).length;
  return <section className="p-5 lg:p-7"><div className="grid border-y border-l border-[#20231f]/15 sm:grid-cols-3">{[['Documents', String(documents.length)], ['Passed', String(passed)], ['Needs attention', String(documents.length - passed)]].map(([label, value]) => <div key={label} className="border-r border-b border-[#20231f]/15 p-5 sm:border-b-0"><p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#777a72]">{label}</p><p className="mt-3 text-3xl font-semibold tracking-[-.05em]">{value}</p></div>)}</div>{documents.length ? <div className="mt-7 border-t border-[#20231f]/15">{documents.map((document) => <button type="button" key={`${document.name}-${document.checkedAt}`} onClick={() => openDocument(document)} className="grid w-full grid-cols-[1fr_auto] gap-4 border-b border-[#20231f]/15 py-4 text-left hover:bg-[#eee8dc] sm:grid-cols-[1fr_90px_110px_110px]"><span className="truncate px-3 text-xs font-semibold">{document.name}</span><span className="hidden font-mono text-[9px] text-[#767970] sm:block">{document.syntax}</span><span className={`font-mono text-[9px] ${document.valid ? 'text-[#35765b]' : 'text-[#b33f2b]'}`}>{document.valid ? 'PASSED' : `${document.errors} ERRORS`}</span><span className="hidden pr-3 text-right font-mono text-[9px] text-[#767970] sm:block">{formatTime(document.checkedAt)}</span></button>)}</div> : <div className="mt-16 text-center"><p className="text-lg font-semibold">No batch inspected yet</p><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#686b63]">Open several XML files together. Stampbench checks each file independently, so one malformed invoice does not stop the rest.</p><button type="button" onClick={openPicker} className="mt-5 rounded-[4px] bg-[#20231f] px-4 py-2.5 text-xs font-semibold text-[#f8f4ea]">Choose XML files</button></div>}</section>;
}

function RulesScreen({ profile, selectProfile }: { profile: EngineProfile; selectProfile: (profile: EngineProfile) => void }) {
  const rules = [
    { id: 'en16931' as const, label: 'EN 16931 core', version: 'EN 16931-1:2017', count: '40 rules', scope: 'European semantic core for UBL 2.1 and CII documents.' },
    { id: 'xrechnung' as const, label: 'XRechnung 3.0', version: 'German CIUS', count: '56 rules', scope: 'The 40 core checks plus 16 German business-rule additions.' },
  ];
  return <section className="p-5 lg:p-7"><p className="max-w-2xl text-sm leading-6 text-[#5c6058]">Profiles are explicit and versioned. Changing the active profile immediately rechecks the open document. Stampbench does not claim complete KoSIT parity.</p><div className="mt-8 border-t border-[#20231f]/15">{rules.map((rule) => <button key={rule.id} type="button" onClick={() => selectProfile(rule.id)} className={`grid w-full gap-4 border-b border-[#20231f]/15 p-5 text-left transition-colors sm:grid-cols-[1fr_150px_100px] ${profile === rule.id ? 'bg-[#eee8dc]' : 'hover:bg-[#f1ecdf]'}`}><span><span className="flex items-center gap-3 text-sm font-semibold"><i className={`h-2 w-2 rounded-full ${profile === rule.id ? 'bg-[#c7442d]' : 'border border-[#20231f]/30'}`} />{rule.label}</span><span className="mt-2 block text-xs leading-5 text-[#666a62]">{rule.scope}</span></span><span className="font-mono text-[9px] uppercase tracking-[.1em] text-[#6d7168]">{rule.version}</span><span className="font-mono text-[9px] uppercase tracking-[.1em] text-[#6d7168]">{rule.count}</span></button>)}</div><div className="mt-8 grid border border-[#20231f]/15 p-5 sm:grid-cols-[180px_1fr]"><span className="font-mono text-[8px] uppercase tracking-[.14em] text-[#c7442d]">Configuration principle</span><p className="mt-3 text-xs leading-5 text-[#62665e] sm:mt-0">The selected ruleset, rules executed and ruleset version are written into every exported report so a later reviewer can identify exactly what was checked.</p></div></section>;
}

function ReportScreen({ fileName, result, located, checkedAt, sha256, exportReport }: { fileName: string; result: Result; located: Located; checkedAt: string; sha256: string; exportReport: () => void }) {
  return <section className="p-5 lg:p-7"><div className="mx-auto max-w-4xl border border-[#20231f]/25 bg-[#fbf8f0]"><div className="flex items-center justify-between border-b border-[#20231f]/15 p-5"><div><p className="font-mono text-[8px] uppercase tracking-[.14em] text-[#777a72]">Stampbench validation evidence</p><h2 className="mt-2 text-xl font-semibold">{fileName}</h2></div><span className={`border px-3 py-2 font-mono text-[9px] uppercase ${result.valid ? 'border-[#35765b] text-[#35765b]' : 'border-[#b33f2b] text-[#b33f2b]'}`}>{result.valid ? 'Passed' : 'Blocked'}</span></div><dl className="grid sm:grid-cols-2">{[['Checked', new Date(checkedAt).toLocaleString('en-GB')], ['Profile', result.profile], ['Ruleset', result.meta.rulesetVersion], ['Rules executed', String(result.meta.rulesRun)], ['Syntax', result.syntax?.toUpperCase() ?? 'Unknown'], ['Findings', `${result.errorCount} errors · ${result.warningCount} warnings`]].map(([term, value]) => <div key={term} className="border-b border-[#20231f]/15 p-5 sm:odd:border-r"><dt className="font-mono text-[8px] uppercase tracking-[.13em] text-[#7a7d75]">{term}</dt><dd className="mt-2 text-xs font-semibold">{value}</dd></div>)}</dl><div className="p-5"><p className="font-mono text-[8px] uppercase tracking-[.13em] text-[#7a7d75]">SHA-256 document fingerprint</p><p className="mt-2 break-all font-mono text-[9px] leading-5 text-[#555950]">{sha256}</p></div>{located.length > 0 && <div className="border-t border-[#20231f]/15 p-5"><p className="font-mono text-[8px] uppercase tracking-[.13em] text-[#7a7d75]">Rule findings</p><div className="mt-3 flex flex-wrap gap-2">{located.map((item, index) => <span key={`${item.ruleId}-${index}`} className="border border-[#20231f]/15 px-2 py-1 font-mono text-[9px] text-[#9c3d2d]">{item.ruleId}</span>)}</div></div>}<div className="border-t border-[#20231f]/15 p-5 text-right"><button type="button" onClick={exportReport} className="rounded-[4px] bg-[#20231f] px-4 py-2.5 text-xs font-semibold text-[#f8f4ea]">Download structured report</button></div></div></section>;
}
