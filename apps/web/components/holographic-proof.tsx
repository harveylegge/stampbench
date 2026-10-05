'use client';

import type { CSSProperties, PointerEvent } from 'react';

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
  function move(event: PointerEvent<HTMLDivElement>) {
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    card.style.setProperty('--card-x', `${(0.5 - y) * 9}deg`);
    card.style.setProperty('--card-y', `${(x - 0.5) * 11}deg`);
    card.style.setProperty('--glow-x', `${x * 100}%`);
    card.style.setProperty('--glow-y', `${y * 100}%`);
  }

  function reset(event: PointerEvent<HTMLDivElement>) {
    const card = event.currentTarget;
    card.style.setProperty('--card-x', '0deg');
    card.style.setProperty('--card-y', '0deg');
    card.style.setProperty('--glow-x', '50%');
    card.style.setProperty('--glow-y', '42%');
  }

  return (
    <section className="proof-motion" aria-labelledby="proof-motion-title">
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
          className="proof-card"
          style={resting}
          onPointerMove={move}
          onPointerLeave={reset}
          tabIndex={0}
          role="img"
          aria-label="Interactive Stampbench compliance card showing an invoice checked against EN 16931"
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
        </div>
        <p>MOVE TO REVEAL <span>↗</span></p>
      </div>
    </section>
  );
}
