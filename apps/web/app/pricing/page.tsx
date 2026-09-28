import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PlansView } from './plans-view';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Stampbench pricing for businesses and developers. Five invoices a month free, unlimited from £29/month; hosted API plans from £29/month. Unlimited local validation with the open-source library.',
};

/**
 * Two audiences, one price list.
 *
 * The plans and prices are unchanged — what changed is that the page no longer
 * makes a freelancer read API quotas to work out whether £29 is for them. The
 * audience switch lives in PlansView (it needs state); the FAQ below is shared,
 * but each answer says plainly which audience it concerns.
 */

const faqs = [
  {
    q: 'Do I need to pay to create invoices?',
    a: 'Not for the first five a month. Creating, checking and downloading five invoices a month is free, with no account — it all runs in your browser. Paying lifts that limit and adds the tools for running on Stampbench month after month: recurring invoices, your customer book, marking invoices paid and chasing what is overdue, clean PDFs with no "Made with Stampbench" line, and backup that follows you between devices. Checking and repairing a file you already have stays free and unlimited, always.',
    who: 'Business',
  },
  {
    q: 'What counts as a document?',
    a: 'Each request to /api/v1/validate or /api/v1/generate counts as one document. Local validation with the open-source @stampbench/core library is unlimited and free forever — the quota only applies to the hosted API. Creating invoices on this site does not consume it either.',
    who: 'Developer',
  },
  {
    q: 'How do accounts and quotas work?',
    a: 'A free account comes with 100 hosted API calls, 10 shared reports and 5 future-ruleset checks per month. The open-source library, and validate, generate and fix in the playground, never need an account and are unlimited — quotas apply only to the hosted features.',
    who: 'Developer',
  },
  {
    q: 'What does the Platform tier actually include?',
    a: 'Usage-based pricing beyond 100k documents, a signable DPA/AVV and EU data residency (rolling out), version pinning per integration, and a rule-update commitment: new KoSIT releases supported within days, contractually.',
    who: 'Developer',
  },
  {
    q: 'Why pay when the library is free?',
    a: 'The hosted API gives you always-current rule sets without dependency upgrades, usage from any language (not just Node.js), shareable validation reports, and someone else maintaining the rule treadmill as XRechnung versions change.',
    who: 'Developer',
  },
  {
    q: 'Will my invoice be accepted? Is this legal advice?',
    a: 'Stampbench checks your invoice against the published EN 16931 and XRechnung rules and documents its coverage precisely, but it is tooling rather than legal advice, and it cannot promise what any particular customer’s system will do. For certification-grade sign-off, also run the official KoSIT validator — Stampbench is built to make passing it straightforward.',
    who: 'Both',
  },
  {
    q: 'Do you support Factur-X / ZUGFeRD, Peppol BIS, or FatturaPA?',
    a: 'Validation supports both syntaxes today, auto-detected: UBL and CII (the ZUGFeRD/Factur-X XML most German invoices arrive as). Generation is XRechnung UBL. Factur-X PDF generation, Peppol BIS and FatturaPA are next — Agency subscribers get early access.',
    who: 'Developer',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — plans are monthly. There is no billing portal yet: email us and your plan drops to Free at the end of the period. If you set up a recurring PayPal payment you can also cancel it yourself in PayPal at any time. Nothing renews behind your back.',
    who: 'Both',
  },
  {
    q: 'What about annual billing or EUR pricing?',
    a: 'Both are coming. Email us and we will set you up manually in the meantime.',
    who: 'Both',
  },
];

export default function PricingPage() {
  return (
    <main className="pricing-editorial mx-auto max-w-6xl px-4 py-14 sm:py-20">
      {/* PlansView reads ?for= via useSearchParams, which the static export
          requires to sit under a Suspense boundary. */}
      <Suspense fallback={<div className="min-h-[32rem]" />}>
        <PlansView />
      </Suspense>

      <div className="pricing-faq-head">
        <p>THE SMALL PRINT / MADE CLEAR</p>
        <h2>Questions, answered<br/><em>without the fine print.</em></h2>
      </div>
      <div className="pricing-faq-grid">
        {faqs.map((f) => (
          <div key={f.q} className="pricing-faq-card">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-sm font-medium">{f.q}</h3>
              <span className="pricing-faq-tag">
                {f.who}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted">{f.a}</p>
          </div>
        ))}
      </div>

      <p className="pricing-footnote">
        Still deciding which side you are on?{' '}
        <Link href="/invoice-generator" className="text-accent-hi hover:underline">
          Create an invoice
        </Link>{' '}
        or{' '}
        <Link href="/developers" className="text-accent-hi hover:underline">
          look at the developer platform
        </Link>
        .
      </p>
    </main>
  );
}
