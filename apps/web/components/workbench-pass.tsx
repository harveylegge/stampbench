'use client';

import { useEffect, useRef, useState } from 'react';

export function WorkbenchPass() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [personalised, setPersonalised] = useState(false);
  const [canPlayVideo, setCanPlayVideo] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedData = window.matchMedia('(prefers-reduced-data: reduce)');
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void };
    }).connection;

    const syncVideoPreference = () => {
      setCanPlayVideo(!reducedMotion.matches && !reducedData.matches && !connection?.saveData);
    };

    reducedMotion.addEventListener('change', syncVideoPreference);
    reducedData.addEventListener('change', syncVideoPreference);
    connection?.addEventListener?.('change', syncVideoPreference);
    syncVideoPreference();

    return () => {
      reducedMotion.removeEventListener('change', syncVideoPreference);
      reducedData.removeEventListener('change', syncVideoPreference);
      connection?.removeEventListener?.('change', syncVideoPreference);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage) return;

    const hero = stage.closest<HTMLElement>('.basalt-hero');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let bounds = stage.getBoundingClientRect();
    let pointerX = 0.5;
    let pointerY = 0.5;
    let animationFrame = 0;

    const measureStage = () => {
      bounds = stage.getBoundingClientRect();
    };

    const drawPointer = () => {
      animationFrame = 0;
      stage.style.setProperty('--pass-rx', `${(0.5 - pointerY) * 8}deg`);
      stage.style.setProperty('--pass-ry', `${(pointerX - 0.5) * 10}deg`);
      stage.style.setProperty('--pass-shift-x', `${(pointerX - 0.5) * 12}px`);
      stage.style.setProperty('--pass-shift-y', `${(pointerY - 0.5) * 8}px`);
      stage.style.setProperty('--pass-light-x', `${pointerX * 100}%`);
      stage.style.setProperty('--pass-light-y', `${pointerY * 100}%`);
    };

    const followPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || reducedMotion.matches) return;
      pointerX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      pointerY = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      if (!animationFrame) animationFrame = window.requestAnimationFrame(drawPointer);
    };

    const resetPointer = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      pointerX = 0.5;
      pointerY = 0.5;
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
    const resizeObserver = new ResizeObserver(measureStage);

    observer.observe(stage);
    resizeObserver.observe(stage);
    hero?.addEventListener('pointermove', followPointer, { passive: true });
    hero?.addEventListener('pointerleave', resetPointer);
    window.addEventListener('scroll', measureStage, { passive: true });
    reducedMotion.addEventListener('change', syncMotionPreference);
    syncMotionPreference();

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      hero?.removeEventListener('pointermove', followPointer);
      hero?.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('scroll', measureStage);
      reducedMotion.removeEventListener('change', syncMotionPreference);
    };
  }, [canPlayVideo]);

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
      <div className="workbench-pass-film-shell" aria-hidden="true">
        {canPlayVideo ? (
          <video
            ref={videoRef}
            className="workbench-pass-film"
            autoPlay
            muted
            loop
            playsInline
            poster="/media/workbench-pass-poster.webp"
          >
            <source media="(max-width: 760px)" src="/media/workbench-pass-mobile.webm" type="video/webm" />
            <source media="(max-width: 760px)" src="/media/workbench-pass-mobile.mp4" type="video/mp4" />
            <source src="/media/workbench-pass.webm" type="video/webm" />
            <source src="/media/workbench-pass.mp4" type="video/mp4" />
          </video>
        ) : null}
      </div>
      <div className="workbench-pass-atmosphere" aria-hidden="true" />

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
