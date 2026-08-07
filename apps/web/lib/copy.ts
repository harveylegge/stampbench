/**
 * Site copy in English and German.
 *
 * The market is German-speaking — Germany already mandates XRechnung for
 * public-sector invoices and every business must issue e-invoices from 2027 —
 * so the German pages are the ones the actual buyers will find. English stays
 * the default because the library, rule ids and error messages are English.
 *
 * Pages render from these dictionaries rather than being duplicated, so the
 * layout can only ever drift in one place: here.
 */
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

export interface Copy {
  locale: Locale;
  nav: {
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
    ctaPrimary: string;
    ctaSecondary: string;
    install: string;
  };
  /** The interactive validate→fix panel beside the hero. */
  heroDemo: {
    passed: string;
    errors: string;
    expected: string;
    found: string;
    fixButton: string;
    fixedBadge: string;
    keptNote: string;
    tryYours: string;
  };
  /** Format/standard chips under the hero — facts only, no certifications. */
  trustbar: string[];
  problem: { headingPre: string; headingPost: string; body: string };
  /** Official-validator output vs Stampbench, side by side. */
  compare: {
    officialTitle: string;
    officialBody: string;
    oursTitle: string;
    oursExplain: string;
    oursFix: string;
  };
  features: { title: string; body: string }[];
  api: { heading: string; body: string };
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
    located: { label: string; sub: string };
    growth: { label: string; sub: string; series: [string, string] };
  };
  model: {
    heading: string;
    freeTitle: string;
    freeBody: string;
    paidTitle: string;
    paidBody: string;
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
    playground: 'Playground',
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
    badge: 'Germany mandates B2B e-invoices from 2027 — receiving is already law',
    titleTop: 'Validate and fix XRechnung.',
    titleAccent: 'In TypeScript, without Java.',
    lede:
      'The developer-first toolkit for XRechnung and EN 16931: catch every rule violation, understand exactly what failed, and safely repair what can be derived — entirely on your machine.',
    ctaPrimary: 'Try the playground',
    ctaSecondary: 'View on GitHub',
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
  },
  trustbar: ['XRechnung 3.0', 'EN 16931', 'UBL 2.1', 'CII · ZUGFeRD / Factur-X', 'MIT licensed', 'Local-first'],
  problem: {
    headingPre: 'Your invoice failed with',
    headingPost: '. Now what?',
    body:
      'The reference stack is Java, the error messages cite spec clauses instead of your fields, and one wrong VAT rounding rejects the whole document. Stampbench tells you exactly why it failed — and fixes what can safely be fixed.',
  },
  compare: {
    officialTitle: 'What the official validator says',
    officialBody: '[BR-DE-15] Das Element "Buyer reference" (BT-10) muss übermittelt werden. (XR-DE 21)',
    oursTitle: 'What Stampbench says',
    oursExplain:
      'Missing buyer reference (BT-10). For German public-sector buyers this is the Leitweg-ID; B2B buyers usually supply their own reference.',
    oursFix: 'Not auto-fixable: there is no derivable correct value. Ask your buyer — never invent one.',
  },
  features: [
    {
      title: 'Validation that explains itself',
      body: 'EN 16931 core rules, the full VAT category families (BR-S/E/AE/Z/G/O), and the German XRechnung profile (BR-DE). Every violation carries the rule id, the business term, and a message written for developers.',
    },
    {
      title: 'It fixes what it can work out',
      body: 'Totals and VAT amounts that disagree with the figures they are computed from have exactly one right answer, so Stampbench corrects them in your file — and refuses to invent a VAT number it cannot derive.',
    },
    {
      title: 'The exact failing line',
      body: 'Every violation carries a line and column, so a broken invoice annotates your pull request where the problem is instead of dumping a log. Approximate positions say so, rather than guessing confidently.',
    },
    {
      title: 'Totals computed by construction',
      body: 'Send lines with quantities, prices and VAT categories. Stampbench derives BT-106 through BT-115 and the VAT breakdown so the BR-CO arithmetic rules pass every time — the part hand-rolled generators always get wrong.',
    },
    {
      title: 'Know what breaks before it breaks',
      body: 'Rule sets change on a published schedule — and the artefacts land before they become binding. Point Stampbench at your invoices, diff them against the next rule set, and get a ranked list of what to fix.',
    },
    {
      title: 'Reads what Germany actually sends',
      body: 'Both syntaxes, auto-detected: UBL and CII — the ZUGFeRD / Factur-X XML that most German e-invoices arrive as. No Java, no server round-trip, no account.',
    },
  ],
  api: {
    heading: 'Two commands, full compliance',
    body: 'No SDK lock-in, no XML expertise required. Runs locally — your invoices never leave your machine.',
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
    tests: { label: 'Automated tests passing', sub: '110 library · 50 CLI · 6 web', failing: '0 failing · 0 skipped' },
    docs: { label: 'Official test documents run', sub: '0 crashes · 3 divergences, published' },
    rules: { label: 'Validation rules active', families: ['EN 16931 core', 'VAT categories', 'BR-DE profile'] },
    located: { label: 'Violations located', sub: '27.1% to the exact element — measured over 9,983 mutations' },
    growth: {
      label: 'Test suite growth',
      sub: 'Test cases per package, counted from the repository’s commit history — August 2026',
      series: ['library', 'CLI'],
    },
  },
  model: {
    heading: 'Open source at the core. Paid when you need the platform.',
    freeTitle: 'Free forever',
    freeBody:
      'The library, the CLI and this site’s playground: unlimited local validation, repair and generation. MIT-licensed, no account, no telemetry.',
    paidTitle: 'Paid plans',
    paidBody:
      'The hosted REST API, shareable validation reports and future-ruleset checks — for teams that want the engine as infrastructure, with quotas that scale.',
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
    title: 'Playground',
    intro:
      'Validate an XRechnung document or generate one from JSON — everything runs in your browser. No signup, no limits, and your XML never leaves your machine.',
    metaTitle: 'Playground — validate XRechnung online',
    metaDescription:
      'Paste an XRechnung / UBL / ZUGFeRD invoice and validate it against EN 16931 and BR-DE rules instantly, in your browser. Free, no signup, nothing uploaded.',
  },
  meta: {
    title: 'Validate & fix XRechnung / EN 16931 e-invoices · Stampbench',
    description:
      'E-invoicing is becoming law: Germany already requires XRechnung for public-sector invoices, and every business must issue e-invoices from 2027. Stampbench validates, repairs and generates compliant invoices in TypeScript — open source, on your own machine.',
  },
};

export const de: Copy = {
  locale: 'de',
  nav: {
    playground: 'Playground',
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
    titleTop: 'XRechnung prüfen und korrigieren.',
    titleAccent: 'In TypeScript, ohne Java.',
    lede:
      'Das Entwickler-Toolkit für XRechnung und EN 16931: jeden Regelverstoß erkennen, genau verstehen, was fehlschlug, und sicher korrigieren, was sich herleiten lässt — vollständig auf Ihrem Rechner.',
    ctaPrimary: 'Playground öffnen',
    ctaSecondary: 'Auf GitHub ansehen',
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
  },
  trustbar: ['XRechnung 3.0', 'EN 16931', 'UBL 2.1', 'CII · ZUGFeRD / Factur-X', 'MIT-lizenziert', 'Local-first'],
  problem: {
    headingPre: 'Ihre Rechnung scheitert mit',
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
  features: [
    {
      title: 'Prüfung, die sich selbst erklärt',
      body: 'EN 16931-Kernregeln, die vollständigen USt-Kategorien (BR-S/E/AE/Z/G/O) und das deutsche XRechnung-Profil (BR-DE). Jeder Verstoß nennt Regel-ID, Business Term und eine Meldung, die Entwickler verstehen.',
    },
    {
      title: 'Korrigiert, was berechenbar ist',
      body: 'Summen und Steuerbeträge, die nicht zu den Werten passen, aus denen sie berechnet werden, haben genau eine richtige Lösung — Stampbench korrigiert sie direkt in Ihrer Datei. Eine USt-IdNr. wird niemals erfunden.',
    },
    {
      title: 'Die genaue fehlerhafte Zeile',
      body: 'Jeder Verstoß enthält Zeile und Spalte. Eine fehlerhafte Rechnung wird im Pull Request genau dort markiert, wo das Problem liegt — und ungefähre Positionen werden als solche gekennzeichnet, statt sicher zu wirken.',
    },
    {
      title: 'Summen von Grund auf korrekt',
      body: 'Übergeben Sie Positionen mit Menge, Preis und Steuerkategorie. Stampbench berechnet BT-106 bis BT-115 und die USt-Aufschlüsselung, sodass die BR-CO-Rechenregeln zwangsläufig erfüllt sind — genau das, was handgeschriebene Generatoren regelmäßig falsch machen.',
    },
    {
      title: 'Wissen, was künftig scheitert',
      body: 'Regelsätze ändern sich nach veröffentlichtem Zeitplan, und die Artefakte erscheinen, bevor sie verbindlich werden. Prüfen Sie Ihre Rechnungen gegen den nächsten Regelsatz und erhalten Sie eine nach Auswirkung sortierte Liste.',
    },
    {
      title: 'Liest, was in Deutschland tatsächlich ankommt',
      body: 'Beide Syntaxen, automatisch erkannt: UBL und CII — das ZUGFeRD-/Factur-X-XML, in dem die meisten deutschen E-Rechnungen eintreffen. Kein Java, keine Server-Anfrage, kein Konto.',
    },
  ],
  api: {
    heading: 'Zwei Befehle, volle Konformität',
    body: 'Keine SDK-Bindung, kein XML-Spezialwissen nötig. Läuft lokal — Ihre Rechnungen verlassen Ihren Rechner nicht.',
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
    tests: { label: 'Automatisierte Tests bestehen', sub: '110 Bibliothek · 50 CLI · 6 Web', failing: '0 fehlgeschlagen · 0 übersprungen' },
    docs: { label: 'Offizielle Testdokumente geprüft', sub: '0 Abbrüche · 3 Abweichungen, veröffentlicht' },
    rules: { label: 'Aktive Prüfregeln', families: ['EN 16931 Kern', 'USt-Kategorien', 'BR-DE-Profil'] },
    located: { label: 'Verstöße lokalisiert', sub: '27,1 % exakt am Element — gemessen über 9.983 Mutationen' },
    growth: {
      label: 'Wachstum der Testsuite',
      sub: 'Testfälle je Paket, gezählt aus der Commit-Historie des Repositories — August 2026',
      series: ['Bibliothek', 'CLI'],
    },
  },
  model: {
    heading: 'Open Source im Kern. Bezahlt nur für die Plattform.',
    freeTitle: 'Für immer kostenlos',
    freeBody:
      'Bibliothek, CLI und der Playground dieser Seite: unbegrenzte lokale Prüfung, Korrektur und Erzeugung. MIT-lizenziert, ohne Konto, ohne Telemetrie.',
    paidTitle: 'Bezahlpläne',
    paidBody:
      'Die gehostete REST-API, teilbare Prüfberichte und Zukunfts-Regelsatz-Checks — für Teams, die die Engine als Infrastruktur nutzen wollen, mit skalierenden Kontingenten.',
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
    title: 'Playground',
    intro:
      'Prüfen Sie eine XRechnung oder erzeugen Sie eine aus JSON — alles läuft in Ihrem Browser. Ohne Anmeldung, ohne Limit, und Ihr XML verlässt Ihren Rechner nicht.',
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
