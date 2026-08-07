import Link from 'next/link';
import type { Copy } from '@/lib/copy';

/**
 * The evidence board. Every figure here is real and re-derivable from the
 * repository (test runs, the rule tables, the locator measurement) — that is
 * the entire point, so each card links to /trust where the receipts live.
 * Deliberately absent: time-series we do not record, growth percentages we
 * cannot substantiate, and certification badges we do not hold.
 *
 * Chart colours: brand accent for single-measure marks; the UBL/CII donut
 * pair (#5b2bd6 / #0d9488) is CVD-validated against the light surface, and
 * every segment carries a text label so colour is never the only encoding.
 */

const TESTS = [
  { label: 'library', n: 110 },
  { label: 'CLI', n: 50 },
  { label: 'web', n: 6 },
];
const TESTS_TOTAL = TESTS.reduce((s, t) => s + t.n, 0);

const DOCS = [
  { label: 'UBL', n: 45, color: '#5b2bd6' },
  { label: 'CII', n: 41, color: '#0d9488' },
];
const DOCS_TOTAL = DOCS.reduce((s, d) => s + d.n, 0);

const RULE_FAMILIES = [32, 8, 16] as const;

/**
 * Test cases per package, counted from the repository's commit history —
 * `git grep -c "^\s*(it|test)\("` at the last commit of each day. Re-derive
 * with the same command; the final points match today's live run (110 / 50).
 * Counted 2026-08-07.
 */
const GROWTH = {
  days: ['2', '3', '4', '5', '6', '7'],
  series: [
    { color: '#5b2bd6', points: [21, 106, 110, 110, 110, 110] },
    { color: '#0d9488', points: [0, 42, 50, 50, 50, 50] },
  ],
  yMax: 120,
};

function Card({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
    >
      {children}
    </Link>
  );
}

function Evidence() {
  return (
    <span className="mt-auto pt-3 text-xs text-faint transition group-hover:text-accent-hi">
      evidence →
    </span>
  );
}

/** Two-segment donut with a 2px surface gap between segments. */
function DocsDonut() {
  const r = 34;
  const c = 2 * Math.PI * r;
  const gap = 4;
  const seg0 = (c * DOCS[0].n) / DOCS_TOTAL - gap;
  const seg1 = (c * DOCS[1].n) / DOCS_TOTAL - gap;
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24 shrink-0" aria-hidden>
      <g transform="rotate(-90 48 48)">
        <circle
          cx="48" cy="48" r={r} fill="none" stroke={DOCS[0].color} strokeWidth="11"
          strokeDasharray={`${seg0} ${c - seg0}`} strokeDashoffset="0" strokeLinecap="butt"
        />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke={DOCS[1].color} strokeWidth="11"
          strokeDasharray={`${seg1} ${c - seg1}`} strokeDashoffset={-(seg0 + gap)} strokeLinecap="butt"
        />
      </g>
      <text x="48" y="53" textAnchor="middle" className="fill-text font-sans text-lg font-semibold">
        {DOCS_TOTAL}
      </text>
    </svg>
  );
}

/** Semicircular gauge, full because the measured value really is 100%. */
function LocatedGauge() {
  return (
    <svg viewBox="0 0 120 68" className="h-20 w-32" aria-hidden>
      <path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="var(--color-accent-dim)" strokeWidth="10" strokeLinecap="round" />
      <path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="var(--color-accent)" strokeWidth="10" strokeLinecap="round" />
      <text x="60" y="56" textAnchor="middle" className="fill-text font-sans text-xl font-semibold">
        100%
      </text>
    </svg>
  );
}

/** Two-series line chart of test-suite growth. Thin 2px lines, dot markers,
    direct end labels — identity is never carried by colour alone. */
function GrowthChart({ copy }: { copy: Copy }) {
  const g = copy.statsBoard.growth;
  const W = 560;
  const H = 150;
  const PAD = { l: 34, r: 96, t: 12, b: 24 };
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (GROWTH.days.length - 1);
  const y = (v: number) => PAD.t + (1 - v / GROWTH.yMax) * (H - PAD.t - PAD.b);
  const line = (pts: number[]) => pts.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ');

  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:col-span-2 lg:col-span-4">
      <div className="mb-1 text-sm font-medium">{g.label}</div>
      <div className="mb-4 text-xs text-faint">{g.sub}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={g.label}>
        {[0, 40, 80, 120].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-faint font-sans text-[9px]">
              {v}
            </text>
          </g>
        ))}
        {GROWTH.days.map((d, i) => (
          <text key={d} x={x(i)} y={H - 8} textAnchor="middle" className="fill-faint font-sans text-[9px]">
            Aug {d}
          </text>
        ))}
        {GROWTH.series.map((sr, si) => (
          <g key={sr.color}>
            <path d={line(sr.points)} fill="none" stroke={sr.color} strokeWidth="2" strokeLinejoin="round" />
            {sr.points.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={sr.color} stroke="var(--color-surface)" strokeWidth="1.5" />
            ))}
            <text
              x={x(GROWTH.days.length - 1) + 10}
              y={y(sr.points[sr.points.length - 1]) + 3}
              className="fill-muted font-sans text-[10px]"
            >
              {sr.points[sr.points.length - 1]} {g.series[si]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function StatsBoard({ copy }: { copy: Copy }) {
  const s = copy.statsBoard;
  const barMax = Math.max(...TESTS.map((t) => t.n));
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Tests */}
      <Card href="/trust">
        <div className="text-3xl font-semibold tracking-tight text-accent">{TESTS_TOTAL}</div>
        <div className="mt-1 text-sm">{s.tests.label}</div>
        <div className="my-3 space-y-1.5">
          {TESTS.map((t) => (
            <div key={t.label} className="h-1.5 rounded-full bg-accent-dim">
              <div
                className="h-1.5 rounded-full bg-accent"
                style={{ width: `${(t.n / barMax) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="text-xs text-faint">{s.tests.sub}</div>
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <span aria-hidden>✓</span> {s.tests.failing}
        </div>
        <Evidence />
      </Card>

      {/* Documents */}
      <Card href="/trust">
        <div className="flex items-center gap-4">
          <DocsDonut />
          <div className="space-y-1.5 text-xs">
            {DOCS.map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="text-muted">
                  <span className="font-medium text-text">{d.n}</span> {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 text-sm">{s.docs.label}</div>
        <div className="mt-1 text-xs text-faint">{s.docs.sub}</div>
        <Evidence />
      </Card>

      {/* Rules */}
      <Card href="/docs#rules">
        <div className="text-3xl font-semibold tracking-tight text-accent">
          {RULE_FAMILIES.reduce((a, b) => a + b, 0)}
        </div>
        <div className="mt-1 text-sm">{s.rules.label}</div>
        <div className="my-3 space-y-2.5">
          {RULE_FAMILIES.map((n, i) => (
            <div key={s.rules.families[i]}>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>{s.rules.families[i]}</span>
                <span className="font-mono">{n} / {n}</span>
              </div>
              <div className="h-1.5 rounded-full bg-accent-dim">
                <div className="h-1.5 w-full rounded-full bg-accent" />
              </div>
            </div>
          ))}
        </div>
        <Evidence />
      </Card>

      {/* Located */}
      <Card href="/trust">
        <LocatedGauge />
        <div className="mt-2 text-sm">{s.located.label}</div>
        <div className="mt-1 text-xs font-medium leading-relaxed text-muted">{s.located.subLead}</div>
        <div className="mt-1 text-xs leading-relaxed text-faint">{s.located.subDetail}</div>
        <Evidence />
      </Card>

      <GrowthChart copy={copy} />
    </div>
  );
}
