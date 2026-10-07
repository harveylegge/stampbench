'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@stampbench/core';

import { Flag } from '@/components/flag';
import { ChaseEmail } from '@/components/invoice/chase-email';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/components/invoice/fields';
import { currentPlan, probablySignedIn } from '@/lib/account-client';
import {
  backupEnabled,
  pushInvoice,
  removeAccountCopy,
  setBackupEnabled,
  syncWithAccount,
} from '@/lib/invoice/account-backup';
import { computeDraftTotals, generateDocument } from '@/lib/invoice/build';
import { getCountry } from '@/lib/invoice/countries';
import { duplicateDraft } from '@/lib/invoice/draft';
import {
  deleteInvoice,
  listInvoices,
  onHistoryChange,
  setInvoicePaid,
  stageForEditing,
  type SavedInvoice,
} from '@/lib/invoice/history';
import {
  advanceRule,
  CADENCES,
  dueRules,
  listRules,
  onRecurringChange,
  removeRuleForInvoice,
  setRule,
  type Cadence,
  type RecurringRule,
} from '@/lib/invoice/recurring';
import { MonthlyChart } from '@/components/invoice/monthly-chart';
import { JSON_FILE, PDF_FILE, XML_FILE, fileSlug, saveFile } from '@/lib/invoice/save-file';
import { invoiceStatus, isoDayOf, monthlySeries, monthSummary } from '@/lib/invoice/status';
import { MARKETS } from '@/lib/markets';

/**
 * Every invoice created in this browser, newest first.
 *
 * The list renders straight off the stored drafts: number, buyer and total
 * are derived on the way through `computeDraftTotals`, the same arithmetic the
 * editor and the XML use, so the figure shown here is the figure in the
 * document. There is no second copy to drift.
 *
 * Client-side because the page is statically exported and the data never left
 * the visitor's browser in the first place. That is the point of it.
 */

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function InvoicesView() {
  const router = useRouter();
  const [view, setView] = useState<'business' | 'advanced'>('business');
  // null = storage not read yet (the pre-hydration render), so the empty
  // state does not flash at someone whose list is about to appear.
  const [invoices, setInvoices] = useState<SavedInvoice[] | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  /** The invoice whose chase panel is open, if any. */
  const [chaseFor, setChaseFor] = useState<string | null>(null);
  // Backup state is read after mount: the page is prerendered without it.
  const [signedIn, setSignedIn] = useState(false);
  const [backup, setBackup] = useState(false);
  const [freePlan, setFreePlan] = useState(false);
  /** Set when a free user reaches for one of the paid business tools. */
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');

  // Recurring rules, and the subset whose date has come. Both refreshed with
  // the history: a rule is only meaningful next to the invoice it points at.
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [due, setDue] = useState<RecurringRule[]>([]);

  useEffect(() => {
    const refresh = () => {
      const list = listInvoices();
      setInvoices(list);
      setRules(listRules());
      setDue(dueRules(new Set(list.map((entry) => entry.id)), isoDayOf(new Date())));
    };
    refresh();
    setSignedIn(probablySignedIn());
    setBackup(backupEnabled());
    const unsubscribeHistory = onHistoryChange(refresh);
    const unsubscribeRecurring = onRecurringChange(refresh);
    let cancelled = false;
    currentPlan().then((plan) => {
      if (!cancelled) setFreePlan(plan === 'free');
    });
    return () => {
      cancelled = true;
      unsubscribeHistory();
      unsubscribeRecurring();
    };
  }, []);

  /** This month's money, per currency: from the same totals chain as the documents. */
  const summary = useMemo(() => (invoices ? monthSummary(invoices, new Date()) : []), [invoices]);

  /** The last 12 months, per currency, for the chart under the summary. */
  const monthly = useMemo(() => (invoices ? monthlySeries(invoices, new Date()) : []), [invoices]);

  const businessCounts = useMemo(() => {
    if (!invoices) return { paid: 0, waiting: 0, overdue: 0 };
    return invoices.reduce(
      (counts, entry) => {
        if (entry.draft.document.typeCode === '381') return counts;
        const status = invoiceStatus(entry, isoDayOf(new Date()));
        if (status === 'paid') counts.paid += 1;
        else if (status === 'overdue') counts.overdue += 1;
        else counts.waiting += 1;
        return counts;
      },
      { paid: 0, waiting: 0, overdue: 0 },
    );
  }, [invoices]);

  /** Push what's new, pull what's missing, refresh the list. */
  async function runSync() {
    setSyncState('syncing');
    try {
      await syncWithAccount(listInvoices());
      setInvoices(listInvoices());
      setSyncState('done');
    } catch {
      setSyncState('error');
    }
  }

  // With backup on, every visit to this page catches up both directions:
  // that is what makes the list follow you across browsers.
  useEffect(() => {
    if (signedIn && backup && syncState === 'idle') void runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per visit, when the flags land
  }, [signedIn, backup]);

  function enableBackup() {
    setBackupEnabled(true);
    setBackup(true);
    void runSync();
  }

  function disableBackup() {
    setBackupEnabled(false);
    setBackup(false);
    setSyncState('idle');
  }

  function openForEditing(entry: SavedInvoice) {
    stageForEditing(entry.draft);
    router.push('/invoice-generator');
  }

  /**
   * Payment tracking, recurring and the customer book are the paid business
   * tools. Free keeps the whole archive readable, reopenable and exportable:
   * the gate is on the bookkeeping built on top of it, never on the documents
   * themselves, which are the user's own work.
   */
  const paidTools = !freePlan;

  function togglePaid(entry: SavedInvoice) {
    if (!paidTools) {
      setUpgradePrompt('Marking invoices paid: and seeing what is overdue: is on the paid plans.');
      return;
    }
    // A paid invoice needs no chasing; an open panel for it would be a
    // letter to someone who already did the thing.
    if (!entry.paidAt && chaseFor === entry.id) setChaseFor(null);
    const updated = setInvoicePaid(entry.id, !entry.paidAt);
    // The paid mark is part of the invoice's record: with backup on it goes
    // to the account immediately, same as creating the invoice did.
    if (updated && signedIn && backup) void pushInvoice(updated);
  }

  /** A fresh invoice from this one: next number, today's dates, same window. */
  function duplicate(entry: SavedInvoice) {
    const taken = new Set(listInvoices().map((e) => e.draft.document.number));
    stageForEditing(duplicateDraft(entry.draft, new Date(), taken));
    router.push('/invoice-generator');
  }

  function setRepeat(entry: SavedInvoice, value: string) {
    const today = isoDayOf(new Date());
    // Turning a schedule *off* is always allowed, including after a downgrade:
    // trapping someone in a recurrence they can no longer manage would be the
    // one gate here that could cost them real money.
    if (value === 'off') {
      removeRuleForInvoice(entry.id);
      return;
    }
    if (!paidTools) {
      setUpgradePrompt('Recurring invoices are on the paid plans.');
      return;
    }
    setRule(entry.id, value as Cadence, entry.draft.document.issueDate || today, today);
  }

  /**
   * "Create it now" on a due rule. The rule advances when the offer is taken,
   * not when the invoice is finished: the editor may still be abandoned, in
   * which case the prompt returns next cadence rather than tomorrow, which is
   * the less naggy of the two imperfect options.
   */
  function createFromRule(rule: RecurringRule) {
    const source = invoices?.find((entry) => entry.id === rule.invoiceId);
    if (!source) return;
    advanceRule(rule.id, isoDayOf(new Date()));
    duplicate(source);
  }

  function downloadXml(entry: SavedInvoice) {
    try {
      const generated = generateDocument(entry.draft);
      const name = fileSlug(entry.draft.document.number);
      if (generated.xml) void saveFile(`${name}.xml`, generated.xml, XML_FILE);
      else void saveFile(`${name}.json`, generated.json, JSON_FILE);
    } catch {
      // A draft this page cannot regenerate is one the editor needs to see.
      openForEditing(entry);
    }
  }

  async function downloadPdf(entry: SavedInvoice) {
    try {
      const plan = await currentPlan();
      const { invoicePdf } = await import('@/lib/invoice/pdf');
      const pdf = await invoicePdf(entry.draft, { branded: plan === null || plan === 'free' });
      await saveFile(pdf.filename, pdf.blob, PDF_FILE);
    } catch {
      // Same rule as XML: a draft that will not render belongs in the editor.
      openForEditing(entry);
    }
  }

  return (
    <div className="invoice-ledger mx-auto max-w-5xl px-4 py-14 sm:py-20">
      <div className="invoice-ledger-head">
        <div>
          <p className="invoice-ledger-kicker"><i />YOUR WORKBENCH / INVOICE ARCHIVE</p>
          <h1>Every invoice.<br/><em>Neatly in hand.</em></h1>
          <p className="invoice-ledger-intro">
            Create, revisit and download your invoices from one orderly place. Your local archive
            stays in this browser unless you choose account backup.
          </p>
        </div>
        <Link href="/invoice-generator" className="invoice-ledger-create">
          Create an invoice <span>↗</span>
        </Link>
      </div>

      <div className="invoice-view-switch" aria-label="Choose invoice view">
        <button className={view === 'business' ? 'is-active' : ''} onClick={() => setView('business')} aria-pressed={view === 'business'}>
          <span>BUSINESS</span><strong>Simple view</strong><small>Invoices, payments and PDFs</small>
        </button>
        <button className={view === 'advanced' ? 'is-active' : ''} onClick={() => setView('advanced')} aria-pressed={view === 'advanced'}>
          <span>ADVANCED</span><strong>Developer view</strong><small>XML, compliance and controls</small>
        </button>
      </div>

      {view === 'business' ? (
        <div className="invoice-ledger-index" aria-label="Invoice overview">
          <div><small>ALL INVOICES</small><strong>{invoices?.length ?? 'Not set'}</strong><span>saved here</span></div>
          <div><small>WAITING</small><strong>{businessCounts.waiting}</strong><span>for payment</span></div>
          <div><small>PAID</small><strong>{businessCounts.paid}</strong><span>completed</span></div>
        </div>
      ) : (
        <div className="invoice-ledger-index" aria-label="Technical invoice overview">
          <div><small>DOCUMENTS</small><strong>{invoices?.length ?? 'Not set'}</strong><span>in this archive</span></div>
          <div><small>STORAGE</small><strong>LOCAL</strong><span>private to this browser</span></div>
          <div><small>CHECKING</small><strong>AUTOMATIC</strong><span>before every download</span></div>
        </div>
      )}

      {/* Compliance, as reassurance rather than as a rules dump.
          This is the business experience's answer to "am I actually
          compliant?": the guarantee in one sentence, the machinery one click
          away for anyone who wants to audit the claim. Showing the rule
          families here instead would be the developer product leaking into a
          screen whose reader has not asked for it. */}
      {view === 'advanced' && <div className="invoice-ledger-check mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-success" aria-hidden>
              ✓
            </span>
            Your invoices are checked automatically
          </div>
          <p className="mt-1 max-w-xl leading-relaxed text-muted">
            Every invoice you create here is checked against the e-invoicing requirements for the
            market you billed in, before you download it. There is nothing to set up.
          </p>
        </div>
        <Link
          href="/markets"
          className="shrink-0 text-sm font-medium text-accent-hi transition hover:underline"
        >
          View compliance details →
        </Link>
      </div>}

      {/* Reaching for a paid tool. Says which one and what it costs, then gets
          out of the way: it is dismissible because this page is where people
          come to do work, not to be sold to twice. */}
      {upgradePrompt && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent-dim/40 p-4 text-sm"
        >
          <p className="leading-relaxed">
            {upgradePrompt}{' '}
            <span className="text-muted">
              Your invoices stay open and exportable either way.
            </span>
          </p>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className={BUTTON_PRIMARY}>
              See plans
            </Link>
            <button
              onClick={() => setUpgradePrompt(null)}
              className="text-sm text-faint transition hover:text-text"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Recurring invoices whose date has come. First, because it is the one
          thing on this page asking for a decision rather than reporting.
          Free plans never see these: the schedules behind them are paid. */}
      {paidTools &&
        due.map((rule) => {
        const source = invoices?.find((entry) => entry.id === rule.invoiceId);
        if (!source) return null;
        const cadence = CADENCES.find((c) => c.id === rule.cadence);
        return (
          <div
            key={rule.id}
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent-dim/20 p-4"
          >
            <div className="text-sm">
              <span className="font-medium">
                {source.draft.buyer.name || source.draft.document.number}
              </span>{' '}
              <span className="text-muted">
: the {cadence?.noun ?? ''} invoice is due. Stampbench has it ready with the next
                number and today&apos;s dates.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => createFromRule(rule)} className={BUTTON_PRIMARY}>
                Create it now
              </button>
              <button
                onClick={() => advanceRule(rule.id, isoDayOf(new Date()))}
                className="text-sm text-faint transition hover:text-text"
              >
                Skip this one
              </button>
            </div>
          </div>
        );
      })}

      {/* This month, per currency. Rendered from the same totals arithmetic
          as the documents: there is no second bookkeeping to disagree with
          the invoices below it. */}
      {summary.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-faint">
            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </div>
          <div className="flex flex-col gap-1.5">
            {summary.map((row) => (
              <div
                key={row.currency}
                className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm tabular-nums"
              >
                <span className="font-semibold">
                  {formatMoney(row.invoiced, row.currency, row.locale)}{' '}
                  <span className="font-normal text-muted">invoiced</span>
                </span>
                <span className="text-success">
                  {formatMoney(row.paid, row.currency, row.locale)}{' '}
                  <span className="text-muted">paid</span>
                </span>
                <span className="text-text">
                  {formatMoney(row.awaiting, row.currency, row.locale)}{' '}
                  <span className="text-muted">awaiting</span>
                </span>
                {row.overdueCount > 0 && (
                  <span className="font-medium text-danger">
                    {formatMoney(row.overdue, row.currency, row.locale)} overdue
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month by month, the trend behind the numbers above. The component
          keeps itself off the page until there is a shape worth drawing:
          two or more months with invoices in them. */}
      <MonthlyChart series={monthly} />

      {/* Backup: plain words, one decision. Invoices stay in the browser
          unless the visitor flips this on; that promise is the product's. */}
      {!signedIn && invoices !== null && invoices.length > 0 && (
        <p className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          These invoices are saved in this browser only.{' '}
          <Link href="/signin?next=/my-invoices" className="font-medium text-accent-hi hover:underline">
            Sign in
          </Link>{' '}
          to back them up to your free account, so they are there on any device.
        </p>
      )}
      {signedIn && !backup && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="text-sm">
            <div className="font-medium">Back up invoices to your account?</div>
            <p className="mt-0.5 text-muted">
              Right now they live only in this browser. Backing up keeps a copy in your account, so
              they follow you to any device you sign in on. Free accounts keep the 10 most recent;
              paid plans keep every invoice. Logos stay on this device.
            </p>
          </div>
          <button onClick={enableBackup} className={BUTTON_SECONDARY}>
            Turn on backup
          </button>
        </div>
      )}
      {signedIn && backup && (
        <p className="mb-6 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span className="text-success">✓</span>
          {syncState === 'syncing'
            ? 'Backing up to your account…'
            : syncState === 'error'
              ? 'Backup is on, but the last sync failed: it will retry next time you visit.'
              : freePlan
                ? 'Your 10 most recent invoices are backed up (Free plan).'
                : 'Backed up to your account. New invoices are saved automatically.'}
          {freePlan && syncState === 'done' && (
            <Link href="/account" className="font-medium text-accent-hi hover:underline">
              Keep them all →
            </Link>
          )}
          <button onClick={disableBackup} className="text-faint underline transition hover:text-text">
            Turn off
          </button>
        </p>
      )}

      {invoices !== null && invoices.length === 0 && (
        <div className="invoice-ledger-empty">
          <div className="invoice-empty-art" aria-hidden>
            <i className="invoice-sheet sheet-back"/><i className="invoice-sheet sheet-mid"/>
            <i className="invoice-sheet sheet-front"><b>№ 001</b><span/><span/><span/><em>+</em></i>
            <i className="invoice-arc"/>
          </div>
          <div className="invoice-empty-copy">
            <small>THE FIRST PAGE IS READY</small>
            <h2>Your archive starts<br/>with one invoice.</h2>
            <p>
              Build it in the workbench and it will return here automatically, ready to reopen,
              duplicate or download.
            </p>
            <Link href="/invoice-generator" className="invoice-ledger-create">
              Create your first invoice <span>↗</span>
            </Link>
            <p className="invoice-empty-note">No account required · Saved in this browser</p>
          </div>
        </div>
      )}

      {invoices !== null && invoices.length > 0 && (
        <>
          <div className="invoice-ledger-list">
            {[...invoices]
              // Business order: by issue date, newest series first. Not by
              // savedAt: marking an old invoice paid bumps its sync clock,
              // and a list that reshuffled on every tick of a checkbox would
              // feel haunted.
              .sort(
                (a, b) =>
                  (b.draft.document.issueDate || '').localeCompare(
                    a.draft.document.issueDate || '',
                  ) || b.savedAt - a.savedAt,
              )
              .map((entry) => {
                const { draft } = entry;
                const market = MARKETS[draft.market];
                const currency = draft.document.currency || 'EUR';
                const locale = getCountry(draft.seller.countryCode).locale;
                let total: string | null = null;
                try {
                  total = formatMoney(computeDraftTotals(draft).gross, currency, locale);
                } catch {
                  // A stored draft an older build wrote may not total: the
                  // row still opens in the editor, which can.
                }
                const creditNote = draft.document.typeCode === '381';
                // Payment status is for invoices; a credit note is not money
                // anyone is waiting to receive.
                const status = creditNote ? null : invoiceStatus(entry, isoDayOf(new Date()));
                const rule = rules.find((r) => r.invoiceId === entry.id);
                return (
                  <div
                    key={entry.id}
                    className="invoice-ledger-row flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Flag code={market.flag} size={18} />
                        <span className="font-mono text-sm font-medium">{draft.document.number}</span>
                        {creditNote && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                            Credit note
                          </span>
                        )}
                        {status === 'paid' && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                            Paid
                          </span>
                        )}
                        {status === 'overdue' && (
                          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                            Overdue
                          </span>
                        )}
                        {status === 'awaiting' && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                            Awaiting
                          </span>
                        )}
                        {rule && (
                          <span
                            className="rounded-full bg-accent-dim/60 px-2 py-0.5 text-[11px] font-medium text-accent-hi"
                            title={`Repeats ${rule.cadence}: next on ${rule.nextDue}`}
                          >
                            ↻ {rule.cadence}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
                        <span className="truncate">{draft.buyer.name || 'No customer yet'}</span>
                        <span className="text-faint">·</span>
                        <span className="text-faint">
                          issued {draft.document.issueDate || isoDay(entry.savedAt)}
                        </span>
                        {status !== 'paid' && draft.document.dueDate && (
                          <>
                            <span className="text-faint">·</span>
                            <span className={status === 'overdue' ? 'text-danger' : 'text-faint'}>
                              due {draft.document.dueDate}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {total && <span className="text-sm font-semibold tabular-nums">{total}</span>}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {status === 'overdue' && (
                          <button
                            onClick={() => {
                              if (!paidTools) {
                                setUpgradePrompt(
                                  'One-click chase emails for overdue invoices are on the paid plans.',
                                );
                                return;
                              }
                              setChaseFor((current) => (current === entry.id ? null : entry.id));
                            }}
                            aria-expanded={chaseFor === entry.id}
                            className="font-medium text-danger transition hover:underline"
                          >
                            Chase
                          </button>
                        )}
                        {status && (
                          <button
                            onClick={() => togglePaid(entry)}
                            className={
                              status === 'paid'
                                ? 'text-faint transition hover:text-text'
                                : 'font-medium text-success transition hover:underline'
                            }
                          >
                            {status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                          </button>
                        )}
                        <button
                          onClick={() => openForEditing(entry)}
                          className="font-medium text-accent-hi transition hover:underline"
                        >
                          Open
                        </button>
                        {view === 'advanced' && <button
                          onClick={() => duplicate(entry)}
                          className="text-muted transition hover:text-text"
                        >
                          Duplicate
                        </button>}
                        {/* The schedule control. A select rather than a
                            button-cycle: four cadences and "off" is a choice,
                            not a toggle. */}
                        {view === 'advanced' && <select
                          value={rule?.cadence ?? 'off'}
                          onChange={(e) => setRepeat(entry, e.target.value)}
                          aria-label={`Repeat ${draft.document.number}`}
                          className="cursor-pointer rounded-lg border-0 bg-transparent py-0.5 pr-1 text-sm text-muted outline-none transition hover:text-text focus:text-text"
                        >
                          <option value="off">{rule ? 'Stop repeating' : 'Repeat…'}</option>
                          {CADENCES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>}
                        {view === 'advanced' && <button
                          onClick={() => downloadXml(entry)}
                          className="text-muted transition hover:text-text"
                        >
                          XML
                        </button>}
                        <button
                          onClick={() => void downloadPdf(entry)}
                          className="text-muted transition hover:text-text"
                        >
                          PDF
                        </button>
                        {view === 'advanced' && (armedDelete === entry.id ? (
                          <span className="inline-flex items-center gap-3">
                            <button
                              onClick={() => {
                                deleteInvoice(entry.id);
                                // Deleting means deleting: the account copy
                                // and any repeat schedule go too, not just
                                // the copy in this browser.
                                removeRuleForInvoice(entry.id);
                                if (signedIn && backup) void removeAccountCopy(entry.id);
                                setArmedDelete(null);
                              }}
                              className="font-medium text-danger transition hover:underline"
                            >
                              Confirm delete
                            </button>
                            <button
                              onClick={() => setArmedDelete(null)}
                              className="text-faint transition hover:text-text"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setArmedDelete(entry.id)}
                            className="text-danger/80 transition hover:text-danger"
                          >
                            Delete
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* The chase panel opens inside the row it belongs to:
                        the flex-wrap parent drops this full-width child onto
                        its own line, so the letter sits under its invoice. */}
                    {chaseFor === entry.id && status === 'overdue' && (
                      <ChaseEmail entry={entry} onClose={() => setChaseFor(null)} />
                    )}
                  </div>
                );
              })}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-faint">
            {signedIn && backup
              ? 'Saved in this browser and backed up to your account. Turning backup off keeps what is already saved until you delete it.'
              : 'Saved in this browser only: clearing site data clears this list, and it does not follow you to another device. Download anything you need to keep.'}{' '}
            <Link href="/privacy" className="text-accent-hi hover:underline">
              Privacy
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
