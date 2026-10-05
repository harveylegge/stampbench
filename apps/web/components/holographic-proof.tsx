'use client';

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

type CardVars = CSSProperties & {
  '--card-x': string;
  '--card-y': string;
  '--glow-x': string;
  '--glow-y': string;
};

const resting: CardVars = {
  '--card-x': '0deg',
  '--card-y': '0deg',
  '--glow-x': '50%',
  '--glow-y': '42%',
};

export function HolographicProof() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  function move(event: PointerEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!card) return;
    const area = event.currentTarget.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const x = (event.clientX - area.left) / area.width;
    const y = (event.clientY - area.top) / area.height;
    const glowX = Math.max(0, Math.min(100, ((event.clientX - cardBox.left) / cardBox.width) * 100));
    const glowY = Math.max(0, Math.min(100, ((event.clientY - cardBox.top) / cardBox.height) * 100));
    card.style.setProperty('--card-x', `${(0.5 - y) * 9}deg`);
    card.style.setProperty('--card-y', `${(x - 0.5) * 11}deg`);
    card.style.setProperty('--glow-x', `${glowX}%`);
    card.style.setProperty('--glow-y', `${glowY}%`);
  }

  function reset() {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--card-x', '0deg');
    card.style.setProperty('--card-y', '0deg');
    card.style.setProperty('--glow-x', '50%');
    card.style.setProperty('--glow-y', '42%');
  }

  function keyToggle(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setOpen((current) => !current);
  }

  return (
    <section className="proof-motion" aria-labelledby="proof-motion-title" onPointerMove={move} onPointerLeave={reset}>
      <div className="proof-motion-copy">
        <p className="editorial-kicker"><i />MOVE TO INSPECT</p>
        <h2 id="proof-motion-title">The standard,<br /><em>made tangible.</em></h2>
        <p>
          Move across the card to inspect the structure beneath an invoice. Every line resolves to
          a clear check before the document leaves your workbench.
        </p>
      </div>
      <div className="proof-stage">
        <div
          ref={cardRef}
          className={`proof-card${open ? ' is-open' : ''}`}
          style={resting}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={keyToggle}
          tabIndex={0}
          role="button"
          aria-pressed={open}
          aria-label={open ? 'Close Stampbench facts' : 'Reveal Stampbench facts and launch discount'}
        >
          <div className="proof-card-foil" aria-hidden />
          <div className="proof-card-top"><b>stampbench</b><span>№ 001</span></div>
          <div className="proof-card-mark" aria-hidden>
            <i /><i /><i /><i />
            <span>✓</span>
          </div>
          <div className="proof-card-copy">
            <small>INVOICE STRUCTURE</small>
            <strong>Checked.</strong>
            <p>Required fields · totals · syntax</p>
          </div>
          <div className="proof-card-foot"><span>EN 16931</span><span>LOCAL / PRIVATE</span></div>
          <div className="proof-card-facts" aria-hidden={!open}>
            <small>INSIDE THE BENCH / 03 FACTS</small>
            <ol>
              <li><b>01</b><span>Your invoice can be checked locally in the browser.</span></li>
              <li><b>02</b><span>The open-source core is published under the MIT licence.</span></li>
              <li><b>03</b><span>UBL and CII invoice structures are detected automatically.</span></li>
            </ol>
            <div><small>PAID-LAUNCH PERK</small><strong>BENCH10</strong><span>10% off the first 3 months when paid plans open.</span></div>
            <p>CLICK TO RETURN ↙</p>
          </div>
        </div>
        <p>{open ? 'CLICK TO CLOSE' : 'MOVE · CLICK TO REVEAL'} <span>↗</span></p>
      </div>
    </section>
  );
}
