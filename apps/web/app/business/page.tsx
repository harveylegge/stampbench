import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Stampbench Business: check and manage e-invoices',
  description: 'Create, check and keep compliant invoices with clear explanations and local-first validation.',
  alternates: { canonical: '/business' },
};

const checks = [
  ['01', 'Customer details', 'Names, addresses and identifiers'],
  ['02', 'Totals and VAT', 'Arithmetic checked before sending'],
  ['03', 'E-invoice structure', 'UBL or CII requirements explained'],
] as const;

export default function BusinessPage() {
  return (
    <div className="business-landing bg-[#f3eddf] text-[#20231f]">
      <section className="border-b border-[#20231f]/20">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-6 py-16 lg:grid-cols-[1fr_.86fr] lg:items-center lg:py-24">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b63d27]">Stampbench / Business</p>
            <h1 className="mt-6 max-w-[760px] text-[clamp(3.35rem,7vw,6.8rem)] font-medium leading-[.98] tracking-[-0.055em]">Invoices you can send with confidence.</h1>
            <p className="mt-8 max-w-[610px] text-lg leading-8 text-[#5e625b]">Create an invoice, check the important details and keep an organised local record. Stampbench handles the technical structure and explains anything that needs attention.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/invoice-generator" className="bg-[#20231f] px-6 py-3.5 text-center text-sm font-semibold text-[#f7f2e5]">Create an invoice</Link>
              <Link href="/my-invoices" className="border border-[#20231f]/35 px-6 py-3.5 text-center text-sm font-semibold">Open my invoices</Link>
            </div>
            <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#777a72]">Five invoices a month free · files checked locally</p>
          </div>

          <div className="border border-[#20231f]/35 bg-[#f8f3e7]">
            <div className="flex items-center justify-between border-b border-[#20231f]/20 px-5 py-4 font-mono text-[9px] uppercase tracking-[0.13em] text-[#74776f]">
              <span>Before you send</span><span>3 checks</span>
            </div>
            {checks.map(([number, title, detail]) => (
              <div key={number} className="grid grid-cols-[38px_1fr_auto] items-center gap-3 border-b border-[#20231f]/15 px-5 py-5 last:border-b-0">
                <span className="font-mono text-[9px] text-[#9a7a6e]">{number}</span>
                <div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-[#70736c]">{detail}</p></div>
                <span className="grid h-6 w-6 place-items-center border border-[#c7442d] text-xs text-[#c7442d]">✓</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-[#20231f]/20 bg-[#20231f] px-5 py-4 text-[#f4efe3]">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em]">Ready to review</span><span className="text-sm">Open invoice →</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#b63d27]">One clear workflow</p>
        <div className="mt-6 grid border-l border-t border-[#20231f]/20 md:grid-cols-3">
          {[
            ['01', 'Create or import', 'Start with the guided invoice form or bring in an existing structured invoice.'],
            ['02', 'Check before sending', 'See plain-language explanations for missing information, totals or compliance problems.'],
            ['03', 'Keep the evidence', 'Save the document locally and export a timestamped validation report when you need it.'],
          ].map(([number, title, body]) => (
            <div key={number} className="min-h-[230px] border-b border-r border-[#20231f]/20 bg-[#f8f3e7] p-6">
              <span className="font-mono text-[9px] text-[#b63d27]">{number}</span>
              <h2 className="mt-12 text-2xl font-medium tracking-[-0.035em]">{title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#676b64]">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-[#676b64]">Building invoicing into your own product? <Link href="/" className="border-b border-[#20231f]/50 text-[#20231f]">Explore Stampbench validation →</Link></p>
      </section>
    </div>
  );
}
