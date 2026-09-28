'use client';

/**
 * The Stampbench assistant — a floating chat widget on every page.
 *
 * Paid feature with a deliberately public face: everyone sees the button, and
 * the panel adapts to who opened it. Signed out → what it is plus a sign-in
 * link; Free → the locked pitch; paid → the chat. The plan check here only
 * picks the panel — the worker enforces the gate for real (402 'plan'), and
 * a 'plan' error simply flips the panel to the locked state.
 *
 * Costs nothing until opened: no fetch runs on mount, only on first open
 * (currentPlan() is cached per page view, aiStatus() is one public GET).
 * The transcript lives in sessionStorage so navigating does not wipe it —
 * and dies with the tab, which is the right lifetime for a support chat.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { ApiError, aiChat, aiStatus, currentPlan, type ChatTurn } from '@/lib/account-client';
import { entitlementsFor } from '@/lib/entitlements';
import { COPY, type Locale } from '@/lib/copy';
import type { PlanId } from '@/lib/plans';

const STORE = 'sb_assistant_chat';
const MAX_TURNS = 24;

function readTranscript(): ChatTurn[] {
  try {
    const raw = window.sessionStorage.getItem(STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is ChatTurn =>
        !!t &&
        typeof t === 'object' &&
        ((t as ChatTurn).role === 'user' || (t as ChatTurn).role === 'assistant') &&
        typeof (t as ChatTurn).content === 'string',
    );
  } catch {
    return [];
  }
}

function writeTranscript(turns: ChatTurn[]): void {
  try {
    window.sessionStorage.setItem(STORE, JSON.stringify(turns.slice(-MAX_TURNS)));
  } catch {
    // Storage full or unavailable — the chat still works, it just forgets.
  }
}

type Note = 'quota' | 'pool' | 'error' | null;

export function AssistantWidget() {
  const pathname = usePathname() ?? '/';
  const locale: Locale = pathname === '/de' || pathname.startsWith('/de/') ? 'de' : 'en';
  const copy = COPY[locale].assistant;

  const [open, setOpen] = useState(false);
  /** undefined = not probed yet; null = signed out. */
  const [plan, setPlan] = useState<PlanId | null | undefined>(undefined);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  /** Server said 'plan' — trust it over the client's cached idea. */
  const [serverLocked, setServerLocked] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const probed = useRef(false);

  const probe = useCallback(() => {
    if (probed.current) return;
    probed.current = true;
    setTurns(readTranscript());
    void currentPlan().then(setPlan).catch(() => setPlan(null));
    // A one-off probe failure must NOT be read as "assistant disabled" and
    // strand a paying user for the whole session: leave `enabled` unknown
    // (null falls through to the chat UI), and let a real send surface any
    // genuine problem. Only an explicit {enabled:false} shows the off panel.
    void aiStatus().then((s) => setEnabled(s.enabled)).catch(() => {});
  }, []);

  function toggle() {
    if (!open) probe();
    setOpen(!open);
  }

  // Keep the newest message in view, and hand focus to the input on open.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, turns, busy]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const outgoing: ChatTurn[] = [...turns, { role: 'user' as const, content: text }].slice(-MAX_TURNS);
    setTurns(outgoing);
    setInput('');
    setNote(null);
    setBusy(true);
    try {
      const { reply } = await aiChat(outgoing);
      const done: ChatTurn[] = [...outgoing, { role: 'assistant', content: reply }];
      setTurns(done);
      writeTranscript(done);
    } catch (e) {
      // The failed question comes back out of the transcript and into the
      // box: nothing successful is lost, and pressing send retries cleanly.
      setTurns(turns);
      setInput(text);
      if (e instanceof ApiError && e.code === 'plan') setServerLocked(true);
      else if (e instanceof ApiError && e.code === 'quota') setNote('quota');
      else if (e instanceof ApiError && e.code === 'pool_empty') setNote('pool');
      else if (e instanceof ApiError && e.code === 'unauthenticated') {
        // The session ended (e.g. signed out in another tab). Drop the
        // conversation so the next person on this browser cannot read it.
        setPlan(null);
        setServerLocked(false);
        setTurns([]);
        try {
          window.sessionStorage.removeItem(STORE);
        } catch {
          // storage unavailable — the in-memory clear above is enough
        }
      } else setNote('error');
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const paid = !serverLocked && entitlementsFor(plan ?? null).aiChat;
  const noteText = note === 'quota' ? copy.quotaBody : note === 'pool' ? copy.poolBody : note === 'error' ? copy.errorBody : null;

  return (
    <div className="print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label={copy.title}
          className="assistant-panel fixed bottom-20 right-4 z-[60] flex max-h-[min(32rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden border border-border bg-bg/95 shadow-lg backdrop-blur"
        >
          <div className="assistant-header flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
            <span className="text-sm font-semibold tracking-tight">{copy.title}</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-0.5 text-sm text-faint transition hover:text-text"
            >
              {copy.close}
            </button>
          </div>

          {plan === undefined ? (
            <div className="p-4" aria-hidden>
              <div className="h-16 animate-pulse rounded-lg bg-surface-2" />
            </div>
          ) : plan === null ? (
            <div className="p-4 text-sm text-muted">
              <p>{copy.signedOutBody}</p>
              <div className="mt-3 flex gap-2">
                <a
                  href="/signin"
                  className="sb-press rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hi"
                >
                  {copy.signIn}
                </a>
                <a
                  href="/pricing"
                  className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:border-border-hi"
                >
                  {copy.seePricing}
                </a>
              </div>
            </div>
          ) : !paid ? (
            <div className="p-4 text-sm text-muted">
              <p>{copy.lockedBody}</p>
              <a
                href="/account"
                className="sb-press mt-3 inline-block rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hi"
              >
                {copy.seePricing}
              </a>
            </div>
          ) : enabled === false ? (
            <div className="p-4 text-sm text-muted">{copy.disabledBody}</div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto p-3">
                <div className="flex flex-col gap-2">
                  <div className="max-w-[85%] self-start rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    {copy.greeting}
                  </div>
                  {turns.map((t, i) => (
                    <div
                      key={i}
                      className={
                        t.role === 'user'
                          ? 'max-w-[85%] self-end whitespace-pre-wrap rounded-lg bg-accent-dim px-3 py-2 text-sm'
                          : 'max-w-[85%] self-start whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-sm'
                      }
                    >
                      {t.content}
                    </div>
                  ))}
                  {busy && (
                    <div className="max-w-[85%] self-start rounded-lg border border-border bg-surface px-3 py-2 text-sm text-faint">
                      {copy.thinking}
                    </div>
                  )}
                  {noteText && (
                    <div className="max-w-[85%] self-start rounded-lg border border-accent/40 bg-accent-dim/40 px-3 py-2 text-sm">
                      {noteText}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-border bg-surface p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={2}
                    placeholder={copy.placeholder}
                    aria-label={copy.placeholder}
                    className="min-h-9 flex-1 resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={busy || input.trim().length === 0}
                    className="sb-press rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent-hi disabled:opacity-40"
                  >
                    {copy.send}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-faint">{copy.scope}</p>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={copy.open}
        aria-expanded={open}
        className="assistant-launch sb-press fixed bottom-4 right-4 z-[60] flex h-12 w-12 items-center justify-center bg-accent text-white shadow-lg transition hover:bg-accent-hi"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
            <path
              d="M11 2c.4 3.9 2.6 6.4 7 7-4.4.6-6.6 3.1-7 7-.4-3.9-2.6-6.4-7-7 4.4-.6 6.6-3.1 7-7z"
              fill="currentColor"
            />
            <path d="M17.5 13.5c.2 1.7 1.2 2.8 3 3-1.8.2-2.8 1.3-3 3-.2-1.7-1.2-2.8-3-3 1.8-.2 2.8-1.3 3-3z" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
