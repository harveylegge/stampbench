'use client';

import { useEffect, useRef, useState } from 'react';

export function InvoiceJourney() {
  const journeyRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const node = journeyRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const hero = node.closest<HTMLElement>('.basalt-hero');
    const observer = new IntersectionObserver(([entry]) => {
      node.classList.toggle('is-paused', !entry.isIntersecting);
    }, { rootMargin: '160px 0px' });

    const followPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const rect = node.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      node.style.setProperty('--journey-rx', `${(0.5 - y) * 4.5}deg`);
      node.style.setProperty('--journey-ry', `${(x - 0.5) * 6}deg`);
      node.style.setProperty('--journey-shift-x', `${(x - 0.5) * 12}px`);
      node.style.setProperty('--journey-shift-y', `${(y - 0.5) * 8}px`);
      node.style.setProperty('--journey-glow-x', `${x * 100}%`);
      node.style.setProperty('--journey-glow-y', `${y * 100}%`);
    };
    const resetPointer = () => {
      node.style.setProperty('--journey-rx', '0deg');
      node.style.setProperty('--journey-ry', '0deg');
      node.style.setProperty('--journey-shift-x', '0px');
      node.style.setProperty('--journey-shift-y', '0px');
      node.style.setProperty('--journey-glow-x', '50%');
      node.style.setProperty('--journey-glow-y', '50%');
    };

    observer.observe(node);
    hero?.addEventListener('pointermove', followPointer, { passive: true });
    hero?.addEventListener('pointerleave', resetPointer);
    return () => {
      observer.disconnect();
      hero?.removeEventListener('pointermove', followPointer);
      hero?.removeEventListener('pointerleave', resetPointer);
    };
  }, []);

  return (
    <div
      ref={journeyRef}
      className={`invoice-journey${held ? ' is-held' : ''}`}
      data-invoice-journey
      role="button"
      tabIndex={0}
      aria-pressed={held}
      aria-label={held ? 'Resume the animated invoice journey' : 'Hold the animated invoice journey'}
      onClick={() => setHeld((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setHeld((current) => !current);
        }
      }}
    >
      <div className="journey-cursor-glow" aria-hidden="true" />
      <div className="journey-scene" aria-hidden="true">
        <div className="journey-drafting-field">
          <i /><i /><i /><i />
        </div>

        <div className="journey-document">
          <span className="journey-corner corner-tl" />
          <span className="journey-corner corner-tr" />
          <span className="journey-corner corner-bl" />
          <span className="journey-corner corner-br" />

          <svg className="journey-document-drawing" viewBox="0 0 340 440" role="presentation">
            <g className="journey-drawn-lines">
              <path d="M24 25H316" />
              <path d="M24 91H316" />
              <path d="M24 201H316" />
              <path d="M24 223H316" />
              <path d="M24 245H316" />
              <path d="M24 267H316" />
              <path d="M24 323H316" />
              <path d="M191 351H316" />
              <path d="M191 379H316" />
              <path d="M191 408H316" />
              <path d="M24 42H118" />
              <path d="M24 58H89" />
              <path d="M228 42H316" />
              <path d="M228 58H290" />
              <path d="M24 117H142" />
              <path d="M24 133H113" />
              <path d="M204 117H316" />
              <path d="M204 133H278" />
            </g>
            <g className="journey-drawn-type">
              <text x="24" y="18">STAMPBENCH / DOCUMENT</text>
              <text x="243" y="18">SB–001</text>
              <text x="24" y="84">FROM</text>
              <text x="204" y="84">BILL TO</text>
              <text x="24" y="188">DESCRIPTION</text>
              <text x="249" y="188">AMOUNT</text>
              <text x="191" y="344">SUBTOTAL</text>
              <text x="191" y="372">VAT</text>
              <text x="191" y="401">TOTAL</text>
              <text className="journey-total" x="279" y="402">£1,240</text>
            </g>
            <g className="journey-registration">
              <path d="M8 17V8h9M323 8h9v9M8 423v9h9M323 432h9v-9" />
              <path d="M170 2v12M164 8h12M170 426v12M164 432h12" />
            </g>
          </svg>
        </div>

        <div className="journey-stamp">
          <div className="journey-stamp-grip"><i /></div>
          <div className="journey-stamp-neck" />
          <div className="journey-stamp-base"><span>STAMPBENCH</span></div>
        </div>

        <div className="journey-checked">
          <span>✓</span>
          <strong>CHECKED</strong>
          <small>STAMPBENCH / EN 16931</small>
        </div>

        <div className="journey-workbench">
          <header>
            <span><i />STAMPBENCH / WORKBENCH</span>
            <small>SB–001</small>
          </header>
          <div className="journey-checking"><i />Checking invoice…</div>
          <ol>
            <li><span>01</span><b>EN 16931</b><em>✓</em></li>
            <li><span>02</span><b>Required fields</b><em>✓</em></li>
            <li><span>03</span><b>Totals</b><em>✓</em></li>
          </ol>
          <footer><span>VALIDATION COMPLETE</span><strong>READY TO SEND&nbsp; ↗</strong></footer>
        </div>

        <div className="journey-sent-document">
          <i /><i /><i />
          <b>✓ CHECKED</b>
        </div>
        <div className="journey-ink-trail"><i /><i /><i /></div>
      </div>
      <p className="journey-motion-key"><span>PAPER</span><i /><span>INK</span><i /><span>SOFTWARE</span></p>
      <span className="journey-interaction">{held ? 'HELD · CLICK TO CONTINUE' : 'MOVE TO INSPECT · CLICK TO HOLD'}</span>
    </div>
  );
}
