import type { Metadata } from 'next';
import Link from 'next/link';
import { Clause, Fill, LegalPage } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What personal data Stampbench processes, why, on what legal basis, who our sub-processors are, and how to exercise your GDPR rights.',
};

/**
 * NOT LEGAL ADVICE. Structured around UK GDPR / EU GDPR Art. 13-14 disclosure
 * requirements because the target market is the EU. 2026-08-07: rewritten to
 * match the shipped architecture (Cloudflare Pages worker + D1, no Stripe,
 * manual upgrades, shared reports) and Harvey's details filled in. Remaining
 * <Fill>s are ONLY the postal address (virtual office pending) — plus the
 * still-outstanding solicitor review before signups are actively promoted.
 */

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="7 August 2026"
      intro={
        <p>
          This policy explains what personal data we process and why. The controller is Harvey
          Legge, trading as Stampbench, <Fill>[postal address to follow]</Fill>, United Kingdom. We
          have written it to be read, not to be survived — if anything here is unclear, ask us.
        </p>
      }
    >
      <Clause n="1." title="The short version">
        <ul>
          <li>We collect the minimum needed to run accounts and usage limits.</li>
          <li>
            <strong className="text-text">We do not store the invoice documents you validate.</strong>{' '}
            Playground validation runs entirely in your browser; API documents are processed in
            memory to produce a result and then discarded.
          </li>
          <li>
            If you choose to <strong className="text-text">share a report</strong>, we store that
            report — the verdict and rule violations, whose messages can quote specific values from
            the document — until you or we delete it. Sharing never happens automatically.
          </li>
          <li>We do not sell your data, and we do not train models on your invoice contents.</li>
          <li>We use a small, named set of sub-processors, listed in clause 6.</li>
        </ul>
      </Clause>

      <Clause n="2." title="What we collect and why">
        <p>
          <strong className="text-text">Account data</strong> — your email address and a salted
          PBKDF2 hash of your password (we never store the password itself). Purpose: to create and
          secure your account. Legal basis: performance of a contract.
        </p>
        <p>
          <strong className="text-text">Usage records</strong> — monthly counters per feature
          (hosted API calls, shared reports, ruleset checks) and a last-used timestamp per API key.
          We do not keep a per-call log of what you sent.{' '}
          <strong className="text-text">These records do not contain your invoice contents.</strong>{' '}
          Purpose: to enforce plan quotas and show you your usage. Legal basis: performance of a
          contract.
        </p>
        <p>
          <strong className="text-text">Shared reports</strong> — created only when you press
          &ldquo;Share report&rdquo;: the verdict and the list of rule violations. Violation
          messages can quote individual values from the document (for example an amount that fails
          an arithmetic rule), so share a report only if you are comfortable with the recipient
          seeing those. Anyone with the link can view it. Legal basis: performance of a contract.
        </p>
        <p>
          <strong className="text-text">Plan and upgrade data</strong> — your current plan and any
          upgrade request you make. We take no payment details on the site; paid plans are arranged
          by email, and this policy will be updated before any payment processor is added. Legal
          basis: performance of a contract and our legal obligation to keep accounting records for
          invoices we issue.
        </p>
        <p>
          <strong className="text-text">Technical logs</strong> — our infrastructure provider
          (Cloudflare) processes IP addresses and request metadata at its edge to deliver the site
          and defend it; we see aggregate statistics, not a browsing log, and we do not log request
          bodies. Legal basis: legitimate interest.
        </p>
      </Clause>

      <Clause n="3." title="Invoice content submitted to the API">
        <p>
          The playground on this website validates, repairs and generates documents{' '}
          <strong className="text-text">entirely in your browser</strong> — the XML never reaches
          our servers at all. When you send a document to the hosted API endpoints it is parsed in
          memory, checked against the rules, and the result is returned to you. The document itself
          is not written to our database and is not retained after the response. We keep only the
          metadata described above.
        </p>
        <p>
          If you would prefer that invoice data never leaves your infrastructure at all, use the
          open-source library, which runs entirely locally with no telemetry. See{' '}
          <Link href="/security" className="text-accent-hi hover:underline">
            Security
          </Link>
          .
        </p>
      </Clause>

      <Clause n="4." title="AI-generated explanations (optional)">
        <p>
          The hosted AI-explanation feature is{' '}
          <strong className="text-text">not currently enabled</strong>. From the day it launches:
          the validation findings for that request — rule identifiers, business term references and
          our own message text — are sent to Anthropic for processing so that a plain-language fix
          list can be generated, opt-in per request. If you do not use that feature, no data is
          sent to Anthropic. We will update this policy when it goes live.
        </p>
      </Clause>

      <Clause n="5." title="Cookies">
        <p>
          We use a single strictly necessary cookie to keep you signed in. It is HttpOnly, SameSite
          and Secure. We do not use advertising or cross-site tracking cookies, so we do not show a
          consent banner for them. We also run no analytics scripts at all — traffic is measured as
          aggregate request counts at our infrastructure provider&apos;s edge, with no cookies and
          nothing executing in your browser.
        </p>
      </Clause>

      <Clause n="6." title="Sub-processors">
        <p>We use these third parties to run the service:</p>
        <ul>
          <li>
            <strong className="text-text">Cloudflare</strong> — website hosting and delivery, the
            account database (Cloudflare D1), and email routing/delivery for our
            @stampbench.com addresses.
          </li>
          <li>
            <strong className="text-text">Anthropic</strong> — AI explanations, applicable only
            once that optional feature is enabled (see clause 4).
          </li>
        </ul>
        <p>
          We will update this list before adding a new sub-processor that handles personal data.
          Cloudflare operates a global edge network, so requests may be handled outside the UK/EEA;
          such transfers rely on Cloudflare&apos;s Standard Contractual Clauses and the UK
          Addendum.
        </p>
      </Clause>

      <Clause n="7." title="How long we keep it">
        <p>
          Account and usage data are kept while your account is open. To close your account, email{' '}
          <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">
            hello@stampbench.com
          </a>{' '}
          from your account address and we will delete your account record, API keys, usage history
          and shared reports promptly — self-serve deletion is coming. Individual shared reports
          are also deleted on request. Invoice documents are not retained at all. Records of
          invoices we issue to paying customers are kept for as long as tax law requires, typically
          six years.
        </p>
      </Clause>

      <Clause n="8." title="If you are a business customer processing personal data">
        <p>
          Invoices normally contain personal data about your customers. Where you send such data to
          our hosted API, you are the controller and we act as your processor. A data processing
          agreement (Auftragsverarbeitungsvertrag) is in preparation — contact us at{' '}
          <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">
            hello@stampbench.com
          </a>{' '}
          if you need one. Using the open-source library locally avoids this question entirely,
          since no data reaches us.
        </p>
      </Clause>

      <Clause n="9." title="Your rights">
        <p>
          Under UK and EU data protection law you may request access to your personal data, request
          correction or deletion, object to or restrict processing, and request portability.
        </p>
        <p>
          To exercise any right, email{' '}
          <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">
            hello@stampbench.com
          </a>
          . We aim to respond
          within 30 days. If you believe we have handled your data improperly you may complain to
          your supervisory authority — in the UK, the Information Commissioner&apos;s Office; in
          Germany, your state data protection authority.
        </p>
      </Clause>

      <Clause n="10." title="Changes">
        <p>
          We will update this policy as the service evolves and will change the date at the top. For
          material changes affecting how we use personal data, we will notify account holders by
          email.
        </p>
      </Clause>
    </LegalPage>
  );
}
