import type { Metadata } from 'next';
import Link from 'next/link';
import { Fill } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Impressum / Legal notice',
  description: 'Anbieterkennzeichnung nach § 5 DDG — provider identification for Stampbench.',
};

/**
 * Germany requires a reachable "Impressum" (provider identification) on
 * commercial websites addressed to German users — § 5 DDG (formerly § 5 TMG),
 * plus § 18 MStV for journalistic content. Omitting or hiding it is a common
 * cause of Abmahnungen (formal warning letters with costs), which is why this
 * page exists before launch rather than after.
 *
 * 2026-08-07: filled in for Harvey Legge, sole trader, trading as Stampbench.
 * Remaining <Fill>s are ONLY the postal address and phone number (virtual
 * office pending — Harvey supplies both). Then have the page checked by a
 * solicitor; the required fields differ by legal form.
 */

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Impressum</h1>
      <p className="mb-8 text-sm text-faint">
        Angaben gemäß § 5 DDG · Provider identification under German law
      </p>

      <div className="mb-8 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm leading-relaxed text-warning">
        The postal address and telephone number below are being finalised and will be added
        shortly. Until they are, this Impressum is incomplete under § 5 DDG.
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Diensteanbieter / Provider</h2>
        <p className="text-sm leading-relaxed text-muted">
          Harvey Legge
          <br />
          handelnd unter der Bezeichnung &bdquo;Stampbench&ldquo; / trading as Stampbench
          <br />
          <Fill>[Straße und Hausnummer — folgt in Kürze]</Fill>
          <br />
          <Fill>[Postleitzahl und Ort — folgt in Kürze]</Fill>
          <br />
          Vereinigtes Königreich / United Kingdom
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Kontakt / Contact</h2>
        <p className="text-sm leading-relaxed text-muted">
          E-Mail:{' '}
          <a href="mailto:hello@stampbench.com" className="text-accent-hi hover:underline">
            hello@stampbench.com
          </a>
          <br />
          Telefon: <Fill>[Telefonnummer — folgt in Kürze]</Fill>
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
          Einzelunternehmer nach britischem Recht; kein Registereintrag. / Sole trader under UK
          law; no company registration.
          <br />
          Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: keine vorhanden / none held.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Verantwortlich für den Inhalt / Responsible for content
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Harvey Legge, <Fill>[Anschrift wie oben — folgt in Kürze]</Fill>
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
          a consumer arbitration board. (Stampbench is offered to businesses, not consumers.)
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Haftung / Liability</h2>
        <p className="text-sm leading-relaxed text-muted">
          Stampbench ist Entwicklerwerkzeug und stellt keine Rechts- oder Steuerberatung dar. Eine
          erfolgreiche Prüfung durch Stampbench ist keine Garantie dafür, dass eine Rechnung von
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
