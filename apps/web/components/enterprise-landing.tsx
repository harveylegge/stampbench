'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { locateViolations, validateXml, type Profile as EngineProfile } from '@stampbench/core';
import { StampbenchMark } from '@/components/logo';
import { RULE_COUNTS } from '@/lib/markets';
import { SAMPLE_XML } from '@/app/playground/samples';

const BROKEN_SAMPLE_XML = SAMPLE_XML.replace(
  '<cbc:LineExtensionAmount currencyID="EUR">950.00</cbc:LineExtensionAmount>',
  '<cbc:LineExtensionAmount currencyID="EUR">940.00</cbc:LineExtensionAmount>',
);

const HERO_XML = [
  '<cac:LegalMonetaryTotal>',
  '  <cbc:LineExtensionAmount',
  '    currencyID="EUR">940.00</cbc:LineExtensionAmount>',
  '  <cbc:TaxExclusiveAmount',
  '    currencyID="EUR">950.00</cbc:TaxExclusiveAmount>',
  '</cac:LegalMonetaryTotal>',
];

const CAPABILITIES = [
  ['Syntax parsing', 'UBL 2.1 and UN/CEFACT CII are auto-detected from the XML document.'],
  ['Semantic validation', `${RULE_COUNTS.en16931} EN 16931 core rules or ${RULE_COUNTS.xrechnung} rules with the German profile.`],
  ['Source locations', 'Each finding can carry a line, column, XML path and stated location precision.'],
  ['Deterministic repair', 'Arithmetic errors with one derivable answer can be repaired without inventing business data.'],
  ['UBL generation', 'Structured invoice data can be computed and emitted as XRechnung 3.0 UBL.'],
  ['CLI and CI', 'The same TypeScript engine can run in a process, test pipeline or browser worker.'],
  ['Integration surfaces', 'Use the MIT library, command-line tool or browser worker inside an existing product workflow.'],
  ['Ruleset versioning', 'Every validation result identifies the ruleset version and number of rules executed.'],
] as const;

function Arrow() {
  return <span aria-hidden="true" className="inline-block transform transition-transform duration-300 ease-in-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>;
}

function SectionIndex({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f625b]">
      <span className="text-[#c7442d]">{number}</span>
      <span>{children}</span>
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const links = [
    ['Business', '/business'],
    ['Engine', '#engine'],
    ['Playground', '#playground-preview'],
    ['Documentation', '/docs'],
    ['Validation evidence', '/trust'],
    ['Integration pilot', '#pilot'],
  ] as const;

  return (
    <header className="border-b border-[#20231f]/15 bg-[#f4efe3]">
      <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-[#20231f]" aria-label="Stampbench home">
          <StampbenchMark size={20} />
          Stampbench
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-[#5f625b] lg:flex" aria-label="Main navigation">
          {links.map(([label, href]) => <Link key={href} href={href} className="transition-all duration-300 ease-in-out hover:text-slate-500">{label}</Link>)}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/signin" className="text-[13px] text-[#5f625b] transition-all duration-300 ease-in-out hover:text-slate-500">Sign in</Link>
          <Link href="/playground" className="group rounded-[4px] bg-[#20231f] px-4 py-2.5 text-[13px] font-semibold text-[#fdfbf7] transition-all duration-300 ease-in-out hover:-translate-y-px hover:bg-[#343831]">Run an invoice <Arrow /></Link>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-[4px] border border-[#20231f]/20 px-3 py-2 text-xs text-[#20231f] lg:hidden" aria-expanded={open}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <nav className="border-t border-[#20231f]/15 px-5 py-4 lg:hidden" aria-label="Mobile navigation">
          <div className="mx-auto grid max-w-[1280px]">
            {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="border-b border-[#20231f]/10 py-3 text-sm text-[#40443d]">{label}</Link>)}
            <Link href="/playground" className="mt-4 rounded-[4px] bg-[#20231f] px-4 py-3 text-center text-sm font-semibold text-[#fdfbf7]">Run an invoice</Link>
          </div>
        </nav>
      )}
    </header>
  );
}

function MetadataStrip({ metadata }: { metadata: readonly (readonly [string, string])[] }) {
  const stripRef = useRef<HTMLDListElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -24px 0px' },
    );

    observer.observe(strip);
    return () => observer.disconnect();
  }, []);

  return (
    <dl ref={stripRef} className="mx-auto grid max-w-[1280px] border-t border-[#20231f]/15 sm:grid-cols-2 lg:grid-cols-4">
      {metadata.map(([term, value], index) => (
        <div
          key={term}
          className={`px-5 py-4 transition-[opacity,filter,transform] duration-300 ease-in-out motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:blur-0 sm:px-8 ${isVisible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-1 opacity-70 blur-[0.5px]'} ${index ? 'border-t border-[#20231f]/15 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l-0 lg:border-l' : ''}`}
          style={{ transitionDelay: `${index * 35}ms` }}
        >
          <dt className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#74776f]">{term}</dt>
          <dd className="mt-2 text-sm font-semibold text-[#20231f]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HeroInspection() {
  return (
    <div className="self-end border border-[#20231f] bg-[#151714] text-[#e8e8df] lg:-translate-y-5">
      <div className="flex min-h-12 items-center justify-between border-b border-white/10 px-4 font-mono text-[9px] uppercase tracking-[0.12em] text-[#9a9d94]">
        <span>Inspection / invoice-0042.xml</span>
        <span>UBL 2.1</span>
      </div>
      <div className="grid md:grid-cols-[1.06fr_.94fr]">
        <div className="border-b border-white/10 py-5 md:border-b-0 md:border-r">
          <div className="px-4 pb-4 font-mono text-[9px] uppercase tracking-[0.13em] text-[#7d8178]">Source</div>
          <div className="font-mono text-[10px] leading-6 sm:text-[11px]">
            {HERO_XML.map((line, index) => {
              const marked = index === 2;
              return (
                <div key={line} className={`grid grid-cols-[38px_1fr] border-l-2 pr-3 ${marked ? 'border-[#c7442d] bg-[#c7442d]/15 text-[#f0b59f]' : 'border-transparent text-[#b8bbb3]'}`}>
                  <span className="select-none pr-3 text-right text-[#62675e]">{String(index + 38).padStart(2, '0')}</span>
                  <span className="whitespace-pre-wrap break-all">{line}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 font-mono text-[9px] uppercase tracking-[0.12em] text-[#7d8178]">
            <span>Diagnostic</span>
            <span className="text-[#e39a72]">Blocking</span>
          </div>
          <div className="pt-5">
            <div className="font-mono text-xs font-semibold text-[#f0a27f]">BR-CO-10</div>
            <h2 className="mt-3 text-sm font-semibold text-[#f3f1e9]">Invoice line total mismatch</h2>
            <p className="mt-2 text-[12px] leading-5 text-[#adafa7]">The stated line total must equal the sum of the invoice line net amounts.</p>
            <dl className="mt-5 grid grid-cols-2 border-y border-white/10 font-mono text-[9px]">
              <div className="border-r border-white/10 py-3 pr-3"><dt className="text-[#71756d]">Expected</dt><dd className="mt-1 text-[#e8e8df]">950.00 EUR</dd></div>
              <div className="py-3 pl-3"><dt className="text-[#71756d]">Received</dt><dd className="mt-1 text-[#f0a27f]">940.00 EUR</dd></div>
            </dl>
            <p className="mt-4 font-mono text-[9px] text-[#777b72]">line 40 · BT-106 / BT-131</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[#74786f]">
        <span>Profile: XRechnung 3.0</span>
        <span>Rules executed: {RULE_COUNTS.xrechnung}</span>
      </div>
    </div>
  );
}

function Hero() {
  const metadata = [
    ['Specification', 'EN 16931-1:2017'],
    ['German profile', 'XRechnung 3.0'],
    ['Syntaxes', 'UBL 2.1 + CII'],
    ['Runtime', 'Pure TypeScript'],
  ] as const;

  return (
    <section className="border-b border-[#20231f]/15">
      <div className="mx-auto grid max-w-[1280px] lg:grid-cols-12">
        <div className="border-[#20231f]/15 px-5 py-14 sm:px-8 sm:py-20 lg:col-span-7 lg:border-r lg:py-20 lg:pr-16">
          <SectionIndex number="01">Validation for software teams</SectionIndex>
          <h1 className="mt-7 max-w-[720px] text-[clamp(3.1rem,6.2vw,5.8rem)] font-semibold leading-[.98] tracking-[-0.055em] text-[#20231f]">
            European e-invoicing validation
            <span className="mt-2 block text-[#c7442d]">for your software.</span>
          </h1>
          <p className="mt-6 max-w-[630px] text-base leading-7 text-[#51554e] sm:text-lg sm:leading-8">
            Validate UBL and CII invoices against supported EN 16931-1:2017 and XRechnung 3.0 rules. Return structured diagnostics with rule IDs and source locations inside the workflow your product already uses.
          </p>
          <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link href="/playground" className="rounded-[4px] bg-[#20231f] px-5 py-3.5 text-sm font-semibold text-[#fdfbf7] hover:bg-[#343831]">Test an invoice <Arrow /></Link>
            <Link href="/docs" className="border-b border-[#20231f] pb-1 text-sm font-medium text-[#20231f]">Read integration docs <Arrow /></Link>
          </div>
        </div>
        <div className="flex items-end bg-[#eee8dc] px-5 py-12 sm:px-8 lg:col-span-5 lg:px-9 lg:py-10">
          <HeroInspection />
        </div>
      </div>
      <MetadataStrip metadata={metadata} />
    </section>
  );
}

function EvidenceRegister() {
  const rows = [
    ['Corpus documents exercised', '45', '41', '86 total', 'Official XRechnung corpus'],
    ['Corpus crashes', '0', '0', '0', 'Parser stability only'],
    ['European core rules', '40', '40', '40', 'EN 16931-1:2017 subset'],
    ['German additions', '16', '16', '16', 'BR-DE profile rules'],
  ];

  return (
    <section className="border-b border-[#20231f]/15 px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <SectionIndex number="02">Validation evidence register</SectionIndex>
            <h2 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[#20231f] sm:text-5xl">Evidence with its scope attached.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[#5f625b] lg:justify-self-end">These figures describe the current engine and test corpus. They do not claim complete KoSIT parity or replace an official recipient check.</p>
        </div>
        <div className="mt-12 overflow-x-auto border-t border-l border-[#20231f]/15">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="bg-[#eee8dc] font-mono text-[9px] uppercase tracking-[0.13em] text-[#686c64]">
              <tr>{['Evidence', 'UBL', 'CII', 'Result', 'Scope note'].map((head) => <th key={head} className="border-r border-b border-[#20231f]/15 px-4 py-3 font-medium">{head}</th>)}</tr>
            </thead>
            <tbody className="text-sm text-[#20231f]">
              {rows.map((row) => <tr key={row[0]}>{row.map((value, index) => <td key={`${row[0]}-${index}`} className={`border-r border-b border-[#20231f]/15 px-4 py-4 ${index > 0 && index < 4 ? 'font-mono text-xs' : ''} ${index === 4 ? 'text-[#686c64]' : ''}`}>{value}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function EngineArchitecture() {
  const stages = [
    ['01', 'Invoice XML', 'UBL or CII'],
    ['02', '@stampbench/core', 'Parse and validate'],
    ['03', 'Your execution context', 'Browser · Worker · CI'],
    ['04', 'ValidationResult', 'Structured findings'],
  ];

  return (
    <section id="engine" className="border-b border-[#20231f]/15 px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-[1280px]">
        <SectionIndex number="03">Deployment architecture</SectionIndex>
        <div className="mt-7 grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className="max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[#20231f] sm:text-5xl">The engine goes where the invoice already is.</h2>
            <p className="mt-6 max-w-lg text-sm leading-6 text-[#5f625b]">Use the library inside a browser worker, server process or CI pipeline. Invoice bytes remain inside the execution context your team controls.</p>
          </div>
          <pre className="overflow-x-auto border border-[#20231f] bg-[#151714] p-5 font-mono text-[11px] leading-6 text-[#d8dad2] sm:p-7" aria-label="TypeScript validation example"><code>
            <span className="text-[#d39b7d]">import</span> {'{ validateXml }'} <span className="text-[#d39b7d]">from</span>{'\n'}
            <span className="text-[#9dc8ab]">&apos;@stampbench/core&apos;</span>;{'\n\n'}
            <span className="text-[#d39b7d]">const</span> result = validateXml(xml, {'{'}{'\n'}
            {'  '}profile: <span className="text-[#9dc8ab]">&apos;xrechnung&apos;</span>{'\n'}
            {'}'});{'\n\n'}
            console.log(result.valid);{'\n'}
            console.log(result.violations);
          </code></pre>
        </div>
        <div className="mt-12 grid border-t border-l border-[#20231f]/15 md:grid-cols-4">
          {stages.map(([index, title, detail], position) => (
            <div key={title} className="relative min-h-36 border-r border-b border-[#20231f]/15 p-5">
              <span className="font-mono text-[9px] text-[#c7442d]">{index}</span>
              <h3 className="mt-8 text-sm font-semibold text-[#20231f]">{title}</h3>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#74776f]">{detail}</p>
              {position < stages.length - 1 && <span className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center border border-[#20231f]/15 bg-[#f4efe3] text-xs md:grid" aria-hidden="true">→</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LivePlayground() {
  const [source, setSource] = useState(BROKEN_SAMPLE_XML);
  const [profile, setProfile] = useState<EngineProfile>('xrechnung');
  const [result, setResult] = useState(() => validateXml(BROKEN_SAMPLE_XML, { profile: 'xrechnung' }));
  const [validatedSource, setValidatedSource] = useState(BROKEN_SAMPLE_XML);

  const located = useMemo(
    () => locateViolations(validatedSource, result.violations, result.syntax ?? 'ubl'),
    [result, validatedSource],
  );
  const edited = source !== validatedSource;

  function run() {
    const next = validateXml(source, { profile });
    setResult(next);
    setValidatedSource(source);
  }

  function loadSample(next: string) {
    setSource(next);
    const checked = validateXml(next, { profile });
    setResult(checked);
    setValidatedSource(next);
  }

  return (
    <section id="playground-preview" className="border-b border-[#20231f]/15 bg-[#eee8dc] px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
          <div>
            <SectionIndex number="04">Live browser inspection</SectionIndex>
            <h2 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[#20231f] sm:text-5xl">Change the XML. Run the actual rules.</h2>
          </div>
          <div className="lg:justify-self-end">
            <p className="max-w-2xl text-sm leading-6 text-[#5f625b]">This preview calls the same <code className="font-mono text-xs text-[#20231f]">validateXml</code> and <code className="font-mono text-xs text-[#20231f]">locateViolations</code> functions used by the full playground.</p>
            <p className="mt-3 border-l-2 border-[#237a57] pl-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#386b55]">Validation runs in this browser. The XML is not uploaded.</p>
          </div>
        </div>

        <div className="mt-12 border border-[#20231f] bg-[#151714] text-[#e8e8df]">
          <div className="flex flex-col gap-3 border-b border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => loadSample(BROKEN_SAMPLE_XML)} className="rounded-[3px] border border-white/15 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.09em] text-[#c4c6be] hover:border-white/30">Load failing sample</button>
              <button type="button" onClick={() => loadSample(SAMPLE_XML)} className="rounded-[3px] border border-white/15 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.09em] text-[#c4c6be] hover:border-white/30">Load passing sample</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="landing-profile">Ruleset</label>
              <select id="landing-profile" value={profile} onChange={(event) => setProfile(event.target.value as EngineProfile)} className="rounded-[3px] border border-white/15 bg-[#151714] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.09em] text-[#d7d9d1]">
                <option value="xrechnung">XRechnung 3.0</option>
                <option value="en16931">EN 16931 core</option>
              </select>
              <button type="button" onClick={run} className="rounded-[3px] bg-[#f4efe3] px-4 py-2 text-xs font-semibold text-[#20231f] hover:bg-white">Run validation</button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.08fr_.92fr]">
            <div className="border-b border-white/10 lg:border-b-0 lg:border-r">
              <div className="flex h-11 items-center justify-between border-b border-white/10 px-4 font-mono text-[9px] uppercase tracking-[0.11em] text-[#7d8178]">
                <span>Payload editor</span>
                <span>{result.syntax?.toUpperCase() ?? 'XML'} · {source.split('\n').length} lines</span>
              </div>
              <div className="grid grid-cols-[42px_1fr]">
                <div className="select-none overflow-hidden border-r border-white/10 py-4 pr-3 text-right font-mono text-[10px] leading-6 text-[#545950]" aria-hidden="true">
                  {Array.from({ length: Math.max(24, source.split('\n').length) }, (_, index) => <div key={index}>{String(index + 1).padStart(2, '0')}</div>)}
                </div>
                <textarea value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} aria-label="Invoice XML" className="min-h-[576px] w-full resize-y bg-transparent p-4 font-mono text-[10px] leading-6 text-[#d6d8d0] outline-none focus:bg-white/[0.02] sm:text-[11px]" />
              </div>
            </div>

            <div>
              <div className="flex h-11 items-center justify-between border-b border-white/10 px-4 font-mono text-[9px] uppercase tracking-[0.11em] text-[#7d8178]">
                <span>Diagnostics engine state</span>
                <span className={result.valid ? 'text-[#76c99f]' : 'text-[#e39a72]'}>{edited ? 'Edited since last run' : result.valid ? 'Valid' : `${result.errorCount} error${result.errorCount === 1 ? '' : 's'}`}</span>
              </div>
              <div className="p-4 sm:p-5" aria-live="polite">
                <dl className="grid grid-cols-2 border-t border-l border-white/10 font-mono text-[9px] sm:grid-cols-4">
                  {[
                    ['Profile', result.profile],
                    ['Rules', String(result.meta.rulesRun)],
                    ['Syntax', result.syntax?.toUpperCase() ?? 'Unknown'],
                    ['Ruleset', result.meta.rulesetVersion],
                  ].map(([term, value]) => <div key={term} className="border-r border-b border-white/10 p-3"><dt className="uppercase tracking-[0.1em] text-[#696e65]">{term}</dt><dd className="mt-2 text-[#d4d6ce]">{value}</dd></div>)}
                </dl>

                {edited && <p className="mt-4 border-l-2 border-[#a46018] bg-[#a46018]/10 p-3 text-xs leading-5 text-[#d9b98c]">The source has changed. Run validation to update this result.</p>}

                {!edited && result.valid ? (
                  <div className="mt-5 border border-[#237a57] p-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.11em] text-[#76c99f]">No blocking findings</p>
                    <p className="mt-3 text-sm leading-6 text-[#c8cbc2]">The sample passed all {result.meta.rulesRun} rules in the selected profile.</p>
                  </div>
                ) : !edited ? (
                  <div className="mt-5 space-y-3">
                    {located.slice(0, 4).map((violation) => (
                      <article key={`${violation.ruleId}-${violation.location.line}`} className="border border-white/10">
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                          <span className="font-mono text-[10px] font-semibold text-[#e8a17f]">{violation.ruleId}</span>
                          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[#858980]">{violation.severity} · line {violation.location.line}</span>
                        </div>
                        <div className="p-4">
                          <p className="text-[12px] leading-5 text-[#c8cbc2]">{violation.message}</p>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] text-[#777c73]">
                            {violation.terms?.length ? <span>{violation.terms.join(' / ')}</span> : null}
                            <span>{violation.location.precision} location</span>
                            {violation.expected !== undefined ? <span>expected: {String(violation.expected)}</span> : null}
                            {violation.value !== undefined ? <span>received: {String(violation.value)}</span> : null}
                          </div>
                        </div>
                      </article>
                    ))}
                    {located.length > 4 && <p className="font-mono text-[9px] text-[#777c73]">+ {located.length - 4} further findings in the full playground</p>}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-right"><Link href="/playground" className="border-b border-[#20231f] pb-1 text-sm font-medium text-[#20231f]">Open full playground <Arrow /></Link></div>
      </div>
    </section>
  );
}

function CapabilityLedger() {
  return (
    <section className="border-b border-[#20231f]/15 px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-[1280px]">
        <SectionIndex number="05">Current capability ledger</SectionIndex>
        <div className="mt-7 grid gap-10 lg:grid-cols-[.65fr_1.35fr]">
          <div>
            <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[#20231f] sm:text-5xl">What exists today.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#5f625b]">A technical inventory written for architecture review, not a feature-card wall.</p>
          </div>
          <dl className="border-t border-[#20231f]/20">
            {CAPABILITIES.map(([term, description], index) => (
              <div key={term} className="grid gap-2 border-b border-[#20231f]/15 py-4 sm:grid-cols-[32px_190px_1fr] sm:gap-5">
                <span className="font-mono text-[9px] text-[#c7442d]">{String(index + 1).padStart(2, '0')}</span>
                <dt className="text-sm font-semibold text-[#20231f]">{term}</dt>
                <dd className="text-sm leading-6 text-[#5f625b]">{description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function IntegrationPilot() {
  const deliverables = [
    ['01', 'One staging workflow', 'Integrate the current validator into one defined invoice path in your product.'],
    ['02', 'Representative documents', 'Exercise the integration against an agreed set of UBL or CII invoices from your workflow.'],
    ['03', 'Structured diagnostics', 'Return supported rule IDs, business terms and source locations in a form your product can use.'],
    ['04', 'Coverage handover', 'Document the implemented boundary, acceptance results and anything outside the supported ruleset.'],
  ] as const;

  return (
    <section id="pilot" className="border-b border-[#20231f]/15 bg-[#eee8dc] px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-[1280px]">
        <SectionIndex number="06">Founding integration pilot</SectionIndex>
        <div className="mt-7 grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <h2 className="max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[#20231f] sm:text-5xl">Put the validator inside one real workflow.</h2>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[#5f625b]">A fixed-scope engagement for software teams evaluating Stampbench against their own invoice path. The initial £3,000 price is being tested with early pilot customers.</p>
            <a
              href="mailto:hello@stampbench.com?subject=Stampbench%20integration%20pilot"
              className="mt-7 inline-block rounded-[4px] bg-[#20231f] px-5 py-3.5 text-sm font-semibold text-[#fdfbf7]"
            >
              Discuss a pilot <Arrow />
            </a>
          </div>
          <div>
            <dl className="border-l border-t border-[#20231f]/20 sm:grid sm:grid-cols-2">
              {deliverables.map(([number, title, body]) => (
                <div key={number} className="min-h-[190px] border-r border-b border-[#20231f]/20 p-5 sm:p-6">
                  <dt className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#c7442d]">{number}</dt>
                  <dd>
                    <h3 className="mt-8 text-lg font-semibold tracking-[-0.025em] text-[#20231f]">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#5f625b]">{body}</p>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs leading-5 text-[#686c64]">The pilot covers one product and one integration path. It is engineering work and validation tooling, not certification, recipient approval or legal advice. Any continuing support is scoped separately after the pilot.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScopeAndClose() {
  return (
    <>
      <section className="border-b border-[#20231f]/15 bg-[#ebe4d6] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <SectionIndex number="07">Standards scope</SectionIndex>
            <h2 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[#20231f] sm:text-5xl">Precise about the boundary.</h2>
          </div>
          <div className="space-y-5 text-sm leading-7 text-[#51554e]">
            <p>The current engine targets EN 16931-1:2017 and XRechnung 3.0. A new 2026 edition of the European standard is entering migration, so support is described by exact ruleset rather than a timeless claim of full compliance.</p>
            <p>Germany’s B2B e-invoicing transition uses different deadlines depending on turnover and transmission method. Stampbench validates invoice structure; it does not decide tax treatment or replace current authority guidance.</p>
            <div className="flex flex-wrap gap-6 pt-2">
              <Link href="/trust" className="border-b border-[#20231f] pb-1 font-medium text-[#20231f]">Read validation evidence <Arrow /></Link>
              <a href="https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.htm" className="border-b border-[#20231f] pb-1 font-medium text-[#20231f]">German Finance Ministry guidance <Arrow /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] gap-8 border-y border-[#20231f]/20 py-12 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#c7442d]">Run the document</p>
            <h2 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[#20231f] sm:text-6xl">Inspect the invoice before your customer does.</h2>
          </div>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link href="/playground" className="rounded-[4px] bg-[#20231f] px-5 py-3.5 text-sm font-semibold text-[#fdfbf7]">Open browser playground <Arrow /></Link>
            <Link href="/trust" className="border-b border-[#20231f] pb-1 text-sm font-medium text-[#20231f]">Read evidence</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#20231f]/15 px-5 py-10 text-xs text-[#676b63] sm:px-8">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2 font-semibold text-[#20231f]"><StampbenchMark size={18} /> Stampbench</Link>
          <p className="mt-3 max-w-sm leading-5">E-invoice validation infrastructure with explicit rulesets and controlled data movement.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer navigation">
          <Link href="/business">Create invoices</Link><Link href="/docs">Integration docs</Link><Link href="/pricing">Pilot</Link><Link href="/trust">Evidence</Link><Link href="/security">Security</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/impressum">Business details</Link>
        </nav>
      </div>
      <div className="mx-auto mt-8 flex max-w-[1280px] flex-col gap-2 border-t border-[#20231f]/10 pt-6 sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Harvey Legge trading as Stampbench</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em]">United Kingdom · hello@stampbench.com</span>
      </div>
    </footer>
  );
}

export function EnterpriseLanding() {
  return (
    <div className="enterprise-landing min-h-screen overflow-hidden bg-[#f4efe3] text-[#20231f]">
      <Header />
      <Hero />
      <EvidenceRegister />
      <EngineArchitecture />
      <LivePlayground />
      <CapabilityLedger />
      <IntegrationPilot />
      <ScopeAndClose />
      <Footer />
    </div>
  );
}
