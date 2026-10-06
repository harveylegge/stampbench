import Link from 'next/link';
import type { Copy } from '@/lib/copy';
import { WorkflowProof } from '@/components/workflow-proof';
import { StampbenchMark } from '@/components/logo';
import { InvoiceJourney } from '@/components/invoice-journey';

export function EditorialHero({ copy }: { copy: Copy }) {
  const de = copy.locale === 'de';
  return (
    <section className="editorial-home editorial-home-motion" aria-labelledby="editorial-title">
      <div className="basalt-hero">
        <div className="aurora-field" aria-hidden><i /><i /><i /><b /></div>
        <nav className="basalt-nav" aria-label="Homepage navigation">
          <Link className="basalt-brand" href="/"><span className="basalt-logo"><StampbenchMark size={22} /></span><strong>Stampbench</strong></Link>
          <div><Link href="/pricing">Pricing</Link><Link href="/trust">Standards</Link><Link href="/my-invoices">My invoices</Link></div>
          <span><Link className="basalt-nav-workbench" href="/invoice-generator">Create a free invoice</Link><Link className="basalt-nav-cta" href="/developers">Build with the API</Link></span>
        </nav>
        <div className="basalt-layout">
          <div className="basalt-copy">
            <p className="basalt-overline">STAMPBENCH FOR DESKTOP / COMING SOON</p>
            <h1 id="editorial-title">Good work.<br />Properly <em>invoiced.</em></h1>
            <p>Create, check and keep compliant invoices in one focused workbench—without learning the rulebook.</p>
            <div className="basalt-actions">
              <Link href="/signup?download=windows"><span className="platform-mark" aria-hidden><svg viewBox="0 0 20 20"><path d="M2.5 3.5 9 2.6v6.6H2.5V3.5Zm7.5-1L17.5 1.5v7.7H10V2.5ZM2.5 10.2H9v6.7l-6.5-.9v-5.8Zm7.5 0h7.5v7.8L10 17v-6.8Z" /></svg></span> Download for Windows</Link>
              <Link href="/signup?download=mac"><span className="platform-mark" aria-hidden><svg viewBox="0 0 20 20"><path d="M13.3 3.2c.8-1 2-1.6 3.1-1.7.1 1.2-.3 2.4-1 3.2-.8.9-1.9 1.5-3 1.4-.2-1.1.3-2.2.9-2.9Zm4.7 10.5c-.5 1.2-.8 1.7-1.5 2.8-1 1.5-2.3 3.3-4 3.3-1.4 0-1.8-1-3.7-1s-2.4 1-3.8 1c-1.7 0-2.9-1.6-3.9-3.1C-1.5 12.8-.4 7 3.6 6.9c1.6 0 2.6 1.1 3.9 1.1 1.2 0 2-1.1 3.8-1.1 1.5 0 3.1.8 4.1 2.2-3.6 2-3 7 .6 8.6Z" transform="scale(.8) translate(2 0)" /></svg></span> Download for Mac</Link>
            </div>
            <small>JOIN THE APP WAITLIST · KEEP USING THE WEB WORKBENCH FREE</small>
          </div>
          <InvoiceJourney />
        </div>
      </div>
      <div className="editorial-standards" aria-label={de ? 'Unterstützte Standards' : 'Supported standards'}>
        <div className="editorial-standards-track">
          {[0, 1].map((copyIndex) => (
            <div className="editorial-standards-set" key={copyIndex} aria-hidden={copyIndex === 1}>
              <span>{de ? 'KOMPLEXE STANDARDS. EINFACHE ERFAHRUNG.' : 'COMPLEX STANDARDS. SIMPLE EXPERIENCE.'}</span>
              <b>EN 16931</b><i>◆</i><b>XRechnung</b><i>◆</i><b>UBL + CII</b><i>◆</i>
              <span>{de ? 'IM BROWSER GEPRÜFT. IHRE DATEIEN BLEIBEN IHRE.' : 'CHECKED IN YOUR BROWSER. YOUR FILES STAY YOURS.'}</span>
              <i>◆</i>
            </div>
          ))}
        </div>
      </div>
      <WorkflowProof />
      <div className="cream-home-sections">
        <section className="cream-two-doors" aria-labelledby="two-doors-title">
          <h2 id="two-doors-title">One careful engine.<br /><em>Two simple ways in.</em></h2>
          <div className="cream-door-grid">
            <Link href="/invoice-generator"><small>01 / FOR YOUR BUSINESS</small><h3>Create the invoice.</h3><p>Fill in familiar details. Stampbench checks the structure, totals and required fields before download.</p><span>Open the workbench ↗</span></Link>
            <Link href="/developers"><small>02 / FOR YOUR SOFTWARE</small><h3>Build on the engine.</h3><p>Use the TypeScript library, CLI or hosted API with clear rule IDs and source locations.</p><span>Explore the platform ↗</span></Link>
          </div>
        </section>
        <section className="cream-process" aria-labelledby="process-title">
          <div><p className="editorial-kicker"><i />HOW IT MOVES</p><h2 id="process-title">From work done<br /><em>to invoice ready.</em></h2></div>
          <ol><li><b>01</b><span><strong>Add the details.</strong>Customer, work, totals and payment terms.</span></li><li><b>02</b><span><strong>Check the standard.</strong>Clear findings without compliance jargon.</span></li><li><b>03</b><span><strong>Download and keep moving.</strong>PDF plus the structured file systems need.</span></li></ol>
        </section>
        <section className="cream-close"><p className="editorial-kicker">PRIVATE BY DESIGN / OPEN TO INSPECTION</p><h2>Less admin.<br /><em>More good work.</em></h2><p>Local-first checking, published test evidence and honest limits.</p><div><Link className="editorial-primary" href="/invoice-generator">Create a free invoice <span>↗</span></Link><Link className="editorial-link" href="/trust">See the evidence <span>↗</span></Link></div></section>
      </div>
    </section>
  );
}
