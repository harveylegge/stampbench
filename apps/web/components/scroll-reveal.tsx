'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Fades page sections in as they scroll into view. Progressive enhancement:
 * sections are only hidden once `reveal-ready` is set on <html>, so with JS
 * disabled (or before hydration) everything is simply visible. Reduced-motion
 * users never see the effect at all (gated in globals.css).
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    // Without IntersectionObserver (or with reduced motion, where the CSS
    // never hides anything) the page simply stays fully visible.
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const sections = Array.from(document.querySelectorAll('main section'));
    if (sections.length === 0) return;

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
    for (const section of sections) {
      if (section.classList.contains('revealed')) continue;
      // Whatever is already on screen shows immediately — first paint never
      // waits on observer timing, and an inert observer can't hide content.
      const rect = section.getBoundingClientRect();
      if (rect.top < viewport && rect.bottom > 0) section.classList.add('revealed');
      else observer.observe(section);
    }
    // Hidden state only arms after the in-view sections are already revealed.
    document.documentElement.classList.add('reveal-ready');
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
