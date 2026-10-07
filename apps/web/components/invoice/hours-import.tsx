'use client';

import { useMemo, useState } from 'react';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/components/invoice/fields';
import { groupHours, parseHoursLog, type HoursGroup } from '@/lib/invoice/hours';

/**
 * Import hours: the mechanical cousin of AI assist, one card down.
 *
 * Paste a Toggl-style CSV or a plain "3.5h fixing the deploy" log and it
 * becomes grouped line items: hours summed in code, descriptions kept as
 * written, nothing rephrased and nothing uploaded. The preview is the
 * contract: what it shows is exactly what lands in the editor, where every
 * line can still be changed before anything is generated.
 */
export function HoursImport({
  onApply,
}: {
  onApply: (groups: HoursGroup[], hourlyRate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState('');
  const [rate, setRate] = useState('');

  const parsed = useMemo(() => parseHoursLog(log), [log]);
  const groups = useMemo(() => groupHours(parsed.entries), [parsed]);
  const totalHours = useMemo(
    () => Math.round(groups.reduce((sum, g) => sum + g.hours, 0) * 100) / 100,
    [groups],
  );

  function apply() {
    onApply(groups, rate.trim());
    setOpen(false);
    setLog('');
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:border-border-hi hover:text-text"
      >
        <span aria-hidden>⏱</span> Import hours
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-border bg-surface p-4">
          <label htmlFor="hours-import-input" className="mb-1.5 block text-sm font-medium">
            Paste your time log
          </label>
          <textarea
            id="hours-import-input"
            rows={6}
            value={log}
            onChange={(e) => setLog(e.target.value)}
            placeholder={'A Toggl/Clockify CSV export, or plain lines like:\n3.5h homepage redesign\n1:30 deploy fixes\n45m standup calls'}
            aria-describedby="hours-import-scope"
            className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] outline-none transition placeholder:text-faint focus:border-accent"
          />
          <p id="hours-import-scope" className="mt-2 text-xs leading-relaxed text-faint">
            Groups by project (or matching description), sums the hours in code, and keeps your
            wording. Nothing is rephrased and nothing leaves your browser.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="hours-import-rate" className="text-muted">
              Hourly rate (optional)
            </label>
            <input
              id="hours-import-rate"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              placeholder="95"
              size={6}
              className="w-20 rounded-lg border border-border bg-bg px-2 py-1 text-sm outline-none transition placeholder:text-faint focus:border-accent"
            />
            <span className="text-xs text-faint">applied to every imported line</span>
          </div>

          {log.trim() !== '' && (
            <div className="mt-3 rounded-lg border border-border bg-bg p-3">
              {groups.length === 0 ? (
                <p className="text-sm text-muted">
                  No hours found yet: each line needs a duration like “3.5h”, “1:30” or “45m”, or
                  a CSV needs a duration column.
                </p>
              ) : (
                <>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-faint">
                    {groups.length} line {groups.length === 1 ? 'item' : 'items'} · {totalHours}h
                    {parsed.skipped > 0 && (
                      <span className="ml-2 normal-case tracking-normal text-danger">
                        {parsed.skipped} line{parsed.skipped === 1 ? '' : 's'} skipped (no duration)
                      </span>
                    )}
                    {parsed.truncated > 0 && (
                      <span className="ml-2 normal-case tracking-normal text-danger">
                        import capped at 1,000 entries: {parsed.truncated} line
                        {parsed.truncated === 1 ? '' : 's'} not imported
                      </span>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1 text-sm">
                    {groups.map((group) => (
                      <li key={group.description} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">{group.description}</span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {group.hours}h
                          {group.entries > 1 && (
                            <span className="text-faint"> · {group.entries} entries</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={apply} disabled={groups.length === 0} className={BUTTON_PRIMARY}>
              Insert {groups.length > 0 ? groups.length : ''} line{groups.length === 1 ? '' : ' items'}
            </button>
            <button onClick={() => setOpen(false)} className={BUTTON_SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
