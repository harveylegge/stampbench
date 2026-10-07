'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Copy } from '@/lib/copy';

/**
 * Two doors, one engine: the homepage's only argument that is shown rather
 * than asserted, and the one the visitor performs themselves.
 *
 * A business fills in a form on the left; a developer posts JSON on the right.
 * Both emit the *same* file, and that single `invoice.ubl.xml` chip is then
 * dragged, by hand, down into the engine. Everything the engine does is bound
 * to how far the file has travelled: it wakes as the document approaches,
 * reports each rule as the document passes it, and returns a verdict once the
 * document is in. Nothing is on a timer, so nothing can play out of order with
 * what the cursor is doing.
 *
 * Why a drag rather than an animation: the previous version made the same
 * points on a fixed clock, which meant the visitor watched a claim. Pulling the
 * file in yourself and seeing the rule ids fall out at the moment you pass them
 * is the difference between being told the engine is deterministic and
 * operating something deterministic. Scrubbing back up rewinds it, which is
 * itself the point: the same input gives the same result every time.
 *
 * The sequence still plays itself if nobody grabs the file within a couple of
 * seconds. An interaction the visitor never discovers is not a feature, it is
 * a diagram with a missing half, and a scroller must never be left looking at
 * an inert frame waiting for a gesture they were not told about.
 *
 * Two deliberate refusals shape the ending:
 *
 * It does **not** finish on a green tick. The arithmetic error repairs itself
 * because a VAT total has exactly one right answer; the missing buyer
 * reference is handed back, because it does not. An animation that healed both
 * would contradict "never invent compliance data": the principle this product
 * is built on and which the rest of the site states plainly.
 *
 * There is **no audience toggle** inside it. The two cards above are already
 * the audience selector, and showing both paths at once is more persuasive
 * than making someone choose before they have seen either.
 *
 * Desktop only: stacked on a phone the two doors and the rail between them
 * become a very tall diagram of a point the copy under the demo already makes
 * in a sentence, and a vertical drag on a touch screen fights the scroll.
 */

/** Cumulative milliseconds at which the two doors fill in. */
const INTRO = [200, 380, 560, 740];

/** How far, in CSS pixels, the invoice travels from its rest position into the engine. */
const TRAVEL = 116;

/** Progress (0–1) at which the engine itself lights up. */
const WAKE = 0.14;

/**
 * Progress at which each of the five checks reports, in the order the engine
 * finds them. Indices match `copy.convergence.checks`: two passes, the
 * arithmetic failure, its repair, and the one fact it will not guess.
 */
const CHECK_AT = [0.28, 0.4, 0.52, 0.68, 0.82];

/** Progress at which the verdict is returned. */
const VERDICT_AT = 0.97;

/** Released past this point, the file is delivered; short of it, it springs back. */
const COMMIT = 0.5;

/** How long the unattended run takes to pull the file in on its own. */
const AUTOPLAY_MS = 2600;

/** Grace period before the sequence gives up on being dragged and plays itself. */
const AUTOPLAY_AFTER = 2200;

/** One press of an arrow key, in progress units. */
const KEY_STEP = 0.12;

const REQUEST_LINES = [
  'POST /api/v1/generate',
  '{ "invoice": {',
  '    "buyer": { "name": "Halden…" },',
  '    "lines": [{ "netPrice": 2450,',
  '      "vat": { "rate": 20 } }]',
  '} }',
];

const FORM_VALUES = ['Halden Retail Group', 'Data platform review', '£2,450.00', '£425.00'];

const MARK: Record<string, { glyph: string; tone: string }> = {
  ok: { glyph: '✓', tone: 'text-success' },
  bad: { glyph: '✕', tone: 'text-danger' },
  fixed: { glyph: '→', tone: 'text-success' },
  kept: { glyph: '⚠', tone: 'text-warning' },
};

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Fade-and-rise, driven entirely by whether the beat has landed. */
function reveal(on: boolean): string {
  return `transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
    on ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
  }`;
}

export function Convergence({ copy }: { copy: Copy }) {
  const t = copy.convergence;
  const [intro, setIntro] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** Whether a person has taken hold of the file: suppresses the self-run. */
  const [taken, setTaken] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const frame = useRef(0);
  const grab = useRef<{ y: number; from: number } | null>(null);
  const takenRef = useRef(false);
  // The pointer handlers and the tween both need the live value, and neither
  // can read it from React state without being a frame behind the cursor.
  const value = useRef(0);

  const set = useCallback((next: number) => {
    value.current = next;
    setProgress(next);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  /** Ease the file to a resting point: the end of a drag, or the self-run. */
  const glide = useCallback(
    (to: number, ms: number) => {
      cancelAnimationFrame(frame.current);
      const from = value.current;
      if (from === to) return;
      const started = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - started) / ms);
        set(from + (to - from) * (1 - (1 - k) ** 3));
        if (k < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [set],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Reduced motion gets the finished diagram, immediately. Someone who has
    // asked the OS for less movement has not asked for a faster version of the
    // movement: they have asked to read the result. The file stays draggable:
    // a drag is a gesture the visitor chose to make, not motion done at them.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setIntro(INTRO.length - 1);
      set(1);
      return;
    }

    const play = () => {
      stop();
      setIntro(-1);
      INTRO.forEach((at, index) => {
        timers.current.push(window.setTimeout(() => setIntro(index), at));
      });
      // The file only pulls itself in if it was left alone. Anyone who has
      // touched it owns the sequence from then on.
      timers.current.push(
        window.setTimeout(() => {
          if (!takenRef.current) glide(1, AUTOPLAY_MS);
        }, INTRO[INTRO.length - 1]! + AUTOPLAY_AFTER),
      );
    };

    // Play on arrival, not on mount: below the fold it would be over before
    // anyone saw it.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(host);

    return () => {
      observer.disconnect();
      stop();
    };
  }, [glide, set, stop]);

  const take = () => {
    takenRef.current = true;
    setTaken(true);
    stop();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    // Left button only: a right-click that started a drag would leave the file
    // stuck to the cursor behind the context menu.
    if (event.button !== 0) return;
    take();
    setDragging(true);
    grab.current = { y: event.clientY, from: value.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const held = grab.current;
    if (!held) return;
    set(clamp(held.from + (event.clientY - held.y) / TRAVEL));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!grab.current) return;
    grab.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    const at = value.current;
    // Past halfway the engine takes it; short of that it returns to the top,
    // which is the honest outcome: a document that never went in has no
    // verdict, and inventing one here would be the same lie the engine refuses
    // to tell about a missing buyer reference.
    glide(at >= COMMIT ? 1 : 0, at >= COMMIT ? 420 : 280);
  };

  /** The same gesture from the keyboard: step it down, or send it all the way. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;
    if (key === 'ArrowDown' || key === 'ArrowRight') {
      event.preventDefault();
      take();
      set(clamp(value.current + KEY_STEP));
    } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
      event.preventDefault();
      take();
      set(clamp(value.current - KEY_STEP));
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      take();
      glide(value.current >= 1 ? 0 : 1, 1400);
    }
  };

  const on = (at: number) => progress >= at;
  const delivered = progress >= 1;
  const held = dragging || (taken && progress > 0 && progress < 1);

  return (
    /* Hidden below `lg` on purpose: see the note at the top of the file. */
    <div ref={hostRef} className="mx-auto hidden max-w-4xl px-4 lg:block">
      {/* The sequence is a picture with a control in it, so the description
          lives here as text rather than as a label on a role="img" wrapper:
          that would have swallowed the button along with the diagram. Every
          purely decorative block below is hidden individually instead. */}
      <p className="sr-only">{t.summary}</p>

      <div className="grid grid-cols-2 gap-8" aria-hidden>
        <Door title={t.business} icon="🧾">
          {t.form.map((label, index) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b border-dashed border-border py-1 text-xs last:border-0"
            >
              <span className="whitespace-nowrap text-faint">{label}</span>
              <span className={`text-right tabular-nums ${reveal(intro >= index)}`}>
                {FORM_VALUES[index]}
              </span>
            </div>
          ))}
        </Door>

        <Door title={t.developer} icon="💻">
          <pre className="overflow-x-auto font-mono text-[0.68rem] leading-[1.75] text-muted">
            {REQUEST_LINES.map((line, index) => (
              <span key={line} className={`block ${reveal(intro >= Math.min(index, 3))}`}>
                {index === 0 ? (
                  <>
                    <span className="font-semibold text-accent-hi">POST</span>
                    {line.slice(4)}
                  </>
                ) : (
                  line
                )}
              </span>
            ))}
          </pre>
        </Door>
      </div>

      {/* The same file from both doors, said twice because that repetition is
          the argument, not an oversight: and then converging into the one
          copy the visitor actually handles. */}
      <div className="grid grid-cols-2 gap-8" aria-hidden>
        {['l', 'r'].map((side) => (
          <div key={side} className="flex justify-center">
            <span
              className={`mt-2.5 rounded bg-accent-dim px-2 py-0.5 font-mono text-[0.62rem] text-accent-hi ${reveal(
                intro >= 3,
              )}`}
            >
              invoice.ubl.xml
            </span>
          </div>
        ))}
      </div>

      {/* Plumbing: a drop from each door, then a rail inward to the middle. */}
      <div className="relative mx-auto h-10" aria-hidden>
        <Line className="left-1/4 top-0 h-6 w-0.5 origin-top" grow="y" on={intro >= 3} />
        <Line className="left-3/4 top-0 h-6 w-0.5 origin-top" grow="y" on={intro >= 3} />
        <Line className="left-1/4 top-6 h-0.5 w-1/4 origin-left" grow="x" on={intro >= 3} />
        <Line className="left-1/2 top-6 h-0.5 w-1/4 origin-right" grow="x" on={intro >= 3} />
      </div>

      {/* The rail. The file rests at the top of it and is dragged the length of
          it into the engine's mouth. */}
      <div className="relative mx-auto" style={{ height: TRAVEL + 34 }}>
        {/* The track the file runs down, and the part of it already covered. */}
        <span
          aria-hidden
          className="absolute left-1/2 top-3 w-0 border-l border-dashed border-border"
          style={{ height: TRAVEL + 22 }}
        />
        <span
          aria-hidden
          className="absolute left-1/2 top-3 w-0.5 -translate-x-1/2 rounded bg-accent/50"
          style={{ height: Math.max(0, progress * (TRAVEL + 22)) }}
        />

        {/* The horizontal centring is folded into the same inline transform as
            the travel: Tailwind's translate utilities write the `translate`
            property in v4, and combining that with an inline `transform` here
            would shift the file left twice. */}
        <div
          className="absolute left-1/2 top-0"
          style={{
            transform: `translate(-50%, ${progress * TRAVEL}px)`,
            // Only smooth the settle. During a drag the transform must track
            // the cursor exactly or the file lags behind the hand holding it.
            transition: dragging ? 'none' : 'opacity 200ms ease-out',
          }}
        >
          <button
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            aria-label={t.grab}
            className={`flex touch-none select-none items-center gap-2 rounded-lg border bg-surface px-3 py-1.5 font-mono text-[0.68rem] shadow-sm outline-none transition-[border-color,box-shadow,opacity,scale] focus-visible:ring-2 focus-visible:ring-accent/50 ${
              delivered
                ? 'pointer-events-none scale-90 border-border opacity-0'
                : held
                  ? 'scale-105 cursor-grabbing border-accent shadow-md shadow-accent/20'
                  : 'cursor-grab border-accent/40 hover:border-accent hover:shadow-md'
            } ${!taken && !delivered ? 'sb-nudge' : ''}`}
          >
            <span aria-hidden className="text-[0.8rem] leading-none">
              📄
            </span>
            <span className="text-accent-hi">invoice.ubl.xml</span>
            <span aria-hidden className="text-faint">
              ⇕
            </span>
          </button>

          {/* The instruction, beside the file rather than under the section:
              it has to be next to the thing it refers to, and it has to leave
              the moment it has been obeyed. */}
          <span
            aria-hidden
            className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap text-[0.7rem] text-faint transition-opacity duration-300 ${
              taken || progress > 0.02 ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {t.grab} ↓
          </span>
        </div>
      </div>

      <div
        aria-hidden
        className={`mx-auto max-w-md overflow-hidden rounded-xl border bg-surface transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none ${
          on(WAKE) ? 'border-accent/45 shadow-lg shadow-accent/10' : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-3.5 py-2">
          <span className="text-[0.82rem] font-semibold tracking-tight">{t.engineName}</span>
          <span className="font-mono text-[0.62rem] text-faint">{t.ruleset}</span>
        </div>
        <div className="flex flex-col gap-1 px-3.5 py-2.5">
          {t.checks.map((check, index) => {
            const mark = MARK[check.kind]!;
            const reported = on(CHECK_AT[index]!);
            return (
              <div key={check.rule + check.label} className="relative h-[1.35rem]">
                {/* A ruled line where the finding will be. The panel reserves
                    its full height from the start so nothing below it jumps,
                    and an empty box that size reads as broken rather than as
                    waiting: the rules are known before the document arrives,
                    only the answers are not. */}
                <span
                  className={`absolute left-6 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-border transition-opacity duration-200 ${
                    reported ? 'opacity-0' : 'opacity-100'
                  }`}
                  style={{ width: `${44 + index * 4}%` }}
                />
                <div
                  className={`flex items-baseline gap-2 text-[0.78rem] ${reveal(reported)}`}
                >
                  <span className={`w-4 shrink-0 font-mono text-[0.72rem] ${mark.tone}`}>
                    {mark.glyph}
                  </span>
                  <span className={check.kind === 'bad' ? 'text-danger' : 'text-muted'}>
                    {check.label}
                  </span>
                  <span className="font-mono text-[0.65rem] text-faint">{check.rule}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative mx-auto h-6" aria-hidden>
        <Line className="left-1/2 top-0 h-6 w-0.5 origin-top" grow="y" on={on(VERDICT_AT)} />
      </div>

      <div
        aria-hidden
        className={`mx-auto max-w-lg rounded-xl border bg-surface px-4 py-3 text-center ${reveal(
          on(VERDICT_AT),
        )} ${on(VERDICT_AT) ? 'border-success/40' : 'border-border'}`}
      >
        <div className="text-[0.92rem] font-semibold tracking-tight">{t.verdictTitle}</div>
        <div className="mt-0.5 text-[0.78rem] text-muted">{t.verdictSub}</div>
      </div>

      {/* Re-running it is the demonstration, not a convenience: the same file
          through the same rules gives the same five lines every time. */}
      <div className="mt-3 flex h-6 justify-center">
        <button
          type="button"
          onClick={() => {
            take();
            glide(0, 260);
          }}
          className={`text-[0.72rem] text-faint underline-offset-2 transition-opacity duration-300 hover:text-muted hover:underline ${
            delivered ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          tabIndex={delivered ? 0 : -1}
        >
          {t.again}
        </button>
      </div>
    </div>
  );
}

function Door({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-1.5 text-[0.8rem] font-medium">
        <span>{icon}</span>
        {title}
      </div>
      <div className="min-h-[7.5rem] p-3">{children}</div>
    </div>
  );
}

/** One connector segment, drawn by scaling from its origin edge. */
function Line({
  className,
  grow,
  on,
}: {
  className: string;
  grow: 'x' | 'y';
  on: boolean;
}) {
  const scale = grow === 'y' ? (on ? 'scale-y-100' : 'scale-y-0') : on ? 'scale-x-100' : 'scale-x-0';
  return (
    <span
      className={`absolute bg-border-hi transition-transform duration-[400ms] ease-out motion-reduce:transition-none ${className} ${scale}`}
    />
  );
}
