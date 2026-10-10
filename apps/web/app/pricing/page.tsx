import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Open-source core and integration pilot',
  description:
    'Run the MIT-licensed Stampbench validation core locally, or evaluate a fixed-scope £3,000 integration pilot for one software workflow.',
  alternates: { canonical: '/pricing' },
};

const pilotItems = [
  'One product and one staging integration path',
  'An agreed set of representative UBL or CII documents',
  'Structured rule IDs, business terms and source locations',
  'Written coverage and acceptance results',
  'Implementation handover and one technical workshop',
  '30 days of defect support for the delivered pilot scope',
] as const;

const questions = [
  {
    question: 'Why pay when the core is MIT licensed?',
    answer:
      'You do not need to pay Stampbench for permission to use the library. The pilot pays for defined integration work, testing against your representative invoices, diagnostic mapping and a documented handover.',
  },
  {
    question: 'Is £3,000 a permanent list price?',
    answer:
      'It is the initial test price for a tightly bounded pilot. Scope and acceptance criteria are agreed before work starts. Wider formats, additional products or custom national rules are quoted separately.',
  },
  {
    question: 'Does a pilot certify our invoices?',
    answer:
      'No. Stampbench implements a documented subset of supported EN 16931 and XRechnung rules. The pilot supplies validation tooling and test evidence, not legal advice, certification or a guarantee of recipient acceptance.',
  },
  {
    question: 'What happens after the pilot?',
    answer:
      'There is no automatic subscription. If continuing engineering support or shared infrastructure would be useful, it is scoped only after the pilot has established what your team actually needs.',
  },
] as const;

export default function PricingPage() {
  return (
    <main className="bg-[#f4efe3] text-[#20231f]">
      <section className="border-b border-[#20231f]/15 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#c7442d]">Commercial model / October 2026</p>
            <h1 className="mt-6 text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.98] tracking-[-0.055em]">Use the core freely. Pay for the integration work.</h1>
          </div>
          <p className="max-w-xl text-base leading-7 text-[#5f625b] lg:justify-self-end">Stampbench separates open-source validation from professional implementation. There is no artificial licence gate around the local engine.</p>
        </div>
      </section>

      <section className="border-b border-[#20231f]/15 px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-[1180px] border-l border-t border-[#20231f]/20 lg:grid-cols-2">
          <article className="border-r border-b border-[#20231f]/20 p-6 sm:p-8">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#777a72]">Open-source core</p>
            <div className="mt-8 flex items-baseline gap-2"><strong className="text-5xl font-semibold tracking-[-0.05em]">£0</strong><span className="text-sm text-[#686c64]">MIT licensed</span></div>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[#5f625b]">Install the TypeScript library or CLI, run validation locally and maintain the integration inside your own team.</p>
            <ul className="mt-7 space-y-3 border-t border-[#20231f]/15 pt-6 text-sm text-[#3f433c]">
              <li>UBL and CII syntax detection</li>
              <li>Documented EN 16931 and XRechnung rule coverage</li>
              <li>Structured findings and source locations</li>
              <li>No Java runtime or mandatory invoice upload</li>
            </ul>
            <Link href="/docs" className="mt-8 inline-block border-b border-[#20231f] pb-1 text-sm font-medium">Read integration docs ↗</Link>
          </article>

          <article className="border-r border-b border-[#20231f]/20 bg-[#eee8dc] p-6 sm:p-8">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#c7442d]">Founding integration pilot</p>
            <div className="mt-8 flex items-baseline gap-2"><strong className="text-5xl font-semibold tracking-[-0.05em]">£3,000</strong><span className="text-sm text-[#686c64]">test price · fixed scope</span></div>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[#5f625b]">Stampbench works with your engineering team to put the current validator into one real staging workflow and document the result.</p>
            <ul className="mt-7 space-y-3 border-t border-[#20231f]/15 pt-6 text-sm text-[#3f433c]">
              {pilotItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <a href="mailto:hello@stampbench.com?subject=Stampbench%20integration%20pilot" className="mt-8 inline-block rounded-[4px] bg-[#20231f] px-5 py-3.5 text-sm font-semibold text-[#fdfbf7]">Discuss a pilot ↗</a>
          </article>
        </div>
        <p className="mx-auto mt-6 max-w-[1180px] text-xs leading-5 text-[#686c64]">Managed hosting, private deployments and guaranteed response times are not sold as standard services today. Any continuing work is agreed only after a successful pilot.</p>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Questions, answered precisely.</h2>
          <div className="mt-8 border-t border-[#20231f]/20">
            {questions.map(({ question, answer }) => (
              <article key={question} className="grid gap-3 border-b border-[#20231f]/15 py-6 md:grid-cols-[.72fr_1.28fr] md:gap-10">
                <h3 className="text-sm font-semibold">{question}</h3>
                <p className="max-w-2xl text-sm leading-6 text-[#5f625b]">{answer}</p>
              </article>
            ))}
          </div>
          <p className="mt-10 text-sm text-[#5f625b]">Need to create an invoice rather than integrate validation? <Link href="/business" className="border-b border-[#20231f]/50 text-[#20231f]">Open Stampbench Business →</Link></p>
        </div>
      </section>
    </main>
  );
}
