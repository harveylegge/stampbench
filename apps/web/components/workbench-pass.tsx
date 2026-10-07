'use client';

import { useEffect, useRef, useState } from 'react';

export function WorkbenchPass() {
  const stageRef = useRef<HTMLDivElement>(null);
  const passportRef = useRef<HTMLDivElement>(null);
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
    const passport = passportRef.current;
    const video = videoRef.current;
    if (!stage) return;

    const hero = stage.closest<HTMLElement>('.basalt-hero');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let stageBounds = stage.getBoundingClientRect();
    let heroBounds = hero?.getBoundingClientRect() ?? stageBounds;
    let animationFrame = 0;

    const current = {
      formX: 0,
      formY: 0,
      formRx: 0,
      formRy: 0,
      cardX: 0,
      cardY: 0,
      cardRx: 0,
      cardRy: 0,
      lightX: 50,
      lightY: 42,
      proximity: 0,
      hover: 0,
      hazeX: 0,
      hazeY: 0,
    };
    const target = { ...current };

    const clamp = (value: number, minimum: number, maximum: number) => (
      Math.max(minimum, Math.min(maximum, value))
    );

    const measure = () => {
      stageBounds = stage.getBoundingClientRect();
      heroBounds = hero?.getBoundingClientRect() ?? stageBounds;
    };

    const writeMotion = () => {
      const formScale = 1.03 + current.proximity * 0.01 - current.hover * 0.012;

      stage.style.setProperty('--form-x', `${current.formX.toFixed(3)}px`);
      stage.style.setProperty('--form-y', `${current.formY.toFixed(3)}px`);
      stage.style.setProperty('--form-rx', `${current.formRx.toFixed(3)}deg`);
      stage.style.setProperty('--form-ry', `${current.formRy.toFixed(3)}deg`);
      stage.style.setProperty('--form-scale', formScale.toFixed(4));
      stage.style.setProperty('--card-x', `${current.cardX.toFixed(3)}px`);
      stage.style.setProperty('--card-y', `${current.cardY.toFixed(3)}px`);
      stage.style.setProperty('--card-rx', `${current.cardRx.toFixed(3)}deg`);
      stage.style.setProperty('--card-ry', `${current.cardRy.toFixed(3)}deg`);
      stage.style.setProperty('--passport-lift', `${(current.hover * 22).toFixed(3)}px`);
      stage.style.setProperty('--passport-hover-tilt', `${(current.hover * 1.35).toFixed(3)}deg`);
      stage.style.setProperty('--pass-light-x', `${current.lightX.toFixed(3)}%`);
      stage.style.setProperty('--pass-light-y', `${current.lightY.toFixed(3)}%`);
      stage.style.setProperty('--bulge-strength', current.proximity.toFixed(4));
      hero?.style.setProperty('--hero-haze-x', `${current.hazeX.toFixed(3)}px`);
      hero?.style.setProperty('--hero-haze-y', `${current.hazeY.toFixed(3)}px`);
    };

    const settleMotion = () => {
      animationFrame = 0;
      const smoothing = 0.058;
      let unsettled = false;

      (Object.keys(current) as Array<keyof typeof current>).forEach((key) => {
        const difference = target[key] - current[key];
        if (Math.abs(difference) > 0.004) {
          current[key] += difference * smoothing;
          unsettled = true;
        } else {
          current[key] = target[key];
        }
      });

      writeMotion();
      if (unsettled) animationFrame = window.requestAnimationFrame(settleMotion);
    };

    const queueMotion = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(settleMotion);
    };

    const followPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || reducedMotion.matches) return;

      const heroX = clamp((event.clientX - heroBounds.left) / heroBounds.width, 0, 1);
      const heroY = clamp((event.clientY - heroBounds.top) / heroBounds.height, 0, 1);
      const x = heroX * 2 - 1;
      const y = heroY * 2 - 1;
      const localX = clamp((event.clientX - stageBounds.left) / stageBounds.width, 0, 1);
      const localY = clamp((event.clientY - stageBounds.top) / stageBounds.height, 0, 1);
      const distance = Math.hypot(
        event.clientX - (stageBounds.left + stageBounds.width * 0.5),
        event.clientY - (stageBounds.top + stageBounds.height * 0.5),
      );
      const attractionRadius = Math.max(260, Math.min(stageBounds.width, stageBounds.height) * 0.72);

      target.formX = x * 26;
      target.formY = y * 20;
      target.formRx = -y * 1.1;
      target.formRy = x * 1.35;
      target.cardX = x * -7;
      target.cardY = y * -5;
      target.cardRx = -y * 1.65;
      target.cardRy = x * 2.15;
      target.lightX = clamp(localX * 100, 18, 82);
      target.lightY = clamp(localY * 100, 18, 82);
      target.proximity = clamp(1 - distance / attractionRadius, 0, 1);
      target.hazeX = x * 7;
      target.hazeY = y * 5;
      queueMotion();
    };

    const resetPointer = () => {
      target.formX = 0;
      target.formY = 0;
      target.formRx = 0;
      target.formRy = 0;
      target.cardX = 0;
      target.cardY = 0;
      target.cardRx = 0;
      target.cardRy = 0;
      target.lightX = 50;
      target.lightY = 42;
      target.proximity = 0;
      target.hover = 0;
      target.hazeX = 0;
      target.hazeY = 0;
      stage.classList.remove('is-passport-hovered');
      queueMotion();
    };

    const raisePassport = () => {
      if (reducedMotion.matches) return;
      target.hover = 1;
      stage.classList.add('is-passport-hovered');
      queueMotion();
    };

    const lowerPassport = () => {
      target.hover = 0;
      stage.classList.remove('is-passport-hovered');
      queueMotion();
    };

    const resetMotionImmediately = () => {
      Object.assign(current, {
        formX: 0,
        formY: 0,
        formRx: 0,
        formRy: 0,
        cardX: 0,
        cardY: 0,
        cardRx: 0,
        cardRy: 0,
        lightX: 50,
        lightY: 42,
        proximity: 0,
        hover: 0,
        hazeX: 0,
        hazeY: 0,
      });
      Object.assign(target, current);
      stage.classList.remove('is-passport-hovered');
      writeMotion();
    };

    const syncMotionPreference = () => {
      if (reducedMotion.matches) {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        resetMotionImmediately();
        video?.pause();
      } else {
        void video?.play().catch(() => undefined);
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      stage.classList.toggle('is-offscreen', !entry.isIntersecting);
      if (!video || reducedMotion.matches) return;
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    }, { rootMargin: '160px 0px' });
    const resizeObserver = new ResizeObserver(measure);

    observer.observe(stage);
    resizeObserver.observe(stage);
    if (hero) resizeObserver.observe(hero);
    hero?.addEventListener('pointermove', followPointer, { passive: true });
    hero?.addEventListener('pointerleave', resetPointer);
    passport?.addEventListener('pointerenter', raisePassport);
    passport?.addEventListener('pointerleave', lowerPassport);
    window.addEventListener('scroll', measure, { passive: true });
    reducedMotion.addEventListener('change', syncMotionPreference);
    writeMotion();
    syncMotionPreference();

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      hero?.removeEventListener('pointermove', followPointer);
      hero?.removeEventListener('pointerleave', resetPointer);
      passport?.removeEventListener('pointerenter', raisePassport);
      passport?.removeEventListener('pointerleave', lowerPassport);
      window.removeEventListener('scroll', measure);
      reducedMotion.removeEventListener('change', syncMotionPreference);
      hero?.style.removeProperty('--hero-haze-x');
      hero?.style.removeProperty('--hero-haze-y');
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
      aria-label="Interactive Stampbench invoice file"
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

      <div ref={passportRef} className="workbench-pass-motion" aria-hidden="true">
        <div className="workbench-pass-card">
          <div className="workbench-pass-face workbench-pass-front">
            <div className="workbench-pass-shine" />
            <header><span><i />STAMPBENCH / INVOICE FILE</span><small>INV–SB–001</small></header>
            <div className="pass-checking"><i />Checking invoice data…</div>
            <ol>
              <li><span>01</span><b>Invoice identity</b><em>✓</em></li>
              <li><span>02</span><b>Tax + totals</b><em>✓</em></li>
              <li><span>03</span><b>EN 16931</b><em>✓</em></li>
            </ol>
            <footer><span>UBL + PDF / LOCAL CHECK</span><strong>ACCOUNTING READY&nbsp; ↗</strong></footer>
          </div>

          <div className="workbench-pass-face workbench-pass-back">
            <div className="workbench-pass-shine" />
            <header><span><i />STAMPBENCH / INVOICE FILE</span><small>VERIFIED COPY</small></header>
            <div className="pass-identity">
              <small>SAMPLE INVOICE / READY TO EXPORT</small>
              <strong>INV–SB–001</strong>
              <span>YOUR BUSINESS · £1,240.00</span>
            </div>
            <dl>
              <div><dt>CUSTOMER</dt><dd>SAMPLE CLIENT</dd></div>
              <div><dt>DUE</dt><dd>30 DAYS</dd></div>
              <div><dt>FORMAT</dt><dd>UBL + PDF</dd></div>
            </dl>
            <footer><span>CHECKED IN YOUR BROWSER</span><strong>EXPORT READY ✓</strong></footer>
          </div>
        </div>
      </div>

      <p className="workbench-pass-caption">
        <span>{personalised ? 'INVOICE EXPORT PROFILE' : 'INVOICE READINESS CHECK'}</span>
        <i />
        <b>{personalised ? 'CLICK TO CHECK' : 'CLICK FOR EXPORT VIEW'}</b>
      </p>
      <span className="workbench-pass-hint" id="workbench-pass-instruction">
        <span className="pass-hint-pointer">MOVE TO TILT · CLICK TO FLIP</span>
        <span className="pass-hint-touch">TAP TO FLIP</span>
      </span>
    </div>
  );
}
