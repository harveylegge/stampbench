'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney, type Money } from '@stampbench/core';

import type { CurrencySeries } from '@/lib/invoice/status';

/**
 * Invoiced money per month, as a chart — the month-by-month companion to the
 * "this month" summary card above it.
 *
 * One series only: the area is what was invoiced. "Paid" and the invoice
 * count ride along in the tooltip and the (screen-reader) table rather than
 * as a second line, because two lines need a legend and this card's job is a
 * shape, not a comparison. Everything the tooltip shows is also in the table,
 * so hover never gates a number.
 *
 * Currencies never mix in one line — £3,000 + €500 is not a number. Each
 * currency is its own series; with more than one, chips switch between them
 * and the one with the most invoices leads.
 */

/** Plot band heights. The container's height is their sum — the x-axis band is
 *  part of the layout, never an overflow. */
const PAD_TOP = 14;
const PLOT_H = 156;
const AXIS_H = 24;
const SVG_H = PAD_TOP + PLOT_H + AXIS_H;
const PAD_RIGHT = 10;

const TOOLTIP_W = 190;

function majorUnits(value: Money): number {
  return value.units / 10 ** value.scale;
}

/** A tick step that lands on clean numbers: 1/2/2.5/5 × 10^k. */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

function ticksFor(min: number, max: number): number[] {
  if (min === max) {
    // A flat series (all zeros) still needs a frame to hang the line on.
    return min === 0 ? [0, 1] : [0, min];
  }
  const step = niceStep((max - min) / 4);
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step / 2; v += step) {
    // -0 upsets both rendering and the eye.
    ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  }
  return ticks;
}

function monthDate(key: string): Date {
  return new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));
}

export function MonthlyChart({ series }: { series: CurrencySeries[] }) {
  const [currency, setCurrency] = useState<string | null>(null);
  // null = nothing hovered/focused. Pointer and keyboard share this state, so
  // focus shows exactly what hover shows.
  const [active, setActive] = useState<number | null>(null);
  // The container is state, not a ref: this component mounts before the
  // history has been read and renders nothing at all until there is data, so
  // a mount-time effect would observe a container that does not exist yet.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(container);
    setWidth(container.clientWidth);
    return () => observer.disconnect();
  }, [container]);

  const shown = series.find((s) => s.currency === currency) ?? series[0];

  const geometry = useMemo(() => {
    if (!shown || width < 120) return null;
    const values = shown.months.map((p) => majorUnits(p.invoiced));
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const ticks = ticksFor(min, max);
    const lo = ticks[0]!;
    const hi = ticks[ticks.length - 1]!;
    const y = (v: number) => PAD_TOP + PLOT_H - ((v - lo) / (hi - lo)) * PLOT_H;

    // Plain grouped integers, not compact notation: some locales abbreviate
    // 10.000 but spell out 5000, and an axis that mixes the two reads broken.
    const tickFormat = new Intl.NumberFormat(shown.locale, {
      maximumFractionDigits: 0,
    });
    const labels = ticks.map((t) => tickFormat.format(t));
    // The y-gutter is sized by its own labels, so ticks never collide with
    // the plot no matter the magnitude.
    const padLeft = Math.max(30, Math.max(...labels.map((l) => l.length)) * 6.5 + 12);

    const n = shown.months.length;
    const innerW = Math.max(0, width - padLeft - PAD_RIGHT);
    const band = innerW / n;
    const x = (i: number) => padLeft + (i + 0.5) * band;

    const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const area = `${line}L${x(n - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;

    // Thin out month labels before they collide instead of shrinking them.
    const labelStep = Math.max(1, Math.ceil(34 / band));

    return { values, ticks, y, x, band, padLeft, line, area, tickFormat, labelStep, hasNegative: lo < 0 };
  }, [shown, width]);

  // Series with a shape are worth a chart; a single active month is already
  // told by the summary card above, so the card stays out of the way.
  if (!series.some((s) => s.activeMonths >= 2)) return null;
  if (!shown) return null;

  const monthShort = (key: string, index: number) => {
    const date = monthDate(key);
    const name = date.toLocaleDateString('en-GB', { month: 'short' });
    // The year rides on January (and the window's first label) so a 12-month
    // strip that crosses new year stays readable.
    return date.getUTCMonth() === 0 || index === 0
      ? `${name} ’${String(date.getUTCFullYear() % 100).padStart(2, '0')}`
      : name;
  };
  const monthLong = (key: string) =>
    monthDate(key).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const pointFrom = (clientX: number) => {
    if (!geometry) return null;
    const rect = container?.getBoundingClientRect();
    if (!rect) return null;
    const idx = Math.floor((clientX - rect.left - geometry.padLeft) / geometry.band);
    return Math.max(0, Math.min(shown.months.length - 1, idx));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = shown.months.length - 1;
    let next: number | null | undefined;
    if (event.key === 'ArrowLeft') next = Math.max(0, (active ?? last) - 1);
    else if (event.key === 'ArrowRight') next = Math.min(last, (active ?? -1) + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === 'Escape') next = null;
    else return;
    event.preventDefault();
    setActive(next);
  };

  const activePoint = active !== null ? shown.months[active] : undefined;
  const tooltipLeft =
    geometry && active !== null
      ? Math.max(4, Math.min(geometry.x(active) - TOOLTIP_W / 2, width - TOOLTIP_W - 4))
      : 0;

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-faint">
          Invoiced by month{series.length === 1 ? ` · ${shown.currency}` : ''}
        </div>
        {series.length > 1 && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Chart currency">
            {series.map((s) => (
              <button
                key={s.currency}
                onClick={() => {
                  setCurrency(s.currency);
                  setActive(null);
                }}
                aria-pressed={s.currency === shown.currency}
                className={
                  s.currency === shown.currency
                    ? 'rounded-full bg-accent-dim/60 px-2.5 py-0.5 text-[11px] font-medium text-accent-hi'
                    : 'rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-muted transition hover:text-text'
                }
              >
                {s.currency}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        ref={setContainer}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        tabIndex={0}
        role="img"
        aria-label={`Invoiced per month over the last 12 months in ${shown.currency}. Use arrow keys to read each month; the table below has every figure.`}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerMove={(e) => setActive(pointFrom(e.clientX))}
        onPointerLeave={() => setActive(null)}
      >
        {geometry && (
          <svg width={width} height={SVG_H} className="block" aria-hidden>
            {/* Recessive frame: solid hairlines one step off the surface. */}
            {geometry.ticks.map((t) => (
              <line
                key={t}
                x1={geometry.padLeft}
                x2={width - PAD_RIGHT}
                y1={geometry.y(t)}
                y2={geometry.y(t)}
                stroke="var(--color-border)"
                strokeOpacity={t === 0 ? 1 : 0.55}
                strokeWidth={1}
              />
            ))}
            {geometry.ticks.map((t) => (
              <text
                key={`tick-${t}`}
                x={geometry.padLeft - 8}
                y={geometry.y(t) + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--color-faint)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {geometry.tickFormat.format(t)}
              </text>
            ))}

            {shown.months.map((p, i) =>
              i % geometry.labelStep === 0 ? (
                <text
                  key={p.month}
                  x={geometry.x(i)}
                  y={PAD_TOP + PLOT_H + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-faint)"
                >
                  {monthShort(p.month, i)}
                </text>
              ) : null,
            )}

            {/* The series: a 2px line over its own 10% wash. */}
            <path d={geometry.area} fill="var(--color-accent)" fillOpacity={0.1} />
            <path
              d={geometry.line}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Crosshair snapped to the hovered month. */}
            {active !== null && (
              <line
                x1={geometry.x(active)}
                x2={geometry.x(active)}
                y1={PAD_TOP}
                y2={PAD_TOP + PLOT_H}
                stroke="var(--color-border-hi)"
                strokeWidth={1}
              />
            )}
            {active !== null && (
              <circle
                cx={geometry.x(active)}
                cy={geometry.y(geometry.values[active]!)}
                r={4.5}
                fill="var(--color-accent)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            )}

            {/* The endpoint is the one directly-labelled value: today's month,
                with its dot — everything else reads off the axis or tooltip. */}
            {active === null && (
              <>
                <circle
                  cx={geometry.x(shown.months.length - 1)}
                  cy={geometry.y(geometry.values[shown.months.length - 1]!)}
                  r={4.5}
                  fill="var(--color-accent)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
                <text
                  x={geometry.x(shown.months.length - 1) - 9}
                  y={geometry.y(geometry.values[shown.months.length - 1]!) - 9}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--color-muted)"
                >
                  {geometry.tickFormat.format(geometry.values[shown.months.length - 1]!)}
                </text>
              </>
            )}
          </svg>
        )}

        {activePoint && geometry && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-border bg-surface p-2.5 text-xs shadow-sm"
            style={{ left: tooltipLeft, width: TOOLTIP_W }}
          >
            <div className="mb-1 font-medium text-faint">{monthLong(activePoint.month)}</div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full bg-accent" />
                <span className="font-semibold tabular-nums">
                  {formatMoney(activePoint.invoiced, shown.currency, shown.locale)}
                </span>
                <span className="text-muted">invoiced</span>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full bg-success" />
                <span className="font-semibold tabular-nums">
                  {formatMoney(activePoint.paid, shown.currency, shown.locale)}
                </span>
                <span className="text-muted">paid</span>
              </div>
              <div className="text-muted">
                {activePoint.count === 0
                  ? 'No invoices'
                  : activePoint.count === 1
                    ? '1 invoice'
                    : `${activePoint.count} invoices`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The chart's table twin — every figure the chart or its tooltip can
          show, reachable with no pointer at all. */}
      <table className="sr-only">
        <caption>Invoices by month, {shown.currency}, last 12 months</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Invoices</th>
            <th scope="col">Invoiced</th>
            <th scope="col">Paid</th>
          </tr>
        </thead>
        <tbody>
          {shown.months.map((p) => (
            <tr key={p.month}>
              <th scope="row">{monthLong(p.month)}</th>
              <td>{p.count}</td>
              <td>{formatMoney(p.invoiced, shown.currency, shown.locale)}</td>
              <td>{formatMoney(p.paid, shown.currency, shown.locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
