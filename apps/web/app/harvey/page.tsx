import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Harvey Legge',
  description:
    'Harvey Legge is the founder of Stampbench, an open-source e-invoicing compliance toolkit: validation, repair and generation for XRechnung / EN 16931 invoices in TypeScript.',
  alternates: { canonical: '/harvey' },
};

const LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/harvey-legge-ba687b3ba', sub: 'Founder at Stampbench' },
  { label: 'GitHub', href: 'https://github.com/harveylegge', sub: 'harveylegge' },
  { label: 'Stampbench', href: 'https://stampbench.com', sub: 'stampbench.com' },
  { label: 'npm', href: 'https://www.npmjs.com/package/stampbench', sub: 'stampbench · @stampbench/core' },
];

export default function HarveyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: {
              '@type': 'Person',
              '@id': 'https://stampbench.com/#harvey-legge',
              name: 'Harvey Legge',
              url: 'https://stampbench.com/harvey',
              jobTitle: 'Founder',
              worksFor: {
                '@type': 'Organization',
                '@id': 'https://stampbench.com/#org',
                name: 'Stampbench',
                url: 'https://stampbench.com',
              },
              knowsAbout: [
                'E-invoicing',
                'XRechnung',
                'EN 16931',
                'TypeScript',
                'Software development',
              ],
              sameAs: [
                'https://github.com/harveylegge',
                'https://www.linkedin.com/in/harvey-legge-ba687b3ba',
              ],
            },
          }),
        }}
      />

      <div className="mb-8 flex items-center gap-6">
        {/* Monogram placeholder — swap for a headshot when one is available. */}
        <div
          aria-hidden
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-3xl font-semibold tracking-tight text-accent"
        >
          HL
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Harvey Legge</h1>
          <p className="mt-1 text-muted">Founder, Stampbench</p>
        </div>
      </div>

      <div className="space-y-4 leading-relaxed text-muted">
        <p>
          Harvey Legge is a software developer and the founder of{' '}
          <a href="https://stampbench.com" className="text-text underline decoration-border underline-offset-4 hover:decoration-accent">
            Stampbench
          </a>
          , an open-source compliance toolkit for European e-invoicing. Stampbench validates,
          repairs and generates <strong className="text-text">XRechnung / EN 16931</strong>{' '}
          e-invoices in pure TypeScript — locally, on your own machine, with plain-language
          explanations for cryptic rule violations.
        </p>
        <p>
          He started Stampbench for the mandate wave hitting European businesses: Germany has
          required companies to receive e-invoices since January 2025 and requires them to issue
          e-invoices from January 2027, with France and other EU states following. The existing
          tooling ecosystem is Java; Stampbench is the TypeScript-first answer.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
          >
            <div className="font-medium text-text">{l.label}</div>
            <div className="mt-1 text-xs text-faint">{l.sub}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
