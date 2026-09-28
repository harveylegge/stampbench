import Link from 'next/link';
import { localePath, type Copy, type PathCopy } from '@/lib/copy';
import { Convergence } from '@/components/convergence';
import { MarketMap } from '@/components/market-map';
import { ProductShowcase } from '@/components/showcase';
import { StatsBoard } from '@/components/stats-board';

/**
 * The marketing landing page, rendered from a copy dictionary so English and
 * German share one layout.
 *
 * Structure (2026-08 audience pass): Stampbench serves two audiences whose
 * needs are opposite — a freelancer who wants an invoice, and an engineer who
 * wants e-invoicing infrastructure. The previous page tried to speak to both
 * at once, which meant naming EN 16931, UBL and CII above the fold and asking
 * a plumber to care. So the page now asks *which visitor are you* before it
 * says anything else, and each door leads somewhere written entirely in that
 * audience's language.
 *
 * What is deliberately NOT here any more: the CLI transcripts, the
 * official-validator comparison, the three engineering pillars and the
 * local-first pitch. None of it was removed — all of it moved to /developers,
 * where it is the whole page instead of half a homepage. A business visitor
 * should never have to scroll past a terminal to reach an invoice.
 *
 * What stays: the evidence. For a compliance product the evidence *is* the
 * pitch, and it is the one section both audiences read.
 */
export function Landing({ copy }: { copy: Copy }) {
  const path = (p: string) => localePath(copy.locale, p);

  return (
    <div lang={copy.locale}>
      {/* Hero. Deliberately short: its whole job is to say what this is and
          hand the visitor to the right door. Nothing to read past.
          The vertical rhythm is measured in vh rather than fixed rems, so the
          whole stack above the demo compresses on a short laptop and breathes
          on a big monitor. That is what lets the top of the demo panel sit
          just under the fold on most screens without anything being resized —
          the spacing adapts instead of the content. */}
      <section className="hero-glow relative">
        <div className="sb-rise relative mx-auto max-w-5xl px-4 pb-[clamp(0.75rem,2vh,2.5rem)] pt-[clamp(1.5rem,5vh,5rem)] text-center">
          <Link
            href="/markets"
            className="mb-[clamp(0.75rem,2vh,1.5rem)] inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-muted transition hover:border-border-hi hover:text-text"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            {copy.hero.badge}
            <span aria-hidden>→</span>
          </Link>

          {/* The desktop size is capped by viewport height as well as width:
              min() keeps 5rem on anything from a laptop upwards and only
              steps down on genuinely short windows, where two stacked lines
              of 80px headline would own half the screen. The stacked spans
              are deliberate — at this size the accent phrase is a line, not
              a word, and letting it break mid-phrase reads as an accident. */}
          <h1 className="mb-[clamp(0.75rem,1.6vh,1.25rem)] text-[2rem] font-[650] leading-[1.05] tracking-[-0.03em] sm:text-6xl md:text-[min(5rem,9vh)]">
            <span className="block">{copy.hero.titleTop}</span>
            <span className="block text-accent">{copy.hero.titleAccent}</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted">{copy.hero.lede}</p>
        </div>

        {/* The two doors. Equal weight, side by side: making one of them the
            primary button would be the site guessing, and it guesses wrong for
            half of its visitors. */}
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="sr-only">{copy.paths.eyebrow}</h2>
          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            <PathCard path={copy.paths.business} tone="business" />
            <PathCard path={copy.paths.developer} tone="developer" />
          </div>
        </div>
      </section>

      {/* One engine, shown rather than asserted. The tabbed demo is the whole
          product loop — make it, check it, fix it, automate it — and it is the
          honest answer to "are these two products or one?".
          It sits directly under the two doors on purpose, with only a single
          line of framing above it: the page used to make this same point four
          times over (a note under the cards, an eyebrow, a heading and a
          paragraph) which cost ~250px and pushed the demo entirely below the
          fold. The explanation is not lost — it moved underneath the panel,
          where it reads as a caption to something already seen. */}
      <section className="pb-16 pt-[clamp(0.75rem,2.5vh,2rem)]">
        <div className="mx-auto mb-[clamp(0.75rem,2vh,1.5rem)] max-w-6xl px-4">
          <h2 className="max-w-3xl text-2xl font-semibold tracking-tight">
            {copy.engine.heading}
          </h2>
        </div>


        {/* The bench. The product demo sits on a photographed stamp bench —
            oak, papers, purple ink pad — instead of an abstract backdrop. It
            is the one image on the page and it is literally the brand name. */}
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative cover photo; static export serves it as-is */}
            <img
              src="/brand/stampbench-bench.webp"
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="relative px-2 py-8 sm:px-8 sm:py-12">
              <ProductShowcase copy={copy} />
            </div>
          </div>
        </div>

        {/* The caption: what the panel above just showed, why it is one
            engine, and the plain-English primer for anyone who still does not
            know what an e-invoice is. All of it is reading matter, and reading
            matter belongs after the thing it describes. */}
        <div className="mx-auto mt-6 grid max-w-6xl gap-x-10 gap-y-3 px-4 lg:grid-cols-2">
          <p className="leading-relaxed text-muted">{copy.engine.body}</p>
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-faint">{copy.hero.primer}</p>
            <p className="text-sm leading-relaxed text-faint">{copy.paths.note}</p>
          </div>
        </div>

        {/* The proof of the heading at the top of this section.
            It sits *below* the demo rather than above it for two reasons: the
            bench panel earns the fold, and this sequence plays on arrival — a
            visitor scrolling to it should meet it whole, not find a half-empty
            frame peeking over the fold waiting for a threshold to trip. */}
        <div className="mt-14">
          <Convergence copy={copy} />
        </div>
      </section>

      {/* Trust bar — formats and licence, not certifications. Each acronym
          carries its gloss: an initialism with no gloss is a wall to the
          audience that most needs reassuring. It now sits below the demo
          rather than above it, where it also does the job of separating the
          product from the market question that follows. */}
      <div className="border-y border-border bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-center gap-x-8 gap-y-4 px-4 py-5 text-center">
          {copy.trustbar.map((t) => (
            <span key={t.term} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium tracking-wide text-muted">{t.term}</span>
              <span className="text-[11px] leading-tight text-faint">{t.gloss}</span>
            </span>
          ))}
        </div>
      </div>

      {/* The market question. Both audiences ask it, and the honest answer
          ("here is where we have nothing for you") belongs high, not buried —
          which is why it is now answered on the page rather than behind a
          click through to a market page. */}
      <MarketMap copy={copy.markets} />

      {/* Proof — for a compliance product, evidence IS the pitch */}
      <section className="border-t border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">{copy.proof.heading}</h2>
          <p className="mb-10 max-w-2xl leading-relaxed text-muted">{copy.proof.body}</p>
          <StatsBoard copy={copy} />
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/trust"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition hover:border-border-hi"
            >
              {copy.proof.evidence}
            </Link>
            <Link
              href="/security"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition hover:border-border-hi"
            >
              {copy.proof.security}
            </Link>
            <span className="text-sm text-faint">{copy.proof.note}</span>
          </div>
        </div>
      </section>

      {/* Both doors again at the foot: a visitor who read the whole page
          should not have to scroll back up to act. */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="mb-3 text-3xl font-semibold tracking-tight">{copy.cta.heading}</h2>
          <p className="mx-auto mb-8 max-w-md text-muted">{copy.cta.body}</p>
          <div className="mx-auto flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/invoice-generator"
              className="sb-press rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:bg-accent-hi"
            >
              {copy.hero.ctaCreate}
            </Link>
            <Link
              href="/developers"
              className="sb-press rounded-lg border border-border bg-surface px-6 py-3 font-medium transition hover:border-border-hi"
            >
              {copy.nav.devPlatform}
            </Link>
          </div>
          <p className="mt-5 text-sm text-faint">
            <Link href={path('playground')} className="text-accent-hi hover:underline">
              {copy.cta.button}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * One audience door.
 *
 * The whole card is the link rather than a card containing a button: on a
 * touch screen the button is a 44px target inside a 300px card, and every
 * mis-tap lands on dead space. The inner span still *looks* like the action so
 * the affordance is not lost.
 */
function PathCard({ path, tone }: { path: PathCopy; tone: 'business' | 'developer' }) {
  const accent = tone === 'business' ? 'hover:border-accent/50' : 'hover:border-border-hi';
  return (
    <Link
      href={path.href}
      className={`sb-press group flex flex-col rounded-2xl border border-border bg-surface p-[clamp(1.15rem,2.6vh,1.75rem)] text-left transition hover:bg-surface-2 ${accent}`}
    >
      <div className="mb-[clamp(0.5rem,1.4vh,0.75rem)] flex items-center gap-2.5">
        <span aria-hidden className="text-2xl leading-none">
          {path.icon}
        </span>
        <h3 className="text-xl font-semibold tracking-tight">{path.title}</h3>
      </div>

      <p className="mb-[clamp(0.75rem,2vh,1.25rem)] leading-relaxed text-muted">{path.body}</p>

      <ul className="mb-[clamp(0.85rem,2.2vh,1.5rem)] flex flex-col gap-[clamp(0.35rem,1vh,0.5rem)] text-sm text-muted">
        {path.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2.5">
            <span aria-hidden className="mt-[0.15rem] text-accent">
              ✓
            </span>
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <span className="inline-block font-medium text-accent-hi transition group-hover:underline">
          {path.cta}
        </span>
        <p className="mt-2 text-xs leading-relaxed text-faint">{path.sub}</p>
      </div>
    </Link>
  );
}
