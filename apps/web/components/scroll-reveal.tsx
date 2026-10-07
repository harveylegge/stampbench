'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Fades page sections in as they scroll into view. Progressive enhancement:
 * hiding is opt-in per element: the effect veils only the below-fold
 * sections it is actively observing, so with JS disabled (or before
 * hydration) everything is simply visible, and a section that mounts later
 * (the account dashboard renders only after its session fetch resolves) is
 * never hidden, because nothing would ever reveal it. Reduced-motion users
 * never see the effect at all (gated in globals.css).
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector('main');
    main?.classList.remove('sb-page-enter');
    const frame = window.requestAnimationFrame(() => main?.classList.add('sb-page-enter'));
    // Without IntersectionObserver (or with reduced motion, where the CSS
    // never hides anything) the page simply stays fully visible.
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    );

    const viewport = window.innerHeight;
    const veiled: Element[] = [];
    for (const section of Array.from(document.querySelectorAll('main section'))) {
      if (section.classList.contains('revealed')) continue;
      // Whatever is already on screen is left untouched: first paint never
      // waits on observer timing, and an inert observer can't hide content.
      const rect = section.getBoundingClientRect();
      if (rect.top >= viewport || rect.bottom <= 0) {
        section.classList.add('sb-veiled');
        veiled.push(section);
        observer.observe(section);
      }
    }

    // Hero entrance failsafe. The CSS entrance hides its children via the
    // animation's opening frame; a background-loaded tab pauses there. This
    // guarantees they are never stuck invisible: after the animation's own
    // duration has comfortably passed, cancel it and restore the resting
    // state. For a foreground visitor the animation has long finished, so
    // this is a no-op; for a background tab it is the safety net.
    const failsafe = window.setTimeout(() => {
      document.documentElement.classList.add('sb-rise-safe');
    }, 1500);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearTimeout(failsafe);
      // Never carry a hidden state past this effect's lifetime: once the
      // observer is gone, nothing could reveal these again.
      for (const section of veiled) section.classList.remove('sb-veiled');
    };
  }, [pathname]);

  return null;
}
