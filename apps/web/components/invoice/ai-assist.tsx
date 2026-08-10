'use client';

import { useEffect, useState } from 'react';
import { aiDraft, aiStatus, ApiError, type AiDraftLine } from '@/lib/account-client';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/components/invoice/fields';

/**
 * AI assist — plain English in, line items out.
 *
 * Scoped to exactly one job on purpose. It proposes descriptions, quantities,
 * units and prices: the commercial content the user is describing. It is never
 * asked for a tax rate, a VAT number, an address, a date or a buyer reference,
 * and the server strips anything of that shape out of the reply. Those are the
 * fields where a confident guess turns "invalid" into "quietly wrong", which
 * is the failure this whole product exists to avoid — so the assistant is not
 * given the chance to make it.
 *
 * The proposal lands in the editor as ordinary draft lines that the user can
 * change or delete before anything is generated. Nothing is applied silently.
 */
export function AiAssist({
  currency,
  onApply,
}: {
  currency: string;
  onApply: (lines: AiDraftLine[], note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<'signup' | 'quota' | null>(null);

  // Probed once, like the playground's explainer: the button says what it can
  // actually do rather than promising a feature that is switched off.
  useEffect(() => {
    aiStatus()
      .then((status) => setEnabled(status.enabled))
      .catch(() => setEnabled(false));
  }, []);

  async function run() {
    setBusy(true);
    setError(null);
    setGate(null);
    try {
      const result = await aiDraft(description, currency);
      onApply(result.lines, result.note);
      setOpen(false);
      setDescription('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthenticated') setGate('signup');
      else if (e instanceof ApiError && e.code === 'quota') setGate('quota');
      else setError(e instanceof Error ? e.message : 'The assist failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent-dim/40 px-4 py-2 text-sm font-medium text-accent-hi transition hover:bg-accent-dim"
      >
        <span aria-hidden>✦</span> AI assist
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-border bg-surface p-4">
          {enabled === false ? (
            <p className="text-sm leading-relaxed text-muted">
              AI assist is built but not switched on for this deployment — no model key is configured, so
              there is nothing behind the button yet. Everything else on this page works without it.
            </p>
          ) : (
            <>
              <label htmlFor="ai-assist-input" className="mb-1.5 block text-sm font-medium">
                What are you invoicing for?
              </label>
              <textarea
                id="ai-assist-input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="12 hours of design work at £95/hr, plus a £400 licence fee"
                aria-describedby="ai-assist-scope"
                className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition placeholder:text-faint focus:border-accent"
              />
              <p id="ai-assist-scope" className="mt-2 text-xs leading-relaxed text-faint">
                Returns line items only — descriptions, quantities, units and prices. It is not asked for
                and cannot set tax rates, VAT numbers, addresses or dates; you fill those in yourself.
                Your text is sent to the model; the rest of the invoice is not.
              </p>

              {gate === 'signup' && (
                <p className="mt-2 text-sm text-muted">
                  AI assist needs a free account.{' '}
                  <a href="/signup" className="text-accent-hi hover:underline">
                    Create one
                  </a>
                  .
                </p>
              )}
              {gate === 'quota' && (
                <p className="mt-2 text-sm text-muted">
                  AI assists used up for this month.{' '}
                  <a href="/account" className="text-accent-hi hover:underline">
                    See plans
                  </a>
                  .
                </p>
              )}
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={run}
                  disabled={busy || description.trim().length < 3}
                  className={BUTTON_PRIMARY}
                >
                  {busy ? 'Thinking…' : 'Suggest line items'}
                </button>
                <button onClick={() => setOpen(false)} className={BUTTON_SECONDARY}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
