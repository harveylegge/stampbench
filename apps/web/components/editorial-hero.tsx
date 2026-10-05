import Link from 'next/link';
import type { Copy } from '@/lib/copy';
import { HolographicProof } from '@/components/holographic-proof';
import { WorkflowProof } from '@/components/workflow-proof';

export function EditorialHero({ copy }: { copy: Copy }) {
  const de = copy.locale === 'de';
  return (
    <section className="editorial-home editorial-home-motion" aria-labelledby="editorial-title">
      <div className="editorial-grid">
        <div className="editorial-motion-bg" aria-hidden="true">
          <video autoPlay muted loop playsInline preload="metadata">
            <source src="/brand/stampbench-hero-motion.mp4" type="video/mp4" />
          </video>
          <div className="editorial-motion-wash" />
          <div className="editorial-motion-label"><span>LIVE MATERIAL / 01</span><span>MOVE IN COLOUR</span></div>
        </div>
        <div className="editorial-copy">
          <p className="editorial-kicker"><i />{de ? 'WENIGER PAPIERKRAM. MEHR MÖGLICH.' : 'LESS PAPERWORK. MORE POSSIBILITY.'}</p>
          <h1 id="editorial-title">{de ? <>Gute Arbeit.<br />Richtig <em>abgerechnet.</em></> : <>Good work.<br />Properly <em>invoiced.</em></>}</h1>
          <p className="editorial-lede">{de ? 'Sie machen die Arbeit. Wir helfen, die Rechnung richtig zu machen.' : 'You do the work. We help you get the invoice right.'}<br />{de ? 'E-Rechnungen erstellen, prüfen und reparieren – ohne Komplexität.' : 'Create, check and fix e-invoices, without the complexity.'}</p>
          <div className="editorial-actions">
            <Link className="editorial-primary" href={de ? '/de/invoice-generator' : '/invoice-generator'}>{de ? 'Kostenlose Rechnung erstellen' : 'Create a free invoice'} <span>↗</span></Link>
            <Link className="editorial-link" href={de ? '/de/developers' : '/developers'}>{de ? 'Für Entwickler' : 'For developers'} <span>↗</span></Link>
          </div>
          <p className="editorial-fine">{de ? 'Fünf Rechnungen pro Monat kostenlos. Kein Konto nötig.' : 'Five invoices a month, free. No account needed.'}</p>
        </div>
        <div className="editorial-art">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand illustration */}
          <img src="/brand/hero-axonometric-cutout.png" alt={de ? 'Gezeichnete Rechnungen, Stempel und Büroklammer' : 'Architectural drawing of invoices, an approval stamp and paperclip'} />
          <div className="editorial-guides" aria-hidden><i /><i /><i /></div>
          <p><b>+</b><span>{de ? 'ETWAS MEHR ORDNUNG.' : 'A LITTLE ORDER.'}<br />{de ? 'VIEL WENIGER VERWALTUNG.' : 'A LOT LESS ADMIN.'}</span></p>
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
