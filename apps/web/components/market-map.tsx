'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Flag } from '@/components/flag';
import type { MarketsCopy } from '@/lib/copy';
import { onMarketChange, readMarket, writeMarket } from '@/lib/market-preference';
import { MARKETS, PAGE_MARKETS, RULE_COUNTS, marketHref, type MarketId } from '@/lib/markets';

/**
 * "Where does your business operate?", answered in place.
 *
 * The four cards this replaced asked the question and then made you leave the
 * page to hear the answer: a navigation to /markets/uk for what is, in the
 * end, six lines of fact. Here the answer arrives next to the question, and
 * the market page becomes what you click when the summary is not enough
 * rather than the only way to see anything at all.
 *
 * The map is deliberately schematic, but it is not decoration: it carries two
 * things the panel cannot say as quickly.
 *
 * Germany is drawn *inside* the EU landmass, and picking the EU shades it
 * darker rather than punching a hole through it: that is the actual
 * relationship. XRechnung is a customisation of EN 16931, not an alternative
 * to it, and the nesting says so without a sentence. And the US is cut off by
 * the left edge of the frame rather than floated in the ocean, which is the
 * honest picture of what Stampbench does for a US business: the work is over
 * there, across the Atlantic.
 *
 * Every fact in the panel is read out of lib/markets.ts, the single source of
 * truth for what the engine covers and: more importantly: what it does not.
 * Nothing here may hard-code a capability: the product rests on never
 * overstating coverage, and a marketing panel that drifted from the ruleset
 * registry is exactly how that promise breaks. The two rows that always read
 * "Not set" are here for the same reason. A summary listing only the ticks would be
 * a different document.
 *
 * The map needs JavaScript, so the links to every market page are repeated as
 * real anchors underneath it. Those links were the cards' other job, and a
 * static marketing site that dropped its internal links into an SVG click
 * handler would have traded them for an interaction.
 */

/** How a single line of the summary stands. */
type FactTone = 'yes' | 'partial' | 'no';

const TONE: Record<FactTone, { glyph: string; className: string }> = {
  yes: { glyph: '✓', className: 'text-success' },
  partial: { glyph: '~', className: 'text-warning' },
  no: { glyph: 'Not set', className: 'text-faint' },
};

/**
 * The summary for one market, derived rather than written.
 *
 * `domestic` and `xrechnung` are the only two capabilities that vary between
 * markets: everything else is a property of the engine and therefore
 * identical everywhere, which is itself worth showing.
 */
function factsFor(id: MarketId, t: MarketsCopy['panel']) {
  const { capabilities } = MARKETS[id];
  const xrechnung = `XRechnung 3.0 · ${RULE_COUNTS.xrechnung} ${t.rules}`;

  const national =
    capabilities.domestic.status === 'yes'
      ? { value: xrechnung, tone: 'yes' as const }
      : capabilities.domestic.status === 'context'
        ? { value: t.nationalGermanyOnly, tone: 'partial' as const }
        : { value: t.nationalNone, tone: 'no' as const };

  const german =
    capabilities.xrechnung.status === 'yes'
      ? { value: xrechnung, tone: 'yes' as const }
      : {
          value: t.germanSwitch.replace('{count}', String(RULE_COUNTS.xrechnung)),
          tone: 'partial' as const,
        };

  return [
    {
      label: t.european,
      value: `EN 16931 · ${RULE_COUNTS.en16931} ${t.rules}`,
      tone: 'yes' as FactTone,
    },
    { label: t.syntaxes, value: 'UBL 2.1 · UN/CEFACT CII', tone: 'yes' as FactTone },
    { label: t.national, ...national },
    { label: t.germanBuyers, ...german },
    { label: t.taxRate, value: t.taxRateValue, tone: 'no' as FactTone },
    { label: t.network, value: t.networkValue, tone: 'no' as FactTone },
  ];
}

/**
 * The coastline, at roughly five units per degree of longitude. Recognisable
 * rather than accurate: a traced border at this size is illegible detail that
 * also invites "why is my country missing?", when the four regions here are
 * the only four the engine distinguishes.
 */
const LAND: { id: MarketId; d: string; label: string; at: [number, number] }[] = [
  {
    id: 'us',
    label: 'US',
    at: [30, 140],
    d: 'M0 58 L52 66 L62 96 L58 130 L46 160 L52 190 L48 214 L34 206 L12 196 L0 190 Z',
  },
  {
    id: 'uk',
    label: 'UK',
    // Great Britain is barely wider than the word at this scale; 196 is the
    // one x where "UK" clears both coasts instead of straddling the western
    // one, which left half the letters on the sea.
    at: [196, 99],
    d:
      'M172 118 L185 107 L175 100 L185 93 L182 82 L172 71 L175 55 L185 55 L190 63 L186 73 L193 83 L200 92 L209 98 L205 108 L198 113 Z ' +
      'M150 93 L160 80 L170 82 L173 89 L170 102 L153 107 Z',
  },
  {
    id: 'eu',
    label: 'EU',
    at: [330, 108],
    // Iberia, France, the Low Countries, Jutland, the Baltic coast, the eastern
    // plain, the Black Sea, Greece, the Adriatic and Italy: one coastline, in
    // that order: then Sicily and the Nordics as their own islands of the
    // same region.
    d:
      'M155 169 L185 165 L193 154 L176 130 L195 122 L210 111 L225 96 L241 78 L248 63 L255 85 ' +
      'L293 85 L305 74 L323 49 L325 45 L350 45 L360 82 L375 133 L378 151 L344 155 L340 173 ' +
      'L340 184 L323 188 L315 213 L310 217 L305 202 L298 188 L280 169 L268 149 L263 158 ' +
      'L275 176 L292 191 L283 195 L278 206 L270 188 L260 177 L253 166 L245 159 L225 167 ' +
      'L215 178 L200 195 L174 220 L156 213 L153 195 Z ' +
      'M267 209 L278 204 L276 215 Z ' +
      'M255 46 L241 30 L232 8 L258 0 L296 0 L300 22 L288 40 L270 52 Z ' +
      'M306 0 L330 0 L332 30 L325 45 L310 40 L304 18 Z',
  },
  {
    id: 'germany',
    label: 'DE',
    at: [252, 108],
    d: 'M247 83 L272 89 L275 111 L267 128 L248 136 L230 112 L235 93 Z',
  },
];

export function MarketMap({ copy }: { copy: MarketsCopy }) {
  const t = copy.panel;
  const [selected, setSelected] = useState<MarketId>('eu');
  const [remembered, setRemembered] = useState<MarketId | null>(null);

  // Rendered identically for everyone on the server, then reconciled on mount:
  // the stored preference lives in localStorage, which a static page cannot
  // know about at build time.
  useEffect(() => {
    const sync = () => {
      const stored = readMarket();
      setRemembered(stored);
      if (stored) setSelected(stored);
    };
    sync();
    return onMarketChange(sync);
  }, []);

  /** The localised name for a market, falling back to the canonical one. */
  const nameOf = (id: MarketId) =>
    copy.cards.find((card) => card.id === id)?.name ?? MARKETS[id].name;
  const taglineOf = (id: MarketId) =>
    copy.cards.find((card) => card.id === id)?.tagline ?? MARKETS[id].pickerHint;

  const market = MARKETS[selected];

  return (
    // scroll-mt clears the sticky header: the hero's secondary CTA is an
    // in-page jump, and landing with the heading tucked under the nav bar
    // would make the band look like it starts mid-sentence.
    <section id="markets" className="scroll-mt-14 border-t border-border bg-surface/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 max-w-2xl">
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-hi">
            {copy.eyebrow}
          </div>
          <h2 className="mb-3 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.heading}</h2>
          <p className="leading-relaxed text-muted">{copy.body}</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded-2xl border border-border bg-surface-2/60 p-4">
            <svg
              viewBox="0 0 400 228"
              className="h-auto w-full"
              role="group"
              aria-label={copy.heading}
            >
              {/* Graticule. Faint enough to read as paper ruling, not a chart. */}
              <defs>
                <pattern id="sb-grat" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path
                    d="M20 0H0V20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.4"
                    opacity="0.13"
                  />
                </pattern>
              </defs>
              <rect
                x="0"
                y="0"
                width="400"
                height="228"
                fill="url(#sb-grat)"
                className="pointer-events-none text-border-hi"
              />

              {LAND.map((land) => {
                const isSelected = selected === land.id;
                // Germany is drawn inside the EU landmass, so when the EU is
                // the selection it has to read as part of the highlighted
                // region rather than as a hole punched through it: while
                // staying visibly its own thing, which is the entire reason it
                // is a separate region at all.
                const insideSelection = land.id === 'germany' && selected === 'eu';
                return (
                  <g
                    key={land.id}
                    onClick={() => setSelected(land.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelected(land.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={nameOf(land.id)}
                    // `path+path` so the focus ring lands on the drawn
                    // coastline rather than on the invisible hit target, whose
                    // 11-unit stroke would bloom into a blob around it.
                    className="group cursor-pointer outline-none [&:focus-visible>path+path]:stroke-accent"
                  >
                    {/* An invisible target a few units wider than the country.
                        Without it the only clickable pixels are the filled
                        shape itself, which means aiming at the UK and landing
                        in the Irish Sea does nothing at all: and the UK is
                        two small islands with water down the middle, so that
                        is not a rare miss. The fat transparent stroke widens
                        every coastline outward without changing a pixel of
                        what is drawn. */}
                    <path
                      d={land.d}
                      fillRule="evenodd"
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth="11"
                      strokeLinejoin="round"
                    />
                    <path
                      d={land.d}
                      fillRule="evenodd"
                      className={`pointer-events-none transition-[fill,stroke] duration-200 ${
                        isSelected
                          ? 'fill-accent stroke-accent'
                          : // group-hover, not hover: the drawn path is
                            // pointer-events-none so the hit target above can
                            // own the cursor, which means it never sees a
                            // hover of its own.
                            insideSelection
                            ? 'fill-accent-hi stroke-accent-dim group-hover:fill-accent'
                            : 'fill-border stroke-border-hi group-hover:fill-border-hi'
                      }`}
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                    <text
                      x={land.at[0]}
                      y={land.at[1]}
                      textAnchor="middle"
                      className={`pointer-events-none select-none text-[11px] font-semibold ${
                        isSelected || insideSelection ? 'fill-white' : 'fill-muted'
                      }`}
                    >
                      {land.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* "Several markets" is the one choice with nowhere to stand on a
                map, so it sits under it as a chip rather than being forced
                onto some arbitrary patch of ocean. */}
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-faint">{t.hint}</p>
              <button
                type="button"
                onClick={() => setSelected('multi')}
                aria-pressed={selected === 'multi'}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  selected === 'multi'
                    ? 'border-accent/50 bg-accent-dim text-accent-hi'
                    : 'border-border text-muted hover:border-border-hi'
                }`}
              >
                {t.several}
              </button>
            </div>
          </div>

          {/* aria-live: on a map, the thing that changed is somewhere else on
              the screen, so the answer has to announce itself. */}
          <div
            aria-live="polite"
            className="flex h-full min-h-[19rem] flex-col rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 text-muted">
                <Flag code={market.flag} size={34} />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold leading-tight tracking-tight">
                  {nameOf(selected)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{taglineOf(selected)}</p>
              </div>
            </div>

            <dl className="mt-5 flex flex-col">
              {factsFor(selected, t).map((fact) => {
                const tone = TONE[fact.tone];
                return (
                  <div
                    key={fact.label}
                    className="flex items-baseline gap-3 border-b border-dashed border-border py-2 last:border-0"
                  >
                    <dt className="w-[9.5rem] shrink-0 text-[0.8rem] text-faint">{fact.label}</dt>
                    <dd className="flex min-w-0 items-baseline gap-1.5 text-[0.84rem]">
                      <span className={`font-mono text-[0.72rem] ${tone.className}`} aria-hidden>
                        {tone.glyph}
                      </span>
                      <span className={fact.tone === 'no' ? 'text-faint' : 'text-text'}>
                        {fact.value}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>

            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 text-sm">
              <Link
                href={marketHref(selected)}
                onClick={() => writeMarket(selected)}
                className="font-medium text-accent-hi hover:underline"
              >
                {market.hasPage
                  ? `${t.everything.replace('{market}', nameOf(selected))} →`
                  : `${copy.compare} →`}
              </Link>
              {remembered === selected ? (
                <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-medium text-accent-hi">
                  {copy.selected}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => writeMarket(selected)}
                  className="text-faint transition hover:text-text"
                >
                  {t.remember}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Every market page as a real link. The map is the interaction; these
            are the navigation, and they work with the JavaScript switched off. */}
        <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-faint">{copy.note}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {PAGE_MARKETS.map((id) => (
              <Link
                key={id}
                href={marketHref(id)}
                onClick={() => writeMarket(id)}
                className="inline-flex items-center gap-2 text-muted transition hover:text-text"
              >
                <Flag code={MARKETS[id].flag} size={18} />
                {nameOf(id)}
              </Link>
            ))}
            <Link href="/markets" className="font-medium text-accent-hi hover:underline">
              {copy.compare}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
