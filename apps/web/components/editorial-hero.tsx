import Link from 'next/link';
import type { Copy } from '@/lib/copy';
import { HolographicProof } from '@/components/holographic-proof';
import { WorkflowProof } from '@/components/workflow-proof';
import { StampbenchMark } from '@/components/logo';

export function EditorialHero({ copy }: { copy: Copy }) {
  const de = copy.locale === 'de';
  return (
    <section className="editorial-home editorial-home-motion" aria-labelledby="editorial-title">
      <div className="basalt-hero">
        <div className="aurora-field" aria-hidden><i /><i /><i /><b /></div>
        <nav className="basalt-nav" aria-label="Homepage navigation">
          <Link className="basalt-brand" href="/"><StampbenchMark size={20} /><strong>Stampbench</strong></Link>
          <div><Link href="/invoice-generator">Workbench</Link><Link href="/developers">Developers</Link><Link href="/pricing">Pricing</Link><Link href="/trust">Standards</Link></div>
          <span><Link href="/signin">Log in</Link><Link className="basalt-nav-cta" href="/signup">Create account</Link></span>
        </nav>
        <div className="basalt-copy">
          <p className="basalt-chip">✦ BUILT FOR WORK THAT NEEDS TO GET PAID</p>
          <h1 id="editorial-title">Everything you invoice,<br /><em>one careful check</em> away.</h1>
          <p>Create, validate and keep compliant invoices in one focused workbench—without learning the rulebook.</p>
          <div className="basalt-actions"><Link href="/invoice-generator">Create a free invoice <span>↗</span></Link><Link href="/developers">Build with the API <span>↗</span></Link></div>
          <small>FIVE INVOICES A MONTH · FREE · NO ACCOUNT NEEDED</small>
        </div>
        <div className="invoice-command" aria-label="Example Stampbench invoice check">
          <div className="command-search"><span>⌕</span><b>check invoice SB-001</b><i /><small>WORKBENCH</small></div>
          <ul>
            <li className="active"><span>✓</span><b>Invoice ready to send</b><kbd>PASS</kbd></li>
            <li><span>↗</span><b>EN 16931 structure</b><kbd>CHECKED</kbd></li>
            <li><span>£</span><b>Totals and required fields</b><kbd>VALID</kbd></li>
            <li><span>↓</span><b>Download PDF + structured file</b><kbd>READY</kbd></li>
          </ul>
          <footer><span>↑↓ REVIEW&nbsp;&nbsp; ↵ OPEN&nbsp;&nbsp; ESC CLOSE</span><b><StampbenchMark size={13} /> STAMPBENCH</b></footer>
        </div>
        <Link className="basalt-more" href="/invoice-generator">Open the workbench →</Link>
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
        <HolographicProof />
        <section className="cream-process" aria-labelledby="process-title">
          <div><p className="editorial-kicker"><i />HOW IT MOVES</p><h2 id="process-title">From work done<br /><em>to invoice ready.</em></h2></div>
          <ol><li><b>01</b><span><strong>Add the details.</strong>Customer, work, totals and payment terms.</span></li><li><b>02</b><span><strong>Check the standard.</strong>Clear findings without compliance jargon.</span></li><li><b>03</b><span><strong>Download and keep moving.</strong>PDF plus the structured file systems need.</span></li></ol>
        </section>
        <section className="cream-close"><p className="editorial-kicker">PRIVATE BY DESIGN / OPEN TO INSPECTION</p><h2>Less admin.<br /><em>More good work.</em></h2><p>Local-first checking, published test evidence and honest limits.</p><div><Link className="editorial-primary" href="/invoice-generator">Create a free invoice <span>↗</span></Link><Link className="editorial-link" href="/trust">See the evidence <span>↗</span></Link></div></section>
      </div>
    </section>
  );
}
