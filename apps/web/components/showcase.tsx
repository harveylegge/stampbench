'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Copy } from '@/lib/copy';

/**
 * The product showcase under the hero: four tabs, one large panel.
 *
 * Drawn rather than screenshotted. A screenshot of the real UI would be a
 * heavy image that goes stale the first time a button moves, blurs on a
 * retina phone, and cannot be read by a screen reader. These panels are built
 * from the same design tokens as the app, so they stay sharp at any size,
 * cost a few kB, and the text in them is real text.
 *
 * They are illustrations, not live software — every panel is inert, and the
 * tab strip is the only interactive part. The numbers shown are the same
 * worked example used everywhere else on the site (£2,450 net, 20% VAT,
 * £490 tax), so a visitor who follows through to the real generator sees
 * arithmetic that matches what the homepage promised.
 */

type TabId = 'create' | 'check' | 'fix' | 'automate';

function Chrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-hi bg-surface shadow-xl shadow-accent/5">
      <div className="flex items-center gap-2 border-b border-border bg-bg px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-hi" />
        </span>
        <span className="ml-2 font-mono text-xs text-faint">{title}</span>
      </div>
      {children}
    </div>
  );
}

function CreatePanel({ copy }: { copy: Copy }) {
  const t = copy.showcase.create;
  return (
    <Chrome title="invoice.stampbench.com">
      <div className="p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="h-8 w-24 rounded bg-surface-2" aria-hidden />
            <div className="mt-2 text-sm font-medium">{t.seller}</div>
            <div className="text-xs text-faint">{t.sellerCity}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold tracking-tight sm:text-2xl">{t.title}</div>
            <div className="font-mono text-xs text-faint">INV-2026-000421</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_5rem] gap-2 bg-text px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-white sm:grid-cols-[minmax(0,1fr)_4rem_6rem]">
            <span>{t.colItem}</span>
            <span className="text-right">{t.colQty}</span>
            <span className="text-right">{t.colAmount}</span>
          </div>
          {t.lines.map((line) => (
            <div
              key={line.name}
              className="grid grid-cols-[minmax(0,1fr)_3.5rem_5rem] gap-2 border-t border-border px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_4rem_6rem]"
            >
              <span className="truncate text-muted">{line.name}</span>
              <span className="text-right text-faint">{line.qty}</span>
              <span className="text-right tabular-nums">{line.amount}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-[15rem] text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted">{t.subtotal}</span>
              <span className="tabular-nums">£2,450.00</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">{t.vat}</span>
              <span className="tabular-nums">£490.00</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
              <span>{t.total}</span>
              <span className="tabular-nums">£2,940.00</span>
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  );
}

function CheckPanel({ copy }: { copy: Copy }) {
  const t = copy.showcase.check;
  return (
    <Chrome title="invoice.xml">
      <div className="p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-danger/10 px-3 py-1 text-sm font-medium text-danger">
            {t.verdict}
          </span>
          <span className="font-mono text-xs text-faint">{t.rulesetLine}</span>
        </div>
        <div className="flex flex-col gap-3">
          {t.problems.map((problem) => (
            <div key={problem.title} className="rounded-lg border border-border bg-bg p-3.5">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{problem.title}</span>
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                  {problem.rule}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted">{problem.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-faint">{t.footnote}</p>
      </div>
    </Chrome>
  );
}

function FixPanel({ copy }: { copy: Copy }) {
  const t = copy.showcase.fix;
  return (
    <Chrome title="invoice.xml — repaired">
      <div className="p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
            {t.verdict}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border font-mono text-xs">
          <div className="flex bg-danger/5 text-danger">
            <span className="w-10 shrink-0 select-none py-2 pr-2 text-right text-faint">78</span>
            <span className="overflow-x-auto whitespace-pre py-2 pr-4">− &lt;cbc:TaxAmount&gt;99.99&lt;/cbc:TaxAmount&gt;</span>
          </div>
          <div className="flex bg-success/5 text-success">
            <span className="w-10 shrink-0 select-none py-2 pr-2 text-right text-faint">78</span>
            <span className="overflow-x-auto whitespace-pre py-2 pr-4">+ &lt;cbc:TaxAmount&gt;22.04&lt;/cbc:TaxAmount&gt;</span>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-3.5">
          <div className="mb-1 text-sm font-medium">{t.keptTitle}</div>
          <p className="text-sm leading-relaxed text-muted">{t.keptDetail}</p>
        </div>
      </div>
    </Chrome>
  );
}

function AutomatePanel({ copy }: { copy: Copy }) {
  const t = copy.showcase.automate;
  return (
    <Chrome title="terminal">
      <div className="p-5 sm:p-7">
        <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-muted">
          {t.snippet}
        </pre>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {t.points.map((point) => (
            <div key={point.title} className="rounded-lg border border-border bg-bg p-3">
              <div className="mb-1 text-sm font-medium">{point.title}</div>
              <p className="text-xs leading-relaxed text-muted">{point.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

export function ProductShowcase({ copy }: { copy: Copy }) {
  const [tab, setTab] = useState<TabId>('create');
  const tabs = copy.showcase.tabs;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-4">
      {/* Horizontally scrollable on a phone rather than wrapping into two
          ragged rows — a tab strip that reflows reads as broken. */}
      <div
        role="tablist"
        aria-label={copy.showcase.label}
        className="mb-5 flex snap-x gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              id={`showcase-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`showcase-panel-${item.id}`}
              onClick={() => setTab(item.id as TabId)}
              className={`shrink-0 snap-start rounded-lg px-4 py-2 text-sm font-medium transition ${
                selected ? 'bg-accent text-white' : 'text-muted hover:bg-bg hover:text-text'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* key={tab} remounts on switch so the crossfade replays; the panel is
          otherwise identical markup. */}
      <div
        key={tab}
        role="tabpanel"
        id={`showcase-panel-${tab}`}
        aria-labelledby={`showcase-tab-${tab}`}
        tabIndex={0}
        className="sb-panel-in"
      >
        {tab === 'create' && <CreatePanel copy={copy} />}
        {tab === 'check' && <CheckPanel copy={copy} />}
        {tab === 'fix' && <FixPanel copy={copy} />}
        {tab === 'automate' && <AutomatePanel copy={copy} />}
      </div>

      <p className="mt-4 text-center text-sm text-faint">
        {copy.showcase.caption}{' '}
        <Link href="/invoice-generator" className="font-medium text-accent-hi hover:underline">
          {copy.showcase.captionLink}
        </Link>
      </p>
    </section>
  );
}
