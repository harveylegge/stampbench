'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { plansFor, type Audience } from '@/lib/plans';
import { BillingNote } from './billing-note';

/**
 * The plan grid, shown one audience at a time.
 *
 * The old page put four plans in one row, each with a feature list that mixed
 * "PDF invoices with a small Stampbench line" and "5,000 documents / month".
 * A freelancer read it and could not tell which number applied to them; a
 * developer read it and could not tell whether this was serious infrastructure
 * or a PDF tool. Both audiences are still sold the same four plans at the same
 * prices: the switch changes which of them are relevant and which vocabulary
 * describes them, not what is on sale.
 *
 * Business sees two plans, because Agency and Platform are quotas on an API a
 * business will never call. Nothing is hidden that a business could buy.
 */

const COPY: Record<Audience, { heading: string; body: string; other: string; otherLink: string }> = {
  business: {
    heading: 'Create invoices. We handle the compliance part.',
    body: 'Every plan creates unlimited invoices and checks each one before you download it. Paying removes the Stampbench line from your PDFs and backs up every invoice to your account.',
    other: 'Building e-invoicing into software instead?',
    otherLink: 'See developer plans →',
  },
  developer: {
    heading: 'The library is free forever. Plans buy certainty.',
    body: 'Unlimited local validation with the open-source library, always. Paid plans sell what code alone cannot promise: always-current rules without dependency upgrades, volume, client-project leverage, and the compliance posture platforms need.',
    other: 'Just want to send an invoice?',
    otherLink: 'See business plans →',
  },
};

export function PlansView() {
  const params = useSearchParams();
  const [audience, setAudience] = useState<Audience>('business');

  // ?for=developers deep-links the developer view: every link into pricing
  // from a developer surface carries it, so arriving from /developers never
  // shows an invoice-first page.
  useEffect(() => {
    const requested = params.get('for');
    if (requested === 'developers' || requested === 'developer') setAudience('developer');
    else if (requested === 'business') setAudience('business');
  }, [params]);

  const plans = plansFor(audience);
  const copy = COPY[audience];

  return (
    <>
      <header className="pricing-hero">
        <p className="pricing-kicker"><i />PRICING / CHOOSE YOUR BENCH</p>
        <h1>{copy.heading}</h1>
        <p>{copy.body}</p>
      </header>

      {/* The switch. A radiogroup rather than tabs: this chooses who you are,
          and it is the same question the homepage asked. */}
      <div
        role="radiogroup"
        aria-label="Who are you buying for?"
        className="pricing-audience"
      >
        {(['business', 'developer'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={audience === id}
            onClick={() => setAudience(id)}
            className={audience === id ? 'is-active' : ''}
          >
            {id === 'business' ? "I'm a business" : "I'm a developer"}
          </button>
        ))}
      </div>

      <div
        className={`pricing-plan-grid ${
          plans.length === 2 ? 'mx-auto max-w-3xl sm:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {plans.map((plan) => {
          const highlight = audience === 'business' ? plan.id === 'starter' : plan.id === 'pro';
          const items = plan.perAudience[audience] ?? plan.features;
          return (
            <div
              key={plan.id}
              className={`pricing-plan ${highlight ? 'is-highlight' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium">{plan.name}</span>
                {highlight && (
                  <span className="pricing-popular">
                    RECOMMENDED
                  </span>
                )}
              </div>
              <div className="mb-3">
                <span className="text-3xl font-semibold">£{plan.priceGbp}</span>
                <span className="text-sm text-muted">/month</span>
                <div className="mt-1 text-xs text-faint">
                  {plan.priceGbp === 0 ? 'Free forever: no card needed' : 'Cancel anytime'}
                </div>
              </div>

              {/* Who it is for, before what it includes. */}
              <p className="mb-4 border-b border-border pb-4 text-sm leading-relaxed text-muted">
                {plan.forWhom[audience]}
              </p>

              <ul className="mb-6 flex flex-col gap-2 text-sm text-muted">
                {items.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-success" aria-hidden>
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.id === 'free' ? '/signup' : `/signup?plan=${plan.id}`}
                className={`pricing-plan-cta ${
                  highlight
                    ? 'bg-accent text-white hover:bg-accent-hi'
                    : 'border border-border bg-surface hover:border-border-hi'
                }`}
              >
                {/* The paid tiers keep their commercial names, but a business
                    reading "Choose Developer" has to stop and work out whether
                    the plan is for them. The card header still names the plan;
                    the button just does not repeat it at the audience it
                    reads oddly to. */}
                {plan.id === 'free'
                  ? 'Start free'
                  : audience === 'business'
                    ? 'Choose this plan'
                    : `Choose ${plan.name}`}
              </Link>
              {plan.id !== 'free' && <BillingNote />}
            </div>
          );
        })}
      </div>

      <p className="pricing-switch-note">
        {copy.other}{' '}
        <button
          type="button"
          onClick={() => setAudience(audience === 'business' ? 'developer' : 'business')}
          className="text-accent-hi hover:underline"
        >
          {copy.otherLink}
        </button>
      </p>

      {audience === 'business' && (
        <p className="pricing-browser-note">
          Creating invoices does not need an account at all: the generator runs in your browser and
          keeps its history there.{' '}
          <Link href="/invoice-generator" className="text-accent-hi hover:underline">
            Create one now
          </Link>{' '}
          and sign up later if you want the backup.
        </p>
      )}
    </>
  );
}
