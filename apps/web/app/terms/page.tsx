import type { Metadata } from 'next';
import Link from 'next/link';
import { Clause, Fill, LegalPage } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing use of the Stampbench hosted API, website and open-source library.',
};

/**
 * NOT LEGAL ADVICE. Written for a UK sole trader selling a developer API into
 * the EU; drafted B2B. 2026-08-07: Harvey's details filled in (England & Wales,
 * £100 cap, no VAT, hello@ contact) and billing language corrected to the real
 * flow (manual upgrade by email — no Stripe on the site). Remaining <Fill>s are
 * ONLY the postal address (virtual office pending). It has NOT been reviewed by
 * a qualified lawyer — do that before actively promoting paid plans.
 */

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="7 August 2026"
      intro={
        <p>
          These terms govern your use of the Stampbench website, hosted API and dashboard (the
          &ldquo;Service&rdquo;), operated by Harvey Legge, trading as Stampbench, of{' '}
          <Fill>[postal address to follow]</Fill>, United Kingdom (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;). By creating an
          account or calling the API you agree to them. The open-source library is licensed
          separately under the MIT licence and is not governed by these terms.
        </p>
      }
    >
      <Clause n="1." title="The Service">
        <p>
          Stampbench provides software that validates and generates structured electronic invoices
          against published technical standards (including EN 16931 and the German XRechnung
          specification). We provide developer tooling. We do not provide legal, tax or accounting
          advice, and we do not act as your tax agent or as an accredited transmission network.
        </p>
        <p>
          We may change, add to or withdraw features. Where a change materially reduces
          functionality you rely on, we will give reasonable notice by email or in the dashboard.
        </p>
      </Clause>

      <Clause n="2." title="Accounts and API keys">
        <p>
          You must provide accurate registration details and are responsible for all activity under
          your account and API keys. Keep your keys secret: anyone holding a key can consume your
          quota. You can revoke a key at any time from the dashboard, and you must do so promptly if
          you suspect it has been exposed.
        </p>
        <p>You must be at least 18 and using the Service for business purposes.</p>
      </Clause>

      <Clause n="3." title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>attempt to breach, probe or disrupt the Service, or bypass quotas or rate limits;</li>
          <li>submit content you have no lawful right to process;</li>
          <li>
            resell or redistribute the hosted API as a substantially similar standalone validation
            service (using it inside your own product is expressly permitted and encouraged);
          </li>
          <li>use the Service in a way that damages its availability for other customers.</li>
        </ul>
        <p>
          We may suspend an account that materially breaches this clause, with notice where it is
          reasonable to give it and immediately where it is not.
        </p>
      </Clause>

      <Clause n="4." title="Your data">
        <p>
          You retain all rights in the invoice data you submit. You grant us only the limited
          licence needed to process it in order to return a result to you. We do not sell your data
          and we do not use your invoice contents to train machine-learning models.
        </p>
        <p>
          How we handle personal data is set out in our{' '}
          <Link href="/privacy" className="text-accent-hi hover:underline">
            Privacy Policy
          </Link>
          , and the technical controls are described on our{' '}
          <Link href="/security" className="text-accent-hi hover:underline">
            Security page
          </Link>
          .
        </p>
      </Clause>

      <Clause n="5." title="Plans, fees and cancellation">
        <p>
          Paid plans are currently arranged manually: you request a plan from your account page, we
          contact you by email to agree payment, and we activate the plan once payment is arranged.
          No payment details are collected on this website. Prices are shown on the{' '}
          <Link href="/pricing" className="text-accent-hi hover:underline">
            pricing page
          </Link>{' '}
          and are exclusive of VAT, which is added where applicable. Each plan includes monthly
          feature allowances; exceeding one pauses that feature until the next period or until you
          upgrade.
        </p>
        <p>
          You may cancel at any time by emailing{' '}
          <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">
            hello@stampbench.com
          </a>{' '}
          and will retain access until the end of the paid period, after which your account drops to
          the Free plan. We do not provide pro-rata refunds for partial months except where required
          by law or where we have materially failed to provide the Service. We may change prices
          with at least 30 days&apos; notice, effective from your next billing period.
        </p>
      </Clause>

      <Clause n="6." title="Availability">
        <p>
          We work to keep the Service available and reliable, but we do not currently offer a
          contractual uptime guarantee, and the Service is provided on a reasonable-endeavours
          basis. Planned maintenance will be announced where practicable. If you require a
          contractual SLA, contact us about the Platform tier.
        </p>
      </Clause>

      <Clause n="7." title="No compliance guarantee">
        <p className="text-text">
          This clause matters more than any other, so we state it plainly: a passing result from
          Stampbench is not a guarantee that any tax authority, customer, access point or
          validator will accept your invoice.
        </p>
        <p>
          Our rule coverage is a documented and growing subset of the applicable specifications, and
          standards change over time. You remain responsible for your own regulatory compliance and
          for verifying output before it is relied upon. For certification-grade assurance we
          recommend also running the official reference validator for your jurisdiction. What is and
          is not covered is published on our{' '}
          <Link href="/trust" className="text-accent-hi hover:underline">
            trust page
          </Link>{' '}
          and in the{' '}
          <Link href="/docs#rules" className="text-accent-hi hover:underline">
            documentation
          </Link>
          .
        </p>
      </Clause>

      <Clause n="8." title="Warranties and liability">
        <p>
          Except as expressly stated, the Service is provided &ldquo;as is&rdquo; without warranties
          of any kind, whether express or implied, including fitness for a particular purpose.
        </p>
        <p>
          Nothing in these terms limits liability for death or personal injury caused by negligence,
          for fraud or fraudulent misrepresentation, or for any other liability that cannot lawfully
          be limited.
        </p>
        <p>
          Subject to that, we are not liable for indirect or consequential loss, loss of profit,
          revenue, goodwill or data, or for fines or penalties imposed by any authority. Our total
          aggregate liability arising out of or in connection with these terms is limited to the
          greater of the fees you paid us in the 12 months before the event giving rise to the claim,
          or £100.
        </p>
      </Clause>

      <Clause n="9." title="The open-source library">
        <p>
          <code>@stampbench/core</code> and the <code>stampbench</code> CLI are provided under the
          MIT licence, which includes its own disclaimer of warranty and liability. These terms do
          not restrict your rights under that licence.
        </p>
      </Clause>

      <Clause n="10." title="Termination">
        <p>
          You may close your account at any time by emailing{' '}
          <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">
            hello@stampbench.com
          </a>{' '}
          from your account address. We may terminate or suspend
          access for material breach of these terms, for non-payment, or if we cease operating the
          Service — in the last case we will give as much notice as we reasonably can so you can
          migrate. On termination your right to use the hosted Service ends; the open-source library
          remains yours to use under its licence.
        </p>
      </Clause>

      <Clause n="11." title="Changes to these terms">
        <p>
          We may update these terms. For material changes we will give notice by email or in the
          dashboard before they take effect. Continuing to use the Service after that constitutes
          acceptance.
        </p>
      </Clause>

      <Clause n="12." title="Governing law">
        <p>
          These terms are governed by the laws of England and Wales, and the courts of England and
          Wales have exclusive jurisdiction. If
          you contract with us as a consumer rather than a business, mandatory protections of your
          country of residence still apply.
        </p>
      </Clause>

      <Clause n="13." title="Contact">
        <p>
          Harvey Legge, trading as Stampbench, <Fill>[postal address to follow]</Fill>, United
          Kingdom
          <br />
          Email:{' '}
          <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">
            hello@stampbench.com
          </a>
          <br />
          Not VAT registered.
        </p>
      </Clause>
    </LegalPage>
  );
}
