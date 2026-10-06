'use client';

import { useEffect, useRef, useState } from 'react';

export function WorkbenchPass() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [personalised, setPersonalised] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage) return;

    const hero = stage.closest<HTMLElement>('.basalt-hero');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const followPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || reducedMotion.matches) return;
      const bounds = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      stage.style.setProperty('--pass-rx', `${(0.5 - y) * 12}deg`);
      stage.style.setProperty('--pass-ry', `${(x - 0.5) * 17}deg`);
      stage.style.setProperty('--pass-shift-x', `${(x - 0.5) * 18}px`);
      stage.style.setProperty('--pass-shift-y', `${(y - 0.5) * 12}px`);
      stage.style.setProperty('--pass-light-x', `${x * 100}%`);
      stage.style.setProperty('--pass-light-y', `${y * 100}%`);
    };

    const resetPointer = () => {
      stage.style.setProperty('--pass-rx', '0deg');
      stage.style.setProperty('--pass-ry', '0deg');
      stage.style.setProperty('--pass-shift-x', '0px');
      stage.style.setProperty('--pass-shift-y', '0px');
      stage.style.setProperty('--pass-light-x', '50%');
      stage.style.setProperty('--pass-light-y', '42%');
    };

    const syncMotionPreference = () => {
      if (!video) return;
      if (reducedMotion.matches) video.pause();
      else void video.play().catch(() => undefined);
    };

    const observer = new IntersectionObserver(([entry]) => {
      stage.classList.toggle('is-offscreen', !entry.isIntersecting);
      if (!video || reducedMotion.matches) return;
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    }, { rootMargin: '160px 0px' });

    observer.observe(stage);
    hero?.addEventListener('pointermove', followPointer, { passive: true });
    hero?.addEventListener('pointerleave', resetPointer);
    reducedMotion.addEventListener('change', syncMotionPreference);
    syncMotionPreference();

    return () => {
      observer.disconnect();
      hero?.removeEventListener('pointermove', followPointer);
      hero?.removeEventListener('pointerleave', resetPointer);
      reducedMotion.removeEventListener('change', syncMotionPreference);
    };
  }, []);

  const togglePersonalised = () => setPersonalised((current) => !current);

  return (
    <div
      ref={stageRef}
      className={`workbench-pass-stage${personalised ? ' is-personalised' : ''}`}
      data-workbench-pass
      role="button"
      tabIndex={0}
      aria-pressed={personalised}
      aria-label="Interactive Stampbench Workbench pass"
      aria-describedby="workbench-pass-instruction"
      onClick={togglePersonalised}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          togglePersonalised();
        }
      }}
    >
      <video
        ref={videoRef}
        className="workbench-pass-film"
        autoPlay
        muted
        loop
        playsInline
        poster="/media/workbench-pass-poster.webp"
        aria-hidden="true"
      >
        <source src="/media/workbench-pass.webm" type="video/webm" />
        <source src="/media/workbench-pass.mp4" type="video/mp4" />
      </video>
      <div className="workbench-pass-atmosphere" aria-hidden="true" />
      <div className="workbench-pass-registration" aria-hidden="true"><i /><i /><i /><i /></div>

      <div className="workbench-pass-motion" aria-hidden="true">
        <div className="workbench-pass-card">
          <div className="workbench-pass-face workbench-pass-front">
            <div className="workbench-pass-shine" />
            <header><span><i />STAMPBENCH / WORKBENCH</span><small>SB–001</small></header>
            <div className="pass-checking"><i />Checking invoice…</div>
            <ol>
              <li><span>01</span><b>EN 16931</b><em>✓</em></li>
              <li><span>02</span><b>Required fields</b><em>✓</em></li>
              <li><span>03</span><b>Totals</b><em>✓</em></li>
            </ol>
            <footer><span>VALIDATION COMPLETE</span><strong>READY TO SEND&nbsp; ↗</strong></footer>
          </div>

          <div className="workbench-pass-face workbench-pass-back">
            <div className="workbench-pass-shine" />
            <header><span><i />STAMPBENCH</span><small>INVOICE PASSPORT</small></header>
            <div className="pass-identity">
              <small>PREVIEW / PERSONALISED TO YOUR ACCOUNT</small>
              <strong>YOUR BUSINESS</strong>
              <span>hello@yourbusiness.co.uk</span>
            </div>
            <dl>
              <div><dt>DEFAULT STANDARD</dt><dd>EN 16931</dd></div>
              <div><dt>CURRENCY</dt><dd>GBP</dd></div>
              <div><dt>STATUS</dt><dd>READY ✓</dd></div>
            </dl>
            <footer><span>SB / YOUR / 001</span><strong>PRIVATE TO YOUR WORKBENCH</strong></footer>
          </div>
        </div>
      </div>

      <p className="workbench-pass-caption">
        <span>{personalised ? 'YOUR INVOICE PASSPORT' : 'LIVE COMPLIANCE CHECK'}</span>
        <i />
        <b>{personalised ? 'CLICK TO CHECK' : 'CLICK TO PERSONALISE'}</b>
      </p>
      <span className="workbench-pass-hint" id="workbench-pass-instruction">
        <span className="pass-hint-pointer">MOVE TO TILT · CLICK TO FLIP</span>
        <span className="pass-hint-touch">TAP TO FLIP</span>
      </span>
    </div>
  );
}
