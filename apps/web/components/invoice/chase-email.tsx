'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney, type Money } from '@stampbench/core';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/components/invoice/fields';
import { computeDraftTotals } from '@/lib/invoice/build';
import {
  chaseEmail,
  defaultToneFor,
  statutoryCharges,
  type ChaseLocale,
  type ChaseTone,
} from '@/lib/invoice/chase';
import { getCountry } from '@/lib/invoice/countries';
import type { SavedInvoice } from '@/lib/invoice/history';

/**
 * The chase panel: a politeness dial over three templates.
 *
 * Everything happens in this browser: the email is assembled from the draft
 * that is already here, shown for editing, and leaves through the user's own
 * mail client or clipboard. Nothing about the customer or the debt is sent
 * anywhere, which is the same promise the rest of the invoice keeps.
 *
 * The UK statutory-interest block is opt-in and GBP-only, the arithmetic is
 * done in code (lib/invoice/chase.ts), and the base rate is typed in rather
 * than baked in: it moves, and a stale constant would put wrong numbers in a
 * letter that cites an Act.
 */

const TONES: { id: ChaseTone; label: string; hint: string }[] = [
  { id: 'friendly', label: 'Friendly nudge', hint: 'first reminder, assumes an oversight' },
  { id: 'firm', label: 'Firm reminder', hint: 'asks for a payment date, 7-day window' },
  { id: 'final', label: 'Final notice', hint: 'last word before further steps' },
];

export function ChaseEmail({ entry, onClose }: { entry: SavedInvoice; onClose: () => void }) {
  const { draft } = entry;

  const daysOverdue = useMemo(() => {
    const due = Date.parse(draft.document.dueDate);
    if (!Number.isFinite(due)) return 0;
    return Math.max(0, Math.floor((Date.now() - due) / 86_400_000));
  }, [draft.document.dueDate]);

  const [tone, setTone] = useState<ChaseTone>(() => defaultToneFor(daysOverdue));
  // German buyers get a German Mahnung by default; the select is there for
  // the cross-border cases where the invoice's country and the reader differ.
  const [locale, setLocale] = useState<ChaseLocale>(() =>
    draft.buyer.countryCode === 'DE' || draft.buyer.countryCode === 'AT' ? 'de' : 'en',
  );
  const [addStatutory, setAddStatutory] = useState(false);
  const [baseRate, setBaseRate] = useState('4.0');
  const [copied, setCopied] = useState<'body' | 'subject' | null>(null);
  /** The user's edits, kept until a knob regenerates the text underneath. */
  const [edited, setEdited] = useState<string | null>(null);

  const currency = draft.document.currency || 'EUR';
  const seller = getCountry(draft.seller.countryCode);

  const gross: Money | null = useMemo(() => {
    try {
      return computeDraftTotals(draft).gross;
    } catch {
      return null;
    }
  }, [draft]);

  const cash = (value: Money) => formatMoney(value, currency, seller.locale);

  // Statutory charges only exist for a GBP debt that is actually overdue, on
  // the tones where citing an Act does not read as a threat in a first hello.
  const statutoryAvailable = currency === 'GBP' && gross !== null && daysOverdue > 0 && tone !== 'friendly';
  const statutory = useMemo(() => {
    if (!statutoryAvailable || !addStatutory || !gross) return null;
    // An empty field must show the error, not quietly become a 0% base rate
    //: Number('') is 0, which the range check would happily accept.
    const raw = baseRate.trim().replace(',', '.');
    const charges = statutoryCharges(gross, daysOverdue, raw === '' ? NaN : Number(raw));
    if (!charges) return null;
    return {
      interest: cash(charges.interest),
      compensation: cash(charges.compensation),
      totalDue: cash(charges.totalDue),
      ratePct: charges.ratePct,
      days: charges.days,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cash is stable per draft
  }, [statutoryAvailable, addStatutory, gross, daysOverdue, baseRate]);

  const email = useMemo(
    () =>
      // The ?? '' guards are load-bearing: history.ts deliberately admits
      // cross-version entries whose party fields may be missing, and this
      // panel must degrade like the rest of the page does, not throw.
      chaseEmail(tone, locale, {
        invoiceNumber: draft.document.number ?? '',
        buyerCompany: draft.buyer.name ?? '',
        contactName: draft.buyer.contactName ?? '',
        amount: gross ? cash(gross) : '',
        issueDate: draft.document.issueDate ?? '',
        dueDate: draft.document.dueDate ?? '',
        daysOverdue,
        sellerName: draft.seller.name ?? '',
        statutory,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft fields are stable per entry
    [tone, locale, statutory, daysOverdue, gross],
  );

  // A knob change replaces the text; keeping edits across a tone switch would
  // splice two letters together and read like it.
  useEffect(() => {
    setEdited(null);
  }, [email.body]);

  const body = edited ?? email.body;

  async function copy(text: string, which: 'body' | 'subject') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard blocked (permissions, http). The textarea is still there to
      // select by hand: no error state worth building for that.
    }
  }

  const buyerEmail = (draft.buyer.email ?? '').trim();
  const mailto = `mailto:${encodeURIComponent(buyerEmail)}?subject=${encodeURIComponent(
    email.subject,
  )}&body=${encodeURIComponent(body)}`;

  return (
    <div className="w-full rounded-xl border border-border bg-bg p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">
            Chase payment: <span className="font-mono">{draft.document.number}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {daysOverdue > 0 ? `${daysOverdue} days overdue. ` : ''}
            Written from templates in your browser: nothing is sent until you send it.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chase panel"
          className="rounded-lg px-2 py-1 text-sm text-muted transition hover:bg-surface hover:text-text"
        >
          ×
        </button>
      </div>

      {/* The dial. Three positions, labelled by what they do socially. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tone">
        {TONES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTone(t.id)}
            aria-pressed={tone === t.id}
            title={t.hint}
            className={
              tone === t.id
                ? 'rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted transition hover:text-text'
            }
          >
            {t.label}
          </button>
        ))}
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as ChaseLocale)}
          aria-label="Email language"
          className="ml-auto cursor-pointer rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-muted outline-none transition hover:text-text"
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </div>

      {statutoryAvailable && locale === 'en' && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={addStatutory}
              onChange={(e) => setAddStatutory(e.target.checked)}
              className="mt-0.5 accent-[var(--color-accent-hi)]"
            />
            <span>
              Add UK statutory interest and compensation
              <span className="block text-xs leading-relaxed text-faint">
                Business customers only (Late Payment of Commercial Debts Act 1998). Guidance, not
                legal advice.
              </span>
            </span>
          </label>
          {addStatutory && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-6">
              <label className="flex items-center gap-2 text-xs text-muted">
                Bank of England base rate
                <input
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                  inputMode="decimal"
                  size={4}
                  aria-label="Bank of England base rate, percent"
                  className="w-14 rounded-lg border border-border bg-bg px-2 py-1 text-sm outline-none transition focus:border-accent"
                />
                %
                <a
                  href="https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-hi hover:underline"
                >
                  check current
                </a>
              </label>
              {statutory ? (
                <span className="text-xs text-muted">
                  Interest {statutory.interest} · compensation {statutory.compensation} · new total{' '}
                  <span className="font-medium text-text">{statutory.totalDue}</span>
                </span>
              ) : (
                <span className="text-xs text-danger">Enter a base rate between 0 and 25.</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate font-mono text-xs text-muted" title={email.subject}>
            Subject: {email.subject}
          </p>
          <button
            onClick={() => void copy(email.subject, 'subject')}
            className="shrink-0 text-xs font-medium text-accent-hi transition hover:underline"
          >
            {copied === 'subject' ? 'Copied ✓' : 'Copy subject'}
          </button>
        </div>
        <textarea
          value={body}
          onChange={(e) => setEdited(e.target.value)}
          rows={Math.min(16, body.split('\n').length + 2)}
          aria-label="Chase email body"
          className="mt-1.5 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed outline-none transition focus:border-accent"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {buyerEmail ? (
          <a href={mailto} className={BUTTON_PRIMARY}>
            Open in email app
          </a>
        ) : (
          <span className="text-xs text-faint">
            No email on this invoice&apos;s customer: copy the text instead.
          </span>
        )}
        <button onClick={() => void copy(body, 'body')} className={BUTTON_SECONDARY}>
          {copied === 'body' ? 'Copied ✓' : 'Copy text'}
        </button>
      </div>
    </div>
  );
}
