import type { Metadata } from 'next';
import Link from 'next/link';

import { PLANS } from '@/lib/plans';
import { BillingNote } from './billing-note';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Stampbench pricing: free tier with 100 API calls/month, paid plans from £19/month. Unlimited local validation with the open-source library.',
};

const faqs = [
  {
    q: 'What counts as a document?',
    a: 'Each request to /api/v1/validate or /api/v1/generate counts as one document. Local validation with the open-source @stampbench/core library is unlimited and free forever — the quota only applies to the hosted API.',
  },
  {
    q: 'How do accounts and quotas work?',
    a: 'A free account comes with 100 hosted API calls, 10 shared reports and 5 future-ruleset checks per month. The open-source library, and validate, generate and fix in the playground, never need an account and are unlimited — quotas apply only to the hosted features.',
  },
  {
    q: 'What does the Platform tier actually include?',
    a: 'Usage-based pricing beyond 100k documents, a signable DPA/AVV and EU data residency (rolling out), version pinning per integration, and a rule-update commitment: new KoSIT releases supported within days, contractually.',
  },
  {
    q: 'Why pay when the library is free?',
    a: 'The hosted API gives you always-current rule sets without dependency upgrades, usage from any language (not just Node.js), shareable validation reports, and someone else maintaining the rule treadmill as XRechnung versions change.',
  },
  {
    q: 'Do you support Factur-X / ZUGFeRD, Peppol BIS, or FatturaPA?',
    a: 'Validation supports both syntaxes today, auto-detected: UBL and CII (the ZUGFeRD/Factur-X XML most German invoices arrive as). Generation is XRechnung UBL. Factur-X PDF generation, Peppol BIS and FatturaPA are next — Agency subscribers get early access.',
  },
  {
    q: 'Is this legal advice? Will my invoice be accepted?',
    a: 'Stampbench is developer tooling, not legal advice. We implement the published EN 16931 and XRechnung rules and document our coverage precisely; for certification-grade sign-off, also run the official KoSIT validator (we make passing it much easier).',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — plans are monthly. There is no billing portal yet: email us and your plan drops to Free at the end of the period. If you set up a recurring PayPal payment you can also cancel it yourself in PayPal at any time. Nothing renews behind your back.',
  },
  {
    q: 'What about annual billing or EUR pricing?',
    a: 'Both are coming. Email us and we will set you up manually in the meantime.',
  },
];

export default function PricingPage() {
  const order = ['free', 'starter', 'pro', 'scale'] as const;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="mb-3 text-center text-3xl font-semibold tracking-tight">
        The library is free forever. Plans buy certainty.
      </h1>
      <p className="mx-auto mb-12 max-w-xl text-center text-muted">
        Unlimited local validation with the open-source library, always. Paid plans sell what code
        alone can&apos;t promise: always-current rules without upgrades, volume, client-project
        leverage, and platform compliance posture.
      </p>

      <div className="mb-20 grid gap-4 md:grid-cols-4">
        {order.map((id) => {
          const p = PLANS[id];
          const highlight = id === 'pro';
          return (
            <div
              key={id}
              className={`flex flex-col rounded-xl border p-6 ${
                highlight ? 'border-accent bg-accent-dim/20' : 'border-border bg-surface'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{p.name}</span>
                {highlight && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white">
                    Popular
                  </span>
                )}
              </div>
              <div className="mb-4">
                <span className="text-3xl font-semibold">£{p.priceGbp}</span>
                <span className="text-sm text-muted">/month</span>
                {/* Reassurance where the hesitation actually happens — at the
                    price, not buried in the FAQ at the bottom of the page. */}
                <div className="mt-1 text-xs text-faint">
                  {p.priceGbp === 0 ? 'Free forever — no card needed' : 'Cancel anytime'}
                </div>
              </div>
              <ul className="mb-6 flex flex-col gap-2 text-sm text-muted">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-success">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={id === 'free' ? '/signup' : `/signup?plan=${id}`}
                className={`mt-auto rounded-lg py-2 text-center text-sm font-medium transition ${
                  highlight
                    ? 'bg-accent text-white hover:bg-accent-hi'
                    : 'border border-border bg-surface hover:border-border-hi'
                }`}
              >
                {id === 'free' ? 'Start free' : `Choose ${p.name}`}
              </Link>
              {/* How payment happens, stated before signup rather than after. */}
              {id !== 'free' && <BillingNote />}
            </div>
          );
        })}
      </div>

      <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight">
        Frequently asked questions
      </h2>
      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
        {faqs.map((f) => (
          <div key={f.q} className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-2 text-sm font-medium">{f.q}</h3>
            <p className="text-sm leading-relaxed text-muted">{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
