import Link from 'next/link';
import type { Copy } from '@/lib/copy';
import { WorkflowProof } from '@/components/workflow-proof';
import { StampbenchMark } from '@/components/logo';
import { WorkbenchPass } from '@/components/workbench-pass';

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
              <Link href="/signup?download=mac"><span className="platform-mark" aria-hidden><svg viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35-.07 2.29.74 3.08.74.76 0 2.11-.91 3.61-.77.63.03 2.41.25 3.55 1.92-.09.06-2.12 1.22-2.09 3.69.03 2.95 2.58 3.93 2.61 3.94-.02.07-.41 1.42-1.34 2.82-.81 1.2-1.66 2.39-3 2.42-1.31.03-1.74-.77-3.24-.77-1.51 0-1.98.74-3.22.8-1.29.05-2.27-1.29-3.1-2.49-1.69-2.44-2.98-6.9-1.25-9.92.86-1.5 2.4-2.45 4.07-2.48 1.27-.03 2.47.86 3.24.86.77 0 2.22-1.06 3.74-.9.64.03 2.41.26 3.55 1.93-3.18 1.85-2.67 6.41.55 7.7-.25.74-.58 1.45-.99 2.07M15.99 3.3c.68-.82 1.14-1.96 1.01-3.09-.98.04-2.17.65-2.86 1.47-.62.71-1.16 1.87-1.02 2.98 1.09.08 2.2-.55 2.87-1.36" /></svg></span> Download for Mac</Link>
            </div>
            <small>JOIN THE APP WAITLIST · KEEP USING THE WEB WORKBENCH FREE</small>
          </div>
          <WorkbenchPass />
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
