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
}

export interface Copy {
  locale: Locale;
  nav: {
    create: string;
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
  };
  hero: {
    badge: string;
    titleTop: string;
    titleAccent: string;
    lede: string;
    /** Leads the hero: the generator. */
    ctaCreate: string;
    /** The validator — the older, deeper capability. */
    ctaPrimary: string;
    /** Scrolls to the market band; a text link, not a button. */
    ctaSecondary: string;
    install: string;
  };
  /**
   * The interactive validate→fix panel beside the hero. The two rules it shows
   * are copy, not constants: the English page demonstrates the asymmetry with
   * European core rules (which apply in every market), the German page with
   * the BR-DE rule its readers actually hit.
   */
  heroDemo: {
    passed: string;
    errors: string;
    expected: string;
    found: string;
    fixButton: string;
    fixedBadge: string;
    keptNote: string;
    tryYours: string;
    /** The violation with exactly one derivable answer. */
    fixableRule: string;
    fixableTitle: string;
    /** The violation that needs a person, whatever the market. */
    keptRule: string;
    keptTitle: string;
    /** Ruleset the panel says it ran, e.g. 'EN 16931 core · 40 rules'. */
    ruleset: string;
    /** Rules that passed — the ruleset's size minus the two failures shown. */
    passedCount: number;
  };
  /** The "where does your business operate?" band under the hero. */
  markets: MarketsCopy;
  /** Format/standard chips under the hero — facts only, no certifications. */
  trustbar: string[];
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
    rules: { label: string; families: [string, string, string] };
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
  meta: { title: string; description: string };
}

export const en: Copy = {
  locale: 'en',
  nav: {
    create: 'Create invoice',
    markets: 'Markets',
    playground: 'Validate',
    docs: 'Docs',
    pricing: 'Pricing',
    trust: 'Trust',
    github: 'GitHub',
    signIn: 'Sign in',
    account: 'Account',
    menu: 'Menu',
    cta: 'Get it on npm',
  },
  hero: {
    badge: 'MIT-licensed engine · runs on your machine · no account to try it',
    titleTop: 'Make your invoices pass.',
    titleAccent: 'In whichever market you bill.',
    lede:
      'Stampbench validates, repairs and creates structured e-invoices against the standard your customer actually requires — with the exact rule, the exact field and the exact line that failed.',
    ctaCreate: 'Create invoice',
    ctaPrimary: 'Validate an invoice',
    ctaSecondary: 'Choose your market',
    install: 'npm install',
  },
  heroDemo: {
    passed: 'rules passed',
    errors: 'errors found',
    expected: 'Expected',
    found: 'Found',
    fixButton: 'Fix automatically',
    fixedBadge: '1 fix applied — revalidated',
    keptNote: 'needs a human decision. Stampbench never guesses business data.',
    tryYours: 'Try it on your invoice →',
    fixableRule: 'BR-CO-17',
    fixableTitle: 'VAT amount is incorrect',
    keptRule: 'BR-11',
    keptTitle: 'Missing buyer country code (BT-55)',
    ruleset: 'EN 16931 core · 40 rules',
    passedCount: 38,
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
      { id: 'uk', name: 'United Kingdom', tagline: 'EN 16931 validation and creation. No UK-specific ruleset yet — said plainly.' },
      { id: 'us', name: 'United States', tagline: 'Structured invoicing for billing into Europe. No US tax logic.' },
      { id: 'eu', name: 'European Union', tagline: 'The European core in full, plus Germany’s national profile.' },
      { id: 'multi', name: 'Several markets', tagline: 'See the whole coverage matrix side by side, gaps included.' },
    ],
  },
  trustbar: ['EN 16931', 'UBL 2.1', 'CII · ZUGFeRD / Factur-X', 'XRechnung 3.0', 'MIT licensed', 'Local-first'],
  problem: {
    headingPre: 'Your invoice failed with',
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
    heading: 'Two commands, full compliance',
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
      'A compliance tool is only worth using if it is right. Every number below comes from an artefact in the open repository — including the three official documents where we currently disagree with the reference validator, published rather than hidden.',
    evidence: 'See the full test evidence →',
    security: 'Security practices →',
    note: 'MIT-licensed engine — run it locally, verify every number yourself.',
  },
  statsBoard: {
    tests: { label: 'Automated tests passing', sub: '136 library · 50 CLI · 66 web', failing: '0 failing · 0 skipped' },
    docs: { label: 'Official test documents run', sub: '0 crashes · 3 divergences, published' },
    rules: { label: 'Validation rules active', families: ['EN 16931 core', 'VAT categories', 'BR-DE profile'] },
    located: {
      label: 'Violations located',
      subLead: '9,983 mutated invoices tested — every violation anchored to a real element.',
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
      'E-invoicing compliance tooling for developers. Not legal advice — for certification-grade checks also run the official KoSIT validator.',
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
  meta: {
    title: 'Stampbench — validate, repair and create compliant e-invoices',
    description:
      'Invoice infrastructure for modern businesses: validate, repair and create structured e-invoices against the standard your market requires. EN 16931 core, the German XRechnung profile, UBL and CII — open source TypeScript that runs on your own machine.',
  },
};

export const de: Copy = {
  locale: 'de',
  nav: {
    create: 'Rechnung erstellen',
    markets: 'Märkte',
    playground: 'Prüfen',
    docs: 'Dokumentation',
    pricing: 'Preise',
    trust: 'Nachweise',
    github: 'GitHub',
    signIn: 'Anmelden',
    account: 'Konto',
    menu: 'Menü',
    cta: 'Auf npm holen',
  },
  hero: {
    badge: 'E-Rechnungspflicht: Empfangen ist bereits Gesetz, Ausstellen ab 2027',
    titleTop: 'XRechnung bestehen.',
    titleAccent: 'TypeScript-nativ. Ohne Java.',
    lede:
      'Das Entwickler-Toolkit für XRechnung und EN 16931: jeden Regelverstoß erkennen, genau verstehen, was fehlschlug, und sicher korrigieren, was sich herleiten lässt — vollständig auf Ihrem Rechner.',
    ctaCreate: 'Rechnung erstellen',
    ctaPrimary: 'Rechnung prüfen',
    ctaSecondary: 'Markt wählen',
    install: 'npm install',
  },
  heroDemo: {
    passed: 'Regeln bestanden',
    errors: 'Fehler gefunden',
    expected: 'Erwartet',
    found: 'Gefunden',
    fixButton: 'Automatisch korrigieren',
    fixedBadge: '1 Korrektur angewendet — neu geprüft',
    keptNote: 'braucht eine menschliche Entscheidung. Stampbench erfindet niemals Geschäftsdaten.',
    tryYours: 'Mit Ihrer Rechnung ausprobieren →',
    fixableRule: 'BR-CO-17',
    fixableTitle: 'USt-Betrag ist falsch',
    keptRule: 'BR-DE-15',
    keptTitle: 'Käuferreferenz fehlt (BT-10)',
    ruleset: 'XRechnung 3.0 · 56 Regeln',
    passedCount: 54,
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
      { id: 'multi', name: 'Mehrere Märkte', tagline: 'Die gesamte Abdeckung im Vergleich — samt Lücken.' },
    ],
  },
  trustbar: ['XRechnung 3.0', 'EN 16931', 'UBL 2.1', 'CII · ZUGFeRD / Factur-X', 'MIT-lizenziert', 'Local-first'],
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
    heading: 'Zwei Befehle, volle Konformität',
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
    tests: { label: 'Automatisierte Tests bestehen', sub: '136 Bibliothek · 50 CLI · 66 Web', failing: '0 fehlgeschlagen · 0 übersprungen' },
    docs: { label: 'Offizielle Testdokumente geprüft', sub: '0 Abbrüche · 3 Abweichungen, veröffentlicht' },
    rules: { label: 'Aktive Prüfregeln', families: ['EN 16931 Kern', 'USt-Kategorien', 'BR-DE-Profil'] },
    located: {
      label: 'Verstöße lokalisiert',
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
  meta: {
    title: 'XRechnung & EN 16931 prüfen und korrigieren · Stampbench',
    description:
      'Die E-Rechnung wird Pflicht: XRechnung ist für Rechnungen an die öffentliche Verwaltung bereits vorgeschrieben, ab 2027 müssen alle Unternehmen E-Rechnungen ausstellen. Stampbench prüft, korrigiert und erzeugt konforme Rechnungen in TypeScript — Open Source, auf Ihrem eigenen Rechner.',
  },
};

export const COPY: Record<Locale, Copy> = { en, de };
