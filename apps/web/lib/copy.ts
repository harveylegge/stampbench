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
  nav: { playground: string; docs: string; pricing: string; cta: string };
  hero: {
    badge: string;
    titleTop: string;
    titleAccent: string;
    lede: string;
    ctaPrimary: string;
    ctaSecondary: string;
    install: string;
  };
  problem: { headingPre: string; headingPost: string; body: string };
  features: { title: string; body: string }[];
  api: { heading: string; body: string };
  proof: {
    heading: string;
    body: string;
    stats: { figure: string; label: string; sub: string }[];
    evidence: string;
    security: string;
    note: string;
  };
  cta: { heading: string; body: string; button: string };
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
  nav: { playground: 'Playground', docs: 'Docs', pricing: 'Pricing', cta: 'Get it on npm' },
  hero: {
    badge: "Germany's B2B e-invoicing mandate: issuing required from Jan 2027",
    titleTop: 'Pass the e-invoice mandate.',
    titleAccent: 'In TypeScript.',
    lede:
      'Open-source validation, repair and generation for XRechnung / EN 16931. Built to match the official KoSIT validator, with cryptic rule violations turned into plain-language fixes — and nothing ever leaving your machine.',
    ctaPrimary: 'Try the playground',
    ctaSecondary: 'Read the docs',
    install: 'npm install',
  },
  problem: {
    headingPre: 'The official validator says',
    headingPost: '. Now what?',
    body:
      'Millions of European businesses are being forced onto structured e-invoices, and the tooling assumes you enjoy reading Schematron. The reference stack is Java, the error messages cite clauses instead of fields, and one wrong VAT rounding rejects the whole document. Stampbench is the layer that makes it just work.',
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
  proof: {
    heading: "Don't take our word for it",
    body:
      'A compliance tool is only worth using if it is right. Here is what we actually test — with the numbers, and the divergences we currently flag, published openly.',
    stats: [
      { figure: '165', label: 'Automated tests passing', sub: 'Library, CLI and web' },
      { figure: '86', label: 'Official test documents run', sub: '45 UBL + 41 CII, 0 crashes' },
      { figure: '56', label: 'Validation rules active', sub: 'EN 16931 + VAT families + BR-DE' },
      { figure: '100%', label: 'Violations located', sub: 'Anchored to a real element' },
    ],
    evidence: 'See the full test evidence →',
    security: 'Security practices →',
    note: 'MIT-licensed engine — run it locally, verify every number yourself.',
  },
  cta: {
    heading: 'Be compliant before your competitors are.',
    body: 'Unlimited local validation with the open-source library, forever. No account, no limits.',
    button: 'Get it on npm',
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
  nav: { playground: 'Playground', docs: 'Dokumentation', pricing: 'Preise', cta: 'Auf npm holen' },
  hero: {
    badge: 'E-Rechnungspflicht in Deutschland: Ausstellen ab Januar 2027 verpflichtend',
    titleTop: 'E-Rechnungspflicht bestehen.',
    titleAccent: 'In TypeScript.',
    lede:
      'Open-Source-Prüfung, -Korrektur und -Erzeugung für XRechnung / EN 16931. Entwickelt für Übereinstimmung mit dem offiziellen KoSIT-Validator — kryptische Regelverstöße werden zu verständlichen Hinweisen, und nichts verlässt Ihren Rechner.',
    ctaPrimary: 'Playground öffnen',
    ctaSecondary: 'Zur Dokumentation',
    install: 'npm install',
  },
  problem: {
    headingPre: 'Der offizielle Validator meldet',
    headingPost: '. Und jetzt?',
    body:
      'Millionen europäischer Unternehmen müssen auf strukturierte E-Rechnungen umstellen — und die vorhandenen Werkzeuge setzen voraus, dass man Schematron gern liest. Der Referenz-Stack ist Java, die Fehlermeldungen nennen Paragrafen statt Felder, und eine falsch gerundete Umsatzsteuer lässt das ganze Dokument scheitern. Stampbench ist die Schicht, die das erledigt.',
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
  proof: {
    heading: 'Verlassen Sie sich nicht auf unser Wort',
    body:
      'Ein Compliance-Werkzeug ist nur brauchbar, wenn es richtig ist. Das prüfen wir tatsächlich — mit Zahlen und den Abweichungen, die wir derzeit melden, offen veröffentlicht.',
    stats: [
      { figure: '165', label: 'Automatisierte Tests bestehen', sub: 'Bibliothek, CLI und Web' },
      { figure: '86', label: 'Offizielle Testdokumente geprüft', sub: '45 UBL + 41 CII, 0 Abbrüche' },
      { figure: '56', label: 'Aktive Prüfregeln', sub: 'EN 16931 + USt-Kategorien + BR-DE' },
      { figure: '100 %', label: 'Verstöße lokalisiert', sub: 'Auf ein echtes Element bezogen' },
    ],
    evidence: 'Vollständige Testnachweise ansehen →',
    security: 'Sicherheit →',
    note: 'MIT-lizenzierte Engine — lokal ausführen und jede Zahl selbst überprüfen.',
  },
  cta: {
    heading: 'Konform sein, bevor die Konkurrenz es ist.',
    body: 'Unbegrenzte lokale Prüfung mit der Open-Source-Bibliothek, dauerhaft. Kein Konto, keine Limits.',
    button: 'Auf npm holen',
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
