import type { Metadata } from 'next';
import Link from 'next/link';
import { Fill } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Impressum / Legal notice',
  description: 'Anbieterkennzeichnung nach § 5 DDG — provider identification for InvoiceGate.',
};

/**
 * Germany requires a reachable "Impressum" (provider identification) on
 * commercial websites addressed to German users — § 5 DDG (formerly § 5 TMG),
 * plus § 18 MStV for journalistic content. Omitting or hiding it is a common
 * cause of Abmahnungen (formal warning letters with costs), which is why this
 * page exists before launch rather than after.
 *
 * DRAFT — every <Fill> must be replaced with real details, and the required
 * fields differ by legal form (sole trader vs GmbH vs UG). Have it checked.
 */

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Impressum</h1>
      <p className="mb-8 text-sm text-faint">
        Angaben gemäß § 5 DDG · Provider identification under German law
      </p>

      <div className="mb-8 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm leading-relaxed text-warning">
        This page must be completed with real details before the site is published to German
        users. An incomplete or missing Impressum is a common cause of formal warning letters
        (Abmahnungen).
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Diensteanbieter / Provider</h2>
        <p className="text-sm leading-relaxed text-muted">
          <Fill>[LEGAL NAME — for a sole trader: first and last name]</Fill>
          <br />
          <Fill>[Trading name, if used]</Fill>
          <br />
          <Fill>[Street and number]</Fill>
          <br />
          <Fill>[Post code and city]</Fill>
          <br />
          <Fill>[Country]</Fill>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Kontakt / Contact</h2>
        <p className="text-sm leading-relaxed text-muted">
          E-Mail: <Fill>[hello@invoicegate.dev]</Fill>
          <br />
          Telefon: <Fill>[phone number — required for direct electronic contact]</Fill>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-faint">
          German law requires a means of rapid electronic contact and direct communication. An email
          address alone is normally accepted only if responses are genuinely prompt; a telephone
          number or an equivalently responsive channel is the safer reading.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Registereintrag &amp; Umsatzsteuer / Registration &amp; VAT
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          <Fill>[Company register and number — omit if a sole trader with no registration]</Fill>
          <br />
          Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:{' '}
          <Fill>[VAT ID, or state that none is held]</Fill>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Verantwortlich für den Inhalt / Responsible for content
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          <Fill>[Name and address of the person responsible]</Fill>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Streitbeilegung / Dispute resolution
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We are neither willing nor obliged to participate in dispute resolution proceedings before
          a consumer arbitration board. (InvoiceGate is offered to businesses, not consumers.)
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Haftung / Liability</h2>
        <p className="text-sm leading-relaxed text-muted">
          InvoiceGate ist Entwicklerwerkzeug und stellt keine Rechts- oder Steuerberatung dar. Eine
          erfolgreiche Prüfung durch InvoiceGate ist keine Garantie dafür, dass eine Rechnung von
          einer Behörde, einem Kunden oder einem Zugangspunkt akzeptiert wird. Einzelheiten dazu
          finden Sie in unseren{' '}
          <Link href="/terms" className="text-accent-hi hover:underline">
            Nutzungsbedingungen
          </Link>{' '}
          und auf unserer{' '}
          <Link href="/trust" className="text-accent-hi hover:underline">
            Transparenzseite
          </Link>
          .
        </p>
      </section>

      <p className="mt-10 text-center text-sm text-faint">
        <Link href="/privacy" className="text-accent-hi hover:underline">
          Datenschutzerklärung
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className="text-accent-hi hover:underline">
          Nutzungsbedingungen
        </Link>
      </p>
    </div>
  );
}
