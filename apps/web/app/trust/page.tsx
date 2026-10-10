import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Our standards: invoices checked clearly',
  description:
    'How Stampbench checks invoice details, totals and e-invoicing requirements while keeping your work private.',
};

const assurances = [
  {
    number: '01',
    title: 'The important details are there.',
    body: 'Stampbench checks the customer, invoice number, dates, payment details and the other information the chosen invoice needs.',
  },
  {
    number: '02',
    title: 'The numbers add up.',
    body: 'Line totals, tax and the amount due are calculated together, so the PDF and the digital invoice carry the same figures.',
  },
  {
    number: '03',
    title: 'Your work stays private.',
    body: 'The free workbench checks the invoice in your browser. Your invoice content is not uploaded just to create or check it.',
  },
];

export default function TrustPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
      <section className="border-b border-border pb-14 sm:pb-20">
        <p className="mb-5 text-[10px] font-semibold tracking-[0.18em] text-accent-hi">
          OUR STANDARDS / PLAINLY EXPLAINED
        </p>
        <h1 className="max-w-4xl text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-6xl">
          You make the invoice.<br />
          <span className="font-serif font-normal italic text-accent-hi">We check the careful bits.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          You should not need to learn a rulebook to bill a customer. Stampbench checks the details,
          totals and digital format in the background, then explains anything that needs attention in
          ordinary language.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            href="/invoice-generator"
            className="bg-accent px-5 py-4 font-semibold text-white shadow-[3px_3px_0_#9e311b] transition hover:-translate-y-0.5"
          >
            Create a free invoice <span>↗</span>
          </Link>
          <Link href="/docs" className="editorial-link">
            Technical documentation <span>↗</span>
          </Link>
        </div>
      </section>

      <section className="py-14 sm:py-20" aria-labelledby="checked-title">
        <p className="mb-4 text-[10px] font-semibold tracking-[0.18em] text-muted">WHAT GETS CHECKED</p>
        <h2 id="checked-title" className="max-w-2xl text-3xl font-medium tracking-[-0.04em] sm:text-5xl">
          A second pair of eyes for every invoice.
        </h2>
        <div className="mt-10 grid border border-border sm:grid-cols-3">
          {assurances.map((item, index) => (
            <article
              key={item.number}
              className={`min-h-64 p-7 ${index ? 'border-t border-border sm:border-l sm:border-t-0' : ''}`}
            >
              <span className="text-xs font-semibold text-accent-hi">{item.number}</span>
              <h3 className="mt-10 text-xl font-medium tracking-tight">{item.title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-10 border-y border-border py-14 sm:grid-cols-[0.8fr_1.2fr] sm:py-20">
        <div>
          <p className="mb-4 text-[10px] font-semibold tracking-[0.18em] text-muted">THE NAMES YOU MAY SEE</p>
          <h2 className="text-3xl font-medium tracking-[-0.04em] sm:text-4xl">Standards without the homework.</h2>
        </div>
        <div className="space-y-7 text-sm leading-relaxed text-muted">
          <div>
            <h3 className="mb-1 text-base font-medium text-text">EN 16931</h3>
            <p>The shared European model for what a digital invoice needs to contain.</p>
          </div>
          <div>
            <h3 className="mb-1 text-base font-medium text-text">XRechnung</h3>
            <p>The German e-invoice rules used by public authorities and many businesses.</p>
          </div>
          <div>
            <h3 className="mb-1 text-base font-medium text-text">UBL + CII</h3>
            <p>Two file languages accounting systems use. Stampbench handles the technical choice for you.</p>
          </div>
          <p className="border-l-2 border-accent pl-4 text-text">
            If a customer asks for a structured or compliant invoice, choose where you are based and
            Stampbench selects the suitable setup. You can still review it before downloading.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <p className="mb-4 text-[10px] font-semibold tracking-[0.18em] text-muted">EVIDENCE, NOT A SLOGAN</p>
        <h2 className="text-3xl font-medium tracking-[-0.04em] sm:text-5xl">Checked, tested and honest about the limits.</h2>
        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-5">
            <strong className="text-3xl font-medium">394</strong>
            <span className="mt-2 block text-sm text-muted">automated tests across the product</span>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <strong className="text-3xl font-medium">86</strong>
            <span className="mt-2 block text-sm text-muted">official test documents exercised</span>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <strong className="text-3xl font-medium">0</strong>
            <span className="mt-2 block text-sm text-muted">crashes in that official corpus</span>
          </div>
        </div>

        <details className="mt-6 rounded-xl border border-border bg-surface p-5">
          <summary className="cursor-pointer text-sm font-medium">Read the technical evidence and current limits</summary>
          <div className="mt-5 space-y-4 border-t border-border pt-5 text-sm leading-relaxed text-muted">
            <p>
              The suite covers the core library, command-line tool and web application. We also run
              45 UBL and 41 CII documents from the official XRechnung test corpus through the engine.
              Eighty-three are accepted and three are deliberately published as open compatibility questions.
            </p>
            <p>
              Stampbench implements a documented subset of the full ruleset. It does not claim SOC 2,
              ISO 27001 certification or complete KoSIT parity today. Passing a check is useful evidence,
              not legal advice or a guarantee that every recipient will accept a document.
            </p>
            <p>
              Developers and auditors can inspect the exact rule coverage, versions and response metadata in the{' '}
              <Link href="/docs#rules" className="text-accent-hi hover:underline">technical documentation</Link>.
            </p>
          </div>
        </details>
      </section>
    </main>
  );
}
