/**
 * Site copy in English and German.
 *
 * The two dictionaries are not translations of one another, and that is
 * deliberate. English is the global front door: a visitor arriving there could
 * be billing from Leeds, Austin or Lyon, and the page has to earn the right to
 * mention a jurisdiction before it names one. `/de` is the German-language
 * page — a German reader who searched for "XRechnung prüfen" has already told
 * us their market, so that page stays specific, and the German SEO that
 * actually brings traffic is left intact.
 *
 * The layout is shared, so the difference lives entirely in these strings.
 * Rule ids, CLI flags and field names stay untranslated in both: a developer
 * comparing the page to their terminal should see the same strings.
 */
import type { MarketId } from './markets';

export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

/** URL prefix for a locale. English is at the root; German under /de. */
export function localePath(locale: Locale, path = ''): string {
  const clean = path.replace(/^\/+/, '');
  const base = locale === 'en' ? '' : '/de';
  return `${base}/${clean}`.replace(/\/+$/, '') || '/';
}

/** The pages that exist in both languages. Everything else stays English. */
export const TRANSLATED_PATHS = ['', 'playground'] as const;

/**
 * Copy for the homepage market band. Shaped here rather than in the component
 * so both languages are forced to fill it in.
 */
/** One of the two audience doors on the homepage. */
export interface PathCopy {
  /** Rendered as a decorative glyph next to the title. */
  icon: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  /** Who this door is for, in one line. */
  sub: string;
  /** Four concrete things behind the door. */
  bullets: [string, string, string, string];
}

export interface MarketsCopy {
  eyebrow: string;
  heading: string;
  body: string;
  note: string;
  compare: string;
  germanyLink: string;
  selected: string;
  change: string;
  cards: { id: MarketId; name: string; tagline: string }[];
  /**
   * The summary beside the map. Only the labels and the market-dependent
   * phrases live here — every *fact* is read out of lib/markets.ts, so a
   * translation cannot quietly claim coverage the engine does not have.
   */
  panel: {
    /** Told to someone looking at a map who has not realised it is clickable. */
    hint: string;
    /** The one choice with no place on a map. */
    several: string;
    /** Link into the market's own page. `{market}` is the market name. */
    everything: string;
    /** Stores the choice for the playground and the generator. */
    remember: string;
    /** Row labels, in display order. */
    european: string;
    syntaxes: string;
    national: string;
    germanBuyers: string;
    taxRate: string;
    network: string;
    /** Values for the two rows that differ by market. */
    nationalGermanyOnly: string;
    nationalNone: string;
    germanSwitch: string;
    /** Values for the two rows that read the same everywhere, because they do. */
    taxRateValue: string;
    networkValue: string;
    /** Pluralised unit for the rule counts, e.g. "40 rules". */
    rules: string;
  };
}

export interface Copy {
  locale: Locale;
  nav: {
    create: string;
    invoices: string;
    markets: string;
    playground: string;
    docs: string;
    pricing: string;
    trust: string;
    github: string;
    signIn: string;
    account: string;
    /** Accessible name for the mobile hamburger button. */
    menu: string;
    cta: string;
    /** Menu group labels — the two audiences, then everything shared. */
    business: string;
    developers: string;
    company: string;
    /** The developer landing page. */
    devPlatform: string;
    /** The free roast page — marketing that lives in the Business menu. */
    roast: string;
    roastSub: string;
    /** One-line descriptions under each grouped link. */
    createSub: string;
    invoicesSub: string;
    devPlatformSub: string;
    playgroundSub: string;
    docsSub: string;
    marketsSub: string;
  };
  hero: {
    badge: string;
    titleTop: string;
    titleAccent: string;
    lede: string;
    /** One sentence saying what an e-invoice actually is. */
    primer: string;
    /** Leads the hero: the generator. */
    ctaCreate: string;
    /** The validator — the older, deeper capability. */
    ctaPrimary: string;
    /** Scrolls to the market band; a text link, not a button. */
    ctaSecondary: string;
    /** Under the buttons: the three things a first-time visitor worries about. */
    reassurance: string;
    /** What pressing the create button actually produces. */
    ctaCreateSub: string;
  };
  /**
   * The two doors. A visitor's first decision on this page is not "which
   * feature?" but "which of these two products am I here for?", and the page
   * answers that before it names a single standard.
   */
  paths: {
    eyebrow: string;
    business: PathCopy;
    developer: PathCopy;
    /** Reassures the undecided; neither door is a commitment. */
    note: string;
  };
  /** One engine under both doors — stated once, then demonstrated. */
  engine: { eyebrow: string; heading: string; body: string };
  /**
   * The convergence animation: two doors handing the same document to one
   * engine. The checks are the site's standing worked example, and the last
   * two are load-bearing — an arithmetic error that repairs itself and a
   * business fact that does not. An animation that resolved everything to a
   * green tick would contradict the product's central promise.
   */
  convergence: {
    business: string;
    developer: string;
    /** Field labels down the business side. */
    form: [string, string, string, string];
    engineName: string;
    ruleset: string;
    checks: { kind: 'ok' | 'bad' | 'fixed' | 'kept'; label: string; rule: string }[];
    verdictTitle: string;
    verdictSub: string;
    /** Label on the draggable file, and the hint printed beside it. */
    grab: string;
    /** Sends the same file through the same rules again. */
    again: string;
    /** Screen-reader summary, since the sequence itself is decorative. */
    summary: string;
  };
  /** The "where does your business operate?" band under the hero. */
  markets: MarketsCopy;
  /**
   * The tabbed product showcase under the hero. Its four tabs are the product
   * loop in plain verbs — make it, check it, fix it, automate it — because a
   * visitor arriving from an advert has to see what the thing does before any
   * standard is worth naming.
   */
  showcase: {
    label: string;
    caption: string;
    captionLink: string;
    tabs: { id: 'create' | 'check' | 'fix' | 'automate'; label: string }[];
    create: {
      title: string;
      seller: string;
      sellerCity: string;
      colItem: string;
      colQty: string;
      colAmount: string;
      lines: { name: string; qty: string; amount: string }[];
      subtotal: string;
      vat: string;
      total: string;
    };
    check: {
      verdict: string;
      /** The transient state the verdict animates out of, on desktop. */
      checking: string;
      rulesetLine: string;
      problems: { title: string; rule: string; detail: string }[];
      footnote: string;
    };
    fix: { verdict: string; keptTitle: string; keptDetail: string };
    automate: { snippet: string; points: { title: string; detail: string }[] };
  };
  /**
   * Format/standard chips under the hero — facts only, no certifications.
   * Each carries a gloss, because six bare acronyms sit exactly where a
   * first-time visitor decides whether to keep scrolling.
   */
  trustbar: { term: string; gloss: string }[];
  problem: {
    headingPre: string;
    /** The rule id in the heading — a core rule in English, BR-DE in German. */
    rule: string;
    headingPost: string;
    body: string;
  };
  /** Official-validator output vs Stampbench, side by side. */
  compare: {
    officialTitle: string;
    officialBody: string;
    oursTitle: string;
    oursExplain: string;
    oursFix: string;
  };
  /** The product principle, displayed as a standalone statement. */
  principle: { title: string; body: string };
  /** Three product pillars, each expandable into its two detail cards. */
  pillars: {
    num: string;
    title: string;
    tagline: string;
    details: string;
    items: { title: string; body: string }[];
  }[];
  api: { heading: string; body: string; note: string };
  local: { heading: string; body: string; steps: [string, string, string] };
  proof: {
    heading: string;
    body: string;
    evidence: string;
    security: string;
    note: string;
  };
  statsBoard: {
    tests: { label: string; sub: string; failing: string };
    docs: { label: string; sub: string };
    rules: { label: string; families: [string, string, string]; subtotal: string };
    located: { label: string; subLead: string; subDetail: string };
    growth: { label: string; sub: string; series: [string, string] };
  };
  model: {
    heading: string;
    freeTitle: string;
    freeBody: string;
    freeItems: string[];
    paidTitle: string;
    paidBody: string;
    paidItems: string[];
    pricing: string;
  };
  cta: { heading: string; body: string; button: string; install: string };
  footer: {
    blurb: string;
    founded: string;
    product: string;
    openSource: string;
    trust: string;
    legal: string;
    rules: string;
    evidence: string;
    security: string;
    terms: string;
    privacy: string;
    rights: string;
  };
  playground: {
    title: string;
    intro: string;
    metaTitle: string;
    metaDescription: string;
  };
  /** The floating site-wide assistant widget (components/assistant-widget.tsx). */
  assistant: {
    title: string;
    open: string;
    close: string;
    placeholder: string;
    send: string;
    thinking: string;
    /** The assistant's own first message when a paid user opens a fresh chat. */
    greeting: string;
    signedOutBody: string;
    signIn: string;
    lockedBody: string;
    seePricing: string;
    disabledBody: string;
    quotaBody: string;
    poolBody: string;
    errorBody: string;
    /** Under the input: what the assistant is and is not. */
    scope: string;
  };
  meta: { title: string; description: string };
}

export const en: Copy = {
  locale: 'en',
  nav: {
    create: 'Create invoice',
    invoices: 'My invoices',
    markets: 'Markets',
    playground: 'Validate',
    docs: 'Docs',
    pricing: 'Pricing',
    trust: 'Trust',
    github: 'GitHub',
    signIn: 'Sign in',
    account: 'Account',
    menu: 'Menu',
    cta: 'Create invoice',
    business: 'Business',
    developers: 'Developers',
    company: 'Company',
    devPlatform: 'Developer platform',
    roast: 'Roast my invoice',
    roastSub: 'A brutally honest, free invoice check',
    createSub: 'Fill in a form, get a compliant invoice',
    invoicesSub: 'Your invoices, payment status and repeats',
    devPlatformSub: 'Engine, API and tooling overview',
    playgroundSub: 'Validate and generate in the browser',
    docsSub: 'API reference, library and CLI',
    marketsSub: 'What is supported, country by country',
  },
  hero: {
    badge: 'Germany: receiving is already law, issuing from 2027',
    titleTop: 'E-invoicing,',
    titleAccent: 'without the complexity.',
    lede:
      'Create compliant invoices as a business, or build e-invoicing directly into your software with Stampbench’s developer platform.',
    ctaCreate: 'Create invoice',
    primer: 'New to this? An e-invoice is invoice data written in a fixed format, so your customer’s software can read it field by field instead of someone retyping it. If that sentence is not something you want to think about, take the first door — Stampbench handles it.',
    ctaPrimary: 'Validate an invoice',
    ctaSecondary: 'Choose your market',
    reassurance: 'Free to try · No account needed · Runs in your browser, nothing to install',
    ctaCreateSub: 'Fill in a form — get the XML file your customer’s system needs, plus a printable copy.',
  },
  paths: {
    eyebrow: 'Two ways in',
    business: {
      icon: '🧾',
      title: 'I’m a business',
      body: 'Create and manage compliant invoices without needing to understand e-invoicing standards.',
      cta: 'Create an invoice →',
      href: '/invoice-generator',
      sub: 'For freelancers, small businesses and teams.',
      bullets: [
        'Fill in a form — no file formats to choose',
        'Checked automatically before you download',
        'Printable PDF and the file your customer’s system reads',
        // "Prepared" is the honest verb: recurring v1 readies the invoice and
        // asks; nothing issues itself unattended. See lib/invoice/recurring.ts.
        'Tracks who has paid — and repeat invoices come prepared on schedule',
      ],
    },
    developer: {
      icon: '💻',
      title: 'I’m a developer',
      body: 'Validate and generate compliant e-invoices using Stampbench’s TypeScript engine, API and developer tooling.',
      cta: 'Explore the developer platform →',
      href: '/developers',
      sub: 'XRechnung · EN 16931 · UBL · CII · API',
      bullets: [
        'Deterministic, rules-based validation with rule ids',
        'Every violation carries a source location',
        'Generate as well as validate — totals computed by construction',
        'Local library, CLI and a hosted REST API',
      ],
    },
    note: 'Same engine behind both. You can switch at any time, and neither door needs an account.',
  },
  engine: {
    eyebrow: 'One engine',
    heading: 'Both doors open onto the same compliance engine.',
    body:
      'A business fills in a form; a developer calls an API. Underneath, the same rules run, the same arithmetic is computed and the same verdict is produced — which is why the simple experience is not a simplified one.',
  },
  convergence: {
    business: 'A business fills in a form',
    developer: 'A developer calls the API',
    form: ['Customer', 'Item', 'Net', 'VAT 20%'],
    engineName: 'Stampbench compliance engine',
    ruleset: 'EN 16931 · 40 rules',
    checks: [
      { kind: 'ok', label: 'Totals add up', rule: 'BR-CO-10' },
      { kind: 'ok', label: 'Buyer country present', rule: 'BR-11' },
      { kind: 'bad', label: 'VAT does not match the rate', rule: 'BR-CO-17' },
      { kind: 'fixed', label: 'Repaired: £425.00 → £490.00', rule: 'derivable' },
      { kind: 'kept', label: 'Buyer reference missing — left for you', rule: 'BT-10' },
    ],
    verdictTitle: 'Same engine, same answer — whichever door you came through',
    verdictSub: '1 repaired automatically · 1 needs a person · nothing invented',
    grab: 'Drag the invoice into the engine',
    again: 'Send it through again',
    summary:
      'A business filling in a form and a developer calling the API both produce the same invoice file, which the same Stampbench engine checks: it repairs the VAT arithmetic it can derive and hands back the missing buyer reference for a person to decide.',
  },
  markets: {
    eyebrow: 'Choose your market',
    heading: 'Where does your business operate?',
    body:
      'Invoice rules are set per jurisdiction, so the honest answer to "does this work for me?" depends on where you bill. Pick your primary market and Stampbench will show you the rules that apply — and say plainly where it has nothing for you yet.',
    note: 'You can change this at any time, and you do not need an account.',
    compare: 'Compare every market',
    germanyLink: 'Straight to XRechnung',
    selected: 'Your market',
    change: 'What works here',
    cards: [
      { id: 'uk', name: 'United Kingdom', tagline: 'Checked against the European standard your EU customers ask for. The UK has no separate ruleset of its own — we will say so if that changes.' },
      { id: 'us', name: 'United States', tagline: 'Structured invoicing for billing into Europe. No US tax logic.' },
      { id: 'eu', name: 'European Union', tagline: 'The European core in full, plus Germany’s national profile.' },
      { id: 'germany', name: 'Germany', tagline: 'The deepest coverage in the product — XRechnung 3.0 and ZUGFeRD, with the failing line pointed at.' },
      { id: 'multi', name: 'Several markets', tagline: 'See the whole coverage matrix side by side, gaps included.' },
    ],
    panel: {
      hint: 'Click a region.',
      several: 'Several markets',
      // Not "Everything about {market}": the names go in bare, and English
      // wants an article for three of the five ("about the European Union")
      // but not for Germany. A trailing phrase sidesteps it entirely.
      everything: '{market} in detail',
      remember: 'Remember this choice',
      european: 'European standard',
      syntaxes: 'Both XML syntaxes',
      national: 'National ruleset',
      germanBuyers: 'German public buyers',
      taxRate: 'Which tax rate applies',
      network: 'Sending over a network',
      nationalGermanyOnly: 'Germany only — the rest use the European core',
      nationalNone: 'None published for this market',
      germanSwitch: 'Switch the market to Germany for all {count} rules',
      taxRateValue: 'Stampbench does not decide this',
      networkValue: 'No Peppol or exchange delivery',
      rules: 'rules',
    },
  },
  showcase: {
    label: 'What Stampbench does',
    caption: 'This is the whole flow.',
    captionLink: 'Try it free — no account →',
    tabs: [
      { id: 'create', label: 'Make an invoice' },
      { id: 'check', label: 'Check it' },
      { id: 'fix', label: 'Fix it' },
      { id: 'automate', label: 'Automate it' },
    ],
    create: {
      title: 'INVOICE',
      seller: 'Thornbury Design Ltd',
      sellerCity: 'London, United Kingdom',
      colItem: 'Item',
      colQty: 'Qty',
      colAmount: 'Amount',
      lines: [
        { name: 'Brand identity design', qty: '1', amount: '£1,800.00' },
        { name: 'Consultancy — 8 hrs', qty: '8', amount: '£600.00' },
        { name: 'Stock photography licence', qty: '1', amount: '£50.00' },
      ],
      subtotal: 'Subtotal',
      vat: 'VAT 20%',
      total: 'Total',
    },
    check: {
      verdict: '2 problems found',
      checking: 'Checking…',
      rulesetLine: 'Checked against EN 16931 · 40 rules',
      problems: [
        {
          title: 'The VAT does not add up',
          rule: 'BR-CO-17',
          detail: '20% of £2,450.00 is £490.00, but the invoice says £425.00.',
        },
        {
          title: 'Your customer’s country is missing',
          rule: 'BR-11',
          detail: 'Without it the tax treatment cannot be checked — and it is not something we will guess.',
        },
      ],
      footnote: 'Every problem names the rule that caught it and the line it is on.',
    },
    fix: {
      verdict: '1 fixed automatically',
      keptTitle: '1 left for you',
      keptDetail:
        'The VAT had exactly one right answer, so it was corrected. Your customer’s country does not — inventing it would turn a broken invoice into a quietly wrong one.',
    },
    automate: {
      snippet: `$ npx stampbench validate invoice.xml

invoice.xml  syntax: UBL | profile: en16931 | ruleset: 2026-08.2
  ERROR  BR-CO-17  VAT breakdown S @ 20%: tax amount should be
         490.00 (2450.00 × 20%) but is 425.00. (line 78)
INVALID — 1 error, 0 warnings (40 rules run)`,
      points: [
        { title: 'Run it in CI', detail: 'Fails the build before a bad invoice ever reaches a customer.' },
        { title: 'Or call the API', detail: 'One request, same answer, from any language.' },
        { title: 'Free on your machine', detail: 'The engine is an open-source npm package. No account, no upload.' },
      ],
    },
  },
  trustbar: [
    { term: 'EN 16931', gloss: 'the European standard' },
    { term: 'UBL 2.1', gloss: 'one of the two XML formats' },
    { term: 'CII · ZUGFeRD / Factur-X', gloss: 'the other, used across Germany and France' },
    { term: 'XRechnung 3.0', gloss: 'Germany’s public-sector profile' },
    { term: 'MIT licensed', gloss: 'free, and the source is public' },
    { term: 'Local-first', gloss: 'checking happens in your browser' },
  ],
  problem: {
    headingPre: 'Your customer’s system rejected the invoice with a code like',
    rule: 'BR-CO-17',
    headingPost: '. Now what?',
    body:
      'Every e-invoicing standard rejects the whole document over one bad figure, and the reference validators answer in spec clauses instead of your fields. Stampbench tells you exactly why it failed, in which line — and fixes what can safely be fixed.',
  },
  compare: {
    officialTitle: 'What the official validator says',
    officialBody:
      '[BR-CO-17] VAT category tax amount (BT-117) = VAT category taxable amount (BT-116) x (VAT category rate (BT-119) / 100), rounded to two decimals.',
    oursTitle: 'What Stampbench says',
    oursExplain:
      'VAT breakdown for category S at 7%: the tax amount should be 22.04 (314.86 × 7%) but the document states 99.99 — line 78.',
    oursFix:
      'Auto-fixable: there is exactly one correct value, so `stampbench fix` writes 22.04 into your file and revalidates it.',
  },
  principle: {
    title: 'Never invent compliance data.',
    body:
      'Stampbench fixes what mathematics can prove — a VAT total has exactly one right answer. Everything else goes to a human, because an invoice that quietly passes with invented data is worse than one that honestly fails.',
  },
  pillars: [
    {
      num: '01',
      title: 'Understand',
      tagline: 'Human-readable errors, anchored to the exact line.',
      details: 'How it works',
      items: [
        {
          title: 'Validation that explains itself',
          body: 'The EN 16931 core rules and the full VAT category families everywhere, and the German BR-DE profile on top when you are invoicing Germany. Every violation carries the rule id, the business term, and a message written for developers.',
        },
        {
          title: 'The exact failing line',
          body: 'Every violation carries a line and column, so a broken invoice annotates your pull request where the problem is. Approximate positions say so, rather than guessing confidently.',
        },
      ],
    },
    {
      num: '02',
      title: 'Fix',
      tagline: 'Deterministic repairs and totals that cannot be wrong.',
      details: 'How it works',
      items: [
        {
          title: 'It fixes what it can work out',
          body: 'Totals and VAT amounts that disagree with the figures they are computed from have exactly one right answer, so Stampbench corrects them in your file — and never invents data it cannot derive.',
        },
        {
          title: 'Totals computed by construction',
          body: 'Send lines with quantities, prices and VAT categories; Stampbench derives every total and the VAT breakdown, so the BR-CO arithmetic rules pass every time.',
        },
      ],
    },
    {
      num: '03',
      title: 'Stay compliant',
      tagline: 'Current and upcoming rule sets, both syntaxes.',
      details: 'How it works',
      items: [
        {
          title: 'Know what breaks before it breaks',
          body: 'Rule sets change on a published schedule. Diff your invoices against the next rule set before it becomes binding and get a ranked list of what to fix.',
        },
        {
          title: 'Reads what actually arrives',
          body: 'Both XML syntaxes, auto-detected: UBL 2.1 and CII — the syntax ZUGFeRD and Factur-X carry. No Java, no server round-trip, no account.',
        },
      ],
    },
  ],
  api: {
    heading: 'Two commands: check it, and fix what is safe to fix',
    body: 'No SDK lock-in, no XML expertise required. Runs locally — your invoices never leave your machine.',
    note:
      'The same file is 40 rules under the European core and 56 under the German profile. --profile chooses, and the header line always names the ruleset that actually ran.',
  },
  local: {
    heading: 'No Java. No uploads. No black box.',
    body:
      'The engine is a pure-TypeScript npm package. Validation, repair and generation run in your process — or in your browser on this site — and the rules are MIT-licensed source you can read.',
    steps: ['Your invoice', '@stampbench/core — locally', 'Validated, repaired, explained'],
  },
  proof: {
    heading: 'Built for compliance, not demos.',
    body:
      'A compliance tool is only worth using if its evidence can be inspected. The automated checks and parity tooling live in the open repository, including known differences from the reference validator.',
    evidence: 'See the full test evidence →',
    security: 'Security practices →',
    note: 'MIT-licensed engine — run it locally, verify every number yourself.',
  },
  statsBoard: {
    tests: { label: 'Automated test suites', sub: 'Core library · CLI · web application', failing: 'Run on every release' },
    docs: { label: 'Public parity suite', sub: 'Reference differences documented in the repository' },
    rules: { label: 'Validation rules active', families: ['EN 16931 core structure', 'VAT category rules', 'BR-DE profile (Germany only)'], subtotal: 'European rules, before any national profile' },
    located: {
      // Precisely what was measured. "Violations located" invited the reading
      // "100% of violations are caught", which is a different and much larger
      // claim than the one the harness actually supports.
      label: 'Every detected violation carries a source location',
      subLead: 'Every reported violation is anchored to a real document element.',
      subDetail: '27.1% land on the exact element; the rest point to the nearest enclosing element and are labelled approximate rather than guessed.',
    },
    growth: {
      label: 'Test suite growth',
      sub: 'Test cases per package, counted from the repository’s commit history — August 2026',
      series: ['library', 'CLI'],
    },
  },
  model: {
    heading: 'Open source at the core. Paid when you need the platform.',
    freeTitle: 'Free forever',
    freeBody: 'MIT-licensed, no account, no telemetry.',
    freeItems: [
      'Local library & CLI',
      'Browser playground',
      'Unlimited validation',
      'In-place repair',
      'Invoice creation from JSON',
    ],
    paidTitle: 'Paid plans',
    paidBody: 'The engine as infrastructure, from £29/month.',
    paidItems: [
      'Hosted REST API',
      'Shareable validation reports',
      'Future-ruleset checks',
      'Quotas that scale',
      'Email support',
    ],
    pricing: 'See pricing →',
  },
  cta: {
    heading: 'Run your first invoice through Stampbench.',
    body: 'No account. No credit card. No upload — validation runs in your browser.',
    button: 'Open the playground',
    install: 'or npm install',
  },
  footer: {
    blurb:
      'E-invoicing tools for businesses and the developers who build for them. Not legal advice — for certification-grade checks also run the official KoSIT validator.',
    founded: 'Founded by Harvey Legge.',
    product: 'Product',
    openSource: 'Open source',
    trust: 'Trust',
    legal: 'Legal',
    rules: 'Rules coverage',
    evidence: 'Test evidence',
    security: 'Security',
    terms: 'Terms',
    privacy: 'Privacy',
    rights: 'All rights reserved.',
  },
  playground: {
    title: 'Validate an invoice',
    intro:
      'Drop in an invoice and Stampbench checks it against the ruleset for your market — or build one from JSON and it computes the totals for you. Everything runs in your browser: no signup, no limits, and your XML never leaves your machine.',
    metaTitle: 'Validate an e-invoice online — free playground',
    metaDescription:
      'Paste or drop a UBL, CII, ZUGFeRD or XRechnung invoice and validate it against EN 16931 — or the German XRechnung profile — instantly, in your browser. Free, no signup, nothing uploaded.',
  },
  assistant: {
    title: 'Stampbench assistant',
    open: 'Open the Stampbench assistant',
    close: 'Close',
    placeholder: 'Ask about invoicing…',
    send: 'Send',
    thinking: 'Thinking…',
    greeting:
      'Hi — I can help with e-invoicing questions (EN 16931, XRechnung, VAT fields) and with anything Stampbench does. What are you working on?',
    signedOutBody:
      'The assistant answers invoicing questions and helps you use Stampbench. It comes with paid plans — sign in to get started.',
    signIn: 'Sign in',
    lockedBody:
      'The assistant is part of paid plans. Upgrade and it answers invoicing questions right here, on every page.',
    seePricing: 'See plans',
    disabledBody: 'The assistant is built but not switched on yet — check back soon.',
    quotaBody: 'Your AI credits for this month are used up. They reset next month, or upgrade for more.',
    poolBody: 'The site-wide AI allowance is used up this month — back next month.',
    errorBody: 'That did not go through — your credits were not charged. Try again.',
    scope: 'Answers can be wrong — verify anything important. Not legal or tax advice.',
  },
  meta: {
    title: 'Stampbench — e-invoicing, without the complexity',
    description:
      'Create compliant invoices without learning e-invoicing standards, or build e-invoicing into your software with a TypeScript engine, CLI and hosted API. EN 16931, the German XRechnung profile, UBL and CII — open source, runs on your own machine.',
  },
};

export const de: Copy = {
  locale: 'de',
  nav: {
    create: 'Rechnung erstellen',
    invoices: 'Meine Rechnungen',
    markets: 'Märkte',
    playground: 'Prüfen',
    docs: 'Dokumentation',
    pricing: 'Preise',
    trust: 'Nachweise',
    github: 'GitHub',
    signIn: 'Anmelden',
    account: 'Konto',
    menu: 'Menü',
    cta: 'Rechnung erstellen',
    business: 'Unternehmen',
    developers: 'Entwickler',
    company: 'Mehr',
    devPlatform: 'Entwicklerplattform',
    roast: 'Rechnungs-Roast',
    roastSub: 'Ehrliches, kostenloses Rechnungs-Feedback',
    createSub: 'Formular ausfüllen, konforme Rechnung erhalten',
    invoicesSub: 'Ihre Rechnungen, Zahlungsstatus und Wiederholungen',
    devPlatformSub: 'Engine, API und Werkzeuge im Überblick',
    playgroundSub: 'Prüfen und erzeugen im Browser',
    docsSub: 'API-Referenz, Bibliothek und CLI',
    marketsSub: 'Was unterstützt wird — Land für Land',
  },
  hero: {
    badge: 'E-Rechnungspflicht: Empfangen ist bereits Gesetz, Ausstellen ab 2027',
    titleTop: 'E-Rechnung,',
    titleAccent: 'ohne die Komplexität.',
    lede:
      'Erstellen Sie als Unternehmen konforme Rechnungen — oder bauen Sie E-Rechnungen mit der Entwicklerplattform von Stampbench direkt in Ihre Software ein.',
    ctaCreate: 'Rechnung erstellen',
    primer: 'Neu dabei? Eine E-Rechnung ist die Rechnung als strukturierte Daten in einem festen Format, damit die Software Ihres Kunden sie Feld für Feld lesen kann, statt sie abzutippen. Wenn Sie sich damit gar nicht befassen möchten: nehmen Sie die erste Tür — Stampbench übernimmt das.',
    ctaPrimary: 'Rechnung prüfen',
    ctaSecondary: 'Markt wählen',
    reassurance: 'Kostenlos testen · Ohne Konto · Läuft im Browser, nichts zu installieren',
    ctaCreateSub: 'Formular ausfüllen — Sie erhalten die XML-Datei, die das System Ihres Kunden benötigt, plus eine druckbare Fassung.',
  },
  paths: {
    eyebrow: 'Zwei Wege hinein',
    business: {
      icon: '🧾',
      title: 'Ich bin ein Unternehmen',
      body: 'Konforme Rechnungen erstellen und verwalten, ohne E-Rechnungs-Normen verstehen zu müssen.',
      cta: 'Rechnung erstellen →',
      href: '/invoice-generator',
      sub: 'Für Freiberufler, kleine Unternehmen und Teams.',
      bullets: [
        'Formular ausfüllen — keine Dateiformate zu wählen',
        'Wird vor dem Download automatisch geprüft',
        'Druckbares PDF und die Datei, die das System Ihres Kunden liest',
        'Zeigt, wer bezahlt hat — wiederkehrende Rechnungen stehen termingerecht bereit',
      ],
    },
    developer: {
      icon: '💻',
      title: 'Ich bin Entwickler',
      body: 'E-Rechnungen prüfen und erzeugen — mit der TypeScript-Engine, der API und den Werkzeugen von Stampbench.',
      cta: 'Zur Entwicklerplattform →',
      href: '/developers',
      sub: 'XRechnung · EN 16931 · UBL · CII · API',
      bullets: [
        'Deterministische, regelbasierte Prüfung mit Regel-IDs',
        'Jeder Verstoß nennt seine Fundstelle',
        'Erzeugen wie Prüfen — Summen konstruktionsbedingt korrekt',
        'Lokale Bibliothek, CLI und gehostete REST-API',
      ],
    },
    note: 'Dieselbe Engine hinter beiden. Sie können jederzeit wechseln, und keine der beiden Türen verlangt ein Konto.',
  },
  engine: {
    eyebrow: 'Eine Engine',
    heading: 'Beide Türen führen zur selben Compliance-Engine.',
    body:
      'Ein Unternehmen füllt ein Formular aus, ein Entwickler ruft eine API auf. Darunter laufen dieselben Regeln, dieselbe Arithmetik und dasselbe Urteil — deshalb ist die einfache Variante keine abgespeckte.',
  },
  convergence: {
    business: 'Ein Unternehmen füllt ein Formular aus',
    developer: 'Ein Entwickler ruft die API auf',
    form: ['Kunde', 'Position', 'Netto', 'USt. 19%'],
    engineName: 'Stampbench Compliance-Engine',
    ruleset: 'XRechnung 3.0 · 56 Regeln',
    // The German column keeps the German unfixable case: BR-DE-15, the
    // Leitweg-ID / buyer reference, is the rule this market actually meets.
    checks: [
      { kind: 'ok', label: 'Summen stimmen', rule: 'BR-CO-10' },
      { kind: 'ok', label: 'Länderkennzeichen vorhanden', rule: 'BR-11' },
      { kind: 'bad', label: 'Die Umsatzsteuer passt nicht zum Satz', rule: 'BR-CO-17' },
      { kind: 'fixed', label: 'Korrigiert: 425,00 € → 465,50 €', rule: 'herleitbar' },
      { kind: 'kept', label: 'Käuferreferenz fehlt — bleibt für Sie', rule: 'BR-DE-15' },
    ],
    verdictTitle: 'Dieselbe Engine, dieselbe Antwort — egal durch welche Tür',
    verdictSub: '1 automatisch korrigiert · 1 braucht einen Menschen · nichts erfunden',
    grab: 'Rechnung in die Engine ziehen',
    again: 'Nochmal durchlaufen lassen',
    summary:
      'Ein Unternehmen, das ein Formular ausfüllt, und ein Entwickler, der die API aufruft, erzeugen dieselbe Rechnungsdatei. Dieselbe Stampbench-Engine prüft sie: Sie korrigiert die herleitbare USt-Arithmetik und gibt die fehlende Käuferreferenz an einen Menschen zurück.',
  },
  markets: {
    eyebrow: 'Markt wählen',
    heading: 'Wo ist Ihr Unternehmen tätig?',
    body:
      'Rechnungsregeln werden je Land festgelegt. Stampbench ist am tiefsten in Deutschland — XRechnung 3.0 mit 56 Regeln —, prüft aber jede Rechnung auch gegen den europäischen Kern. Wählen Sie Ihren Hauptmarkt, und die Seite zeigt, was dort tatsächlich gilt.',
    note: 'Jederzeit änderbar, ganz ohne Konto.',
    compare: 'Alle Märkte vergleichen',
    germanyLink: 'Direkt zu XRechnung',
    selected: 'Ihr Markt',
    change: 'Was hier gilt',
    cards: [
      { id: 'uk', name: 'Vereinigtes Königreich', tagline: 'EN 16931 prüfen und erzeugen. Kein UK-eigener Regelsatz — offen gesagt.' },
      { id: 'us', name: 'Vereinigte Staaten', tagline: 'Strukturierte Rechnungen für die Fakturierung nach Europa. Keine US-Steuerlogik.' },
      { id: 'eu', name: 'Europäische Union', tagline: 'Der europäische Kern vollständig, dazu das deutsche Profil.' },
      { id: 'germany', name: 'Deutschland', tagline: 'Die tiefste Abdeckung im Produkt — XRechnung 3.0 und ZUGFeRD, mit Verweis auf die fehlerhafte Zeile.' },
      { id: 'multi', name: 'Mehrere Märkte', tagline: 'Die gesamte Abdeckung im Vergleich — samt Lücken.' },
    ],
    panel: {
      hint: 'Auf eine Region klicken.',
      several: 'Mehrere Märkte',
      // "{market} im Detail" rather than a preposition: the market names are
      // interpolated in the nominative, and "Alles zu/über {market}" would
      // need a dative or accusative article the template cannot supply
      // ("Alles zu Europäische Union" is simply wrong).
      everything: '{market} im Detail',
      remember: 'Diese Wahl merken',
      european: 'Europäischer Standard',
      syntaxes: 'Beide XML-Syntaxen',
      national: 'Nationaler Regelsatz',
      germanBuyers: 'Deutsche öffentliche Auftraggeber',
      taxRate: 'Welcher Steuersatz gilt',
      network: 'Versand über ein Netzwerk',
      nationalGermanyOnly: 'Nur Deutschland — der Rest nutzt den europäischen Kern',
      nationalNone: 'Für diesen Markt ist keiner veröffentlicht',
      germanSwitch: 'Markt auf Deutschland umstellen — dann alle {count} Regeln',
      taxRateValue: 'Das entscheidet Stampbench nicht',
      networkValue: 'Keine Zustellung über Peppol oder ein Exchange',
      rules: 'Regeln',
    },
  },
  showcase: {
    label: 'Was Stampbench macht',
    caption: 'Das ist der gesamte Ablauf.',
    captionLink: 'Kostenlos ausprobieren — ohne Konto →',
    tabs: [
      { id: 'create', label: 'Rechnung erstellen' },
      { id: 'check', label: 'Prüfen' },
      { id: 'fix', label: 'Korrigieren' },
      { id: 'automate', label: 'Automatisieren' },
    ],
    create: {
      title: 'RECHNUNG',
      seller: 'Nordlicht Systeme GmbH',
      sellerCity: 'Berlin, Deutschland',
      colItem: 'Position',
      colQty: 'Menge',
      colAmount: 'Betrag',
      lines: [
        { name: 'Entwicklung Schnittstelle', qty: '1', amount: '1.800,00 €' },
        { name: 'Beratung — 8 Std.', qty: '8', amount: '600,00 €' },
        { name: 'Wartungspauschale', qty: '1', amount: '50,00 €' },
      ],
      subtotal: 'Zwischensumme',
      vat: 'USt. 19%',
      total: 'Gesamt',
    },
    check: {
      verdict: '2 Probleme gefunden',
      checking: 'Wird geprüft…',
      rulesetLine: 'Geprüft gegen XRechnung 3.0 · 56 Regeln',
      problems: [
        {
          title: 'Die Umsatzsteuer stimmt nicht',
          rule: 'BR-CO-17',
          detail: '19 % von 2.450,00 € sind 465,50 €, die Rechnung nennt aber 425,00 €.',
        },
        {
          title: 'Die Käuferreferenz fehlt',
          rule: 'BR-DE-15',
          detail: 'Bei öffentlichen Auftraggebern ist das die Leitweg-ID — erraten wird sie nicht.',
        },
      ],
      footnote: 'Jedes Problem nennt die Regel, die es gefunden hat, und die Zeile.',
    },
    fix: {
      verdict: '1 automatisch korrigiert',
      keptTitle: '1 bleibt für Sie',
      keptDetail:
        'Die Umsatzsteuer hatte genau eine richtige Lösung und wurde korrigiert. Die Käuferreferenz nicht — sie zu erfinden würde aus einer fehlerhaften Rechnung eine still falsche machen.',
    },
    automate: {
      snippet: `$ npx stampbench validate rechnung.xml

rechnung.xml  syntax: UBL | profile: xrechnung | ruleset: 2026-08.2
  ERROR  BR-CO-17  VAT breakdown S @ 19%: tax amount should be
         465.50 (2450.00 × 19%) but is 425.00. (line 78)
INVALID — 1 error, 0 warnings (56 rules run)`,
      points: [
        { title: 'In der CI ausführen', detail: 'Bricht den Build, bevor eine fehlerhafte Rechnung beim Kunden landet.' },
        { title: 'Oder per API', detail: 'Eine Anfrage, dieselbe Antwort, aus jeder Sprache.' },
        { title: 'Lokal kostenlos', detail: 'Die Engine ist ein Open-Source-npm-Paket. Kein Konto, kein Upload.' },
      ],
    },
  },
  trustbar: [
    { term: 'XRechnung 3.0', gloss: 'das deutsche Profil' },
    { term: 'EN 16931', gloss: 'die europäische Norm' },
    { term: 'UBL 2.1', gloss: 'eines der beiden XML-Formate' },
    { term: 'CII · ZUGFeRD / Factur-X', gloss: 'das andere, in Deutschland verbreitet' },
    { term: 'MIT-lizenziert', gloss: 'kostenlos, Quellcode offen' },
    { term: 'Local-first', gloss: 'die Prüfung läuft im Browser' },
  ],
  problem: {
    headingPre: 'Ihre Rechnung scheitert mit',
    rule: 'BR-DE-15',
    headingPost: '. Und jetzt?',
    body:
      'Der Referenz-Stack ist Java, die Fehlermeldungen zitieren Spezifikationsklauseln statt Ihrer Felder, und eine falsch gerundete Umsatzsteuer lässt das ganze Dokument scheitern. Stampbench sagt Ihnen genau, warum — und korrigiert, was sich sicher korrigieren lässt.',
  },
  compare: {
    officialTitle: 'Was der offizielle Validator meldet',
    officialBody: '[BR-DE-15] Das Element "Buyer reference" (BT-10) muss übermittelt werden. (XR-DE 21)',
    oursTitle: 'Was Stampbench meldet',
    oursExplain:
      'Die Käuferreferenz (BT-10) fehlt. Bei öffentlichen Auftraggebern ist das die Leitweg-ID; B2B-Käufer vergeben in der Regel eine eigene Referenz.',
    oursFix: 'Nicht automatisch korrigierbar: Es gibt keinen herleitbaren Wert. Fragen Sie Ihren Käufer — niemals erfinden.',
  },
  principle: {
    title: 'Compliance-Daten werden niemals erfunden.',
    body:
      'Stampbench korrigiert, was Mathematik beweisen kann — eine USt-Summe hat genau eine richtige Antwort. Alles andere geht an einen Menschen, denn eine Rechnung, die mit erfundenen Daten still besteht, ist schlimmer als eine, die ehrlich scheitert.',
  },
  pillars: [
    {
      num: '01',
      title: 'Verstehen',
      tagline: 'Verständliche Fehler, verankert an der exakten Zeile.',
      details: 'So funktioniert es',
      items: [
        {
          title: 'Prüfung, die sich selbst erklärt',
          body: 'EN 16931-Kernregeln, die vollständigen USt-Kategorien und das deutsche BR-DE-Profil. Jeder Verstoß nennt Regel-ID, Business Term und eine Meldung, die Entwickler verstehen.',
        },
        {
          title: 'Die genaue fehlerhafte Zeile',
          body: 'Jeder Verstoß enthält Zeile und Spalte — eine fehlerhafte Rechnung wird im Pull Request genau dort markiert, wo das Problem liegt. Ungefähre Positionen werden als solche gekennzeichnet.',
        },
      ],
    },
    {
      num: '02',
      title: 'Korrigieren',
      tagline: 'Deterministische Korrekturen und Summen, die nicht falsch sein können.',
      details: 'So funktioniert es',
      items: [
        {
          title: 'Korrigiert, was berechenbar ist',
          body: 'Summen und Steuerbeträge, die nicht zu ihren Ausgangswerten passen, haben genau eine richtige Lösung — Stampbench korrigiert sie direkt in Ihrer Datei und erfindet niemals Daten.',
        },
        {
          title: 'Summen von Grund auf korrekt',
          body: 'Übergeben Sie Positionen mit Menge, Preis und Steuerkategorie; Stampbench berechnet alle Summen und die USt-Aufschlüsselung, sodass die BR-CO-Rechenregeln zwangsläufig erfüllt sind.',
        },
      ],
    },
    {
      num: '03',
      title: 'Konform bleiben',
      tagline: 'Aktuelle und kommende Regelsätze, beide Syntaxen.',
      details: 'So funktioniert es',
      items: [
        {
          title: 'Wissen, was künftig scheitert',
          body: 'Regelsätze ändern sich nach veröffentlichtem Zeitplan. Prüfen Sie Ihre Rechnungen gegen den nächsten Regelsatz, bevor er verbindlich wird, und erhalten Sie eine sortierte Fehlerliste.',
        },
        {
          title: 'Liest, was in Deutschland tatsächlich ankommt',
          body: 'Beide Syntaxen, automatisch erkannt: UBL und CII — das ZUGFeRD-/Factur-X-XML, in dem die meisten deutschen E-Rechnungen eintreffen. Kein Java, keine Server-Anfrage, kein Konto.',
        },
      ],
    },
  ],
  api: {
    heading: 'Zwei Befehle: prüfen und sicher Korrigierbares korrigieren',
    body: 'Keine SDK-Bindung, kein XML-Spezialwissen nötig. Läuft lokal — Ihre Rechnungen verlassen Ihren Rechner nicht.',
    note:
      'Dieselbe Datei: 40 Regeln im europäischen Kern, 56 im deutschen Profil. --profile wählt aus, und die Kopfzeile nennt immer den Regelsatz, der tatsächlich gelaufen ist.',
  },
  local: {
    heading: 'Kein Java. Kein Upload. Keine Blackbox.',
    body:
      'Die Engine ist ein reines TypeScript-npm-Paket. Prüfung, Korrektur und Erzeugung laufen in Ihrem Prozess — oder auf dieser Seite direkt im Browser — und die Regeln sind MIT-lizenzierter, lesbarer Quellcode.',
    steps: ['Ihre Rechnung', '@stampbench/core — lokal', 'Geprüft, korrigiert, erklärt'],
  },
  proof: {
    heading: 'Gebaut für Compliance, nicht für Demos.',
    body:
      'Ein Compliance-Werkzeug ist nur brauchbar, wenn es richtig ist. Jede Zahl unten stammt aus einem Artefakt im offenen Repository — einschließlich der drei offiziellen Dokumente, bei denen wir derzeit vom Referenzvalidator abweichen. Veröffentlicht statt versteckt.',
    evidence: 'Vollständige Testnachweise ansehen →',
    security: 'Sicherheit →',
    note: 'MIT-lizenzierte Engine — lokal ausführen und jede Zahl selbst überprüfen.',
  },
  statsBoard: {
    tests: { label: 'Automatisierte Tests', sub: 'Kernbibliothek · CLI · Webanwendung', failing: 'Bei jedem Release ausgeführt' },
    docs: { label: 'Offizielle Testdokumente geprüft', sub: '0 Abbrüche · 3 Abweichungen, veröffentlicht' },
    rules: { label: 'Aktive Prüfregeln', families: ['EN 16931 Kernstruktur', 'USt-Kategorieregeln', 'BR-DE-Profil (nur Deutschland)'], subtotal: 'Europäische Regeln, ohne nationales Profil' },
    located: {
      label: 'Jeder gefundene Verstoß nennt seine Fundstelle',
      subLead: '9.983 mutierte Rechnungen getestet — jeder Verstoß an einem echten Element verankert.',
      subDetail: '27,1 % treffen das exakte Element; der Rest zeigt auf das nächstliegende übergeordnete Element und ist als ungefähr gekennzeichnet statt geraten.',
    },
    growth: {
      label: 'Wachstum der Testsuite',
      sub: 'Testfälle je Paket, gezählt aus der Commit-Historie des Repositories — August 2026',
      series: ['Bibliothek', 'CLI'],
    },
  },
  model: {
    heading: 'Open Source im Kern. Bezahlt nur für die Plattform.',
    freeTitle: 'Für immer kostenlos',
    freeBody: 'MIT-lizenziert, ohne Konto, ohne Telemetrie.',
    freeItems: [
      'Lokale Bibliothek & CLI',
      'Playground im Browser',
      'Unbegrenzte Prüfung',
      'Korrektur direkt in der Datei',
      'XRechnung-Erzeugung',
    ],
    paidTitle: 'Bezahlpläne',
    paidBody: 'Die Engine als Infrastruktur, ab 29 £/Monat.',
    paidItems: [
      'Gehostete REST-API',
      'Teilbare Prüfberichte',
      'Zukunfts-Regelsatz-Checks',
      'Skalierende Kontingente',
      'E-Mail-Support',
    ],
    pricing: 'Zu den Preisen →',
  },
  cta: {
    heading: 'Schicken Sie Ihre erste Rechnung durch Stampbench.',
    body: 'Kein Konto. Keine Kreditkarte. Kein Upload — die Prüfung läuft in Ihrem Browser.',
    button: 'Playground öffnen',
    install: 'oder npm install',
  },
  footer: {
    blurb:
      'E-Rechnungs-Werkzeuge für Entwickler. Keine Rechtsberatung — für zertifizierungsreife Prüfungen zusätzlich den offiziellen KoSIT-Validator verwenden.',
    founded: 'Gegründet von Harvey Legge.',
    product: 'Produkt',
    openSource: 'Open Source',
    trust: 'Nachweise',
    legal: 'Rechtliches',
    rules: 'Regelabdeckung',
    evidence: 'Testnachweise',
    security: 'Sicherheit',
    terms: 'AGB',
    privacy: 'Datenschutz',
    rights: 'Alle Rechte vorbehalten.',
  },
  playground: {
    title: 'Rechnung prüfen',
    intro:
      'Legen Sie eine Rechnung ab — Stampbench prüft sie gegen den Regelsatz Ihres Marktes, standardmäßig XRechnung 3.0 — oder erzeugen Sie eine aus JSON. Alles läuft in Ihrem Browser: ohne Anmeldung, ohne Limit, und Ihr XML verlässt Ihren Rechner nicht.',
    metaTitle: 'XRechnung online prüfen — Playground',
    metaDescription:
      'XRechnung, UBL oder ZUGFeRD einfügen und sofort gegen EN 16931 und die BR-DE-Regeln prüfen — direkt im Browser. Kostenlos, ohne Anmeldung, kein Upload.',
  },
  assistant: {
    title: 'Stampbench-Assistent',
    open: 'Stampbench-Assistenten öffnen',
    close: 'Schließen',
    placeholder: 'Frage zur Rechnungsstellung…',
    send: 'Senden',
    thinking: 'Denkt nach…',
    greeting:
      'Hallo — ich helfe bei Fragen zur E-Rechnung (EN 16931, XRechnung, Umsatzsteuer-Felder) und zu allem, was Stampbench kann. Woran arbeiten Sie?',
    signedOutBody:
      'Der Assistent beantwortet Fragen zur Rechnungsstellung und hilft bei der Nutzung von Stampbench. Er gehört zu den Bezahl-Tarifen — melden Sie sich an, um loszulegen.',
    signIn: 'Anmelden',
    lockedBody:
      'Der Assistent gehört zu den Bezahl-Tarifen. Nach dem Upgrade beantwortet er Ihre Fragen direkt hier — auf jeder Seite.',
    seePricing: 'Tarife ansehen',
    disabledBody: 'Der Assistent ist gebaut, aber noch nicht freigeschaltet — schauen Sie bald wieder vorbei.',
    quotaBody: 'Ihre KI-Kontingente für diesen Monat sind aufgebraucht. Sie erneuern sich nächsten Monat — oder upgraden Sie für mehr.',
    poolBody: 'Das seitenweite KI-Kontingent ist diesen Monat aufgebraucht — nächsten Monat geht es weiter.',
    errorBody: 'Das hat nicht geklappt — Ihr Kontingent wurde nicht belastet. Versuchen Sie es erneut.',
    scope: 'Antworten können falsch sein — prüfen Sie Wichtiges nach. Keine Rechts- oder Steuerberatung.',
  },
  meta: {
    title: 'XRechnung & EN 16931 prüfen und korrigieren · Stampbench',
    description:
      'Die E-Rechnung wird Pflicht: XRechnung ist für Rechnungen an die öffentliche Verwaltung bereits vorgeschrieben, ab 2027 müssen alle Unternehmen E-Rechnungen ausstellen. Stampbench prüft, korrigiert und erzeugt konforme Rechnungen in TypeScript — Open Source, auf Ihrem eigenen Rechner.',
  },
};

export const COPY: Record<Locale, Copy> = { en, de };
