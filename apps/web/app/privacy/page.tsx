import type { Metadata } from 'next';
import Link from 'next/link';
import { Clause, Fill, LegalPage } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What personal data InvoiceGate processes, why, on what legal basis, who our sub-processors are, and how to exercise your GDPR rights.',
};

/**
 * DRAFT — NOT LEGAL ADVICE. Structured around UK GDPR / EU GDPR Art. 13-14
 * disclosure requirements because the target market is the EU. Replace every
 * <Fill> and have it reviewed by a qualified adviser before launch. If a
 * customer's invoice data includes personal data (it usually does), you are
 * their processor and will need a DPA/AVV — noted in clause 8.
 */

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="3 August 2026"
      intro={
        <p>
          This policy explains what personal data we process and why. The controller is{' '}
          <Fill>[LEGAL ENTITY NAME]</Fill>, <Fill>[REGISTERED ADDRESS]</Fill>. We have written it to
          be read, not to be survived — if anything here is unclear, ask us.
        </p>
      }
    >
      <Clause n="1." title="The short version">
        <ul>
          <li>We collect the minimum needed to run accounts, billing and usage limits.</li>
          <li>
            <strong className="text-text">We do not store the invoice documents you validate.</strong>{' '}
            They are processed in memory to produce a result and then discarded.
          </li>
          <li>We do not sell your data, and we do not train models on your invoice contents.</li>
          <li>We use a small, named set of sub-processors, listed in clause 6.</li>
        </ul>
      </Clause>

      <Clause n="2." title="What we collect and why">
        <p>
          <strong className="text-text">Account data</strong> — your email address, an optional
          name, and a bcrypt hash of your password. Purpose: to create and secure your account.
          Legal basis: performance of a contract.
        </p>
        <p>
          <strong className="text-text">Usage records</strong> — for each API call, a timestamp, the
          type of call, which API key was used, and whether the result was valid. Purpose: to
          enforce plan quotas, show you your usage, and detect abuse. Legal basis: performance of a
          contract and our legitimate interest in protecting the service.{' '}
          <strong className="text-text">These records do not contain your invoice contents.</strong>
        </p>
        <p>
          <strong className="text-text">Billing data</strong> — if you subscribe, our payment
          processor collects and holds your payment details. We store only a customer identifier and
          your plan status; we never see or store full card numbers. Legal basis: performance of a
          contract and our legal obligation to keep accounting records.
        </p>
        <p>
          <strong className="text-text">Technical logs</strong> — IP address, request timing and
          error information, used for security, rate limiting and debugging. Legal basis: legitimate
          interest. We do not log request bodies.
        </p>
      </Clause>

      <Clause n="3." title="Invoice content submitted to the API">
        <p>
          When you send a document to the validation or generation endpoints it is parsed in memory,
          checked against the rules, and the result is returned to you. The document itself is not
          written to our database and is not retained after the response. We keep only the metadata
          described above.
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
          If you use the optional explanation feature, the validation findings for that request —
          rule identifiers, business term references and our own message text — are sent to
          Anthropic for processing so that a plain-language fix list can be generated. The feature is
          opt-in per request. If you do not call that endpoint, no data is sent to Anthropic.
        </p>
      </Clause>

      <Clause n="5." title="Cookies">
        <p>
          We use a single strictly necessary cookie to keep you signed in. It is HttpOnly, SameSite
          and Secure. We do not use advertising or cross-site tracking cookies, so we do not show a
          consent banner for them. <Fill>[If analytics are added later, update this clause.]</Fill>
        </p>
      </Clause>

      <Clause n="6." title="Sub-processors">
        <p>We use these third parties to run the service:</p>
        <ul>
          <li>
            <strong className="text-text">Vercel</strong> — application hosting and delivery.
          </li>
          <li>
            <strong className="text-text">Neon</strong> — managed PostgreSQL database.
          </li>
          <li>
            <strong className="text-text">Stripe</strong> — payment processing (paid plans only).
          </li>
          <li>
            <strong className="text-text">Anthropic</strong> — AI explanations (only when you use
            that optional feature).
          </li>
          <li>
            <Fill>[Email provider, once transactional email is enabled]</Fill>
          </li>
        </ul>
        <p>
          We will update this list before adding a new sub-processor that handles personal data.
          Some of these providers may process data outside the UK/EEA; where they do, transfers rely
          on appropriate safeguards such as Standard Contractual Clauses.{' '}
          <Fill>[Confirm current hosting region and transfer mechanism.]</Fill>
        </p>
      </Clause>

      <Clause n="7." title="How long we keep it">
        <p>
          Account and usage data are kept while your account is open. If you delete your account,
          your account record, API keys, sessions and usage history are deleted immediately.
          Invoice documents are not retained at all. Billing and invoice records are kept for as
          long as tax law requires, typically six years.
        </p>
      </Clause>

      <Clause n="8." title="If you are a business customer processing personal data">
        <p>
          Invoices normally contain personal data about your customers. Where you send such data to
          our hosted API, you are the controller and we act as your processor. A data processing
          agreement (Auftragsverarbeitungsvertrag) is available —{' '}
          <Fill>[status: in preparation; contact us]</Fill>. Using the open-source library locally
          avoids this question entirely, since no data reaches us.
        </p>
      </Clause>

      <Clause n="9." title="Your rights">
        <p>
          Under UK and EU data protection law you may request access to your personal data, request
          correction or deletion, object to or restrict processing, and request portability. You can
          delete your account and its data yourself at any time from Settings.
        </p>
        <p>
          To exercise any right, email <Fill>[privacy@invoicegate.dev]</Fill>. We aim to respond
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
