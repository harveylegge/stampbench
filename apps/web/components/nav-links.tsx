'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COPY, localePath, type Locale } from '@/lib/copy';

/**
 * The header links, localised from the current path. Client-side because the
 * root layout is shared by both languages and only the URL says which one the
 * visitor is reading. Docs and Pricing exist in English only, so they keep
 * their English URLs while taking a German label.
 */
export function NavLinks() {
  const pathname = usePathname() ?? '/';
  const locale: Locale = pathname === '/de' || pathname.startsWith('/de/') ? 'de' : 'en';
  const copy = COPY[locale];

  return (
    <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
      <Link href={localePath(locale, 'playground')} className="transition hover:text-text">
        {copy.nav.playground}
      </Link>
      <Link href="/docs" className="transition hover:text-text">
        {copy.nav.docs}
      </Link>
      <Link href="/pricing" className="transition hover:text-text">
        {copy.nav.pricing}
      </Link>
    </nav>
  );
}

/**
 * The Stampbench S monogram, inlined so the two halves can take their colours
 * from the theme tokens (accent hook on top, ink hook below) instead of the
 * fixed fills baked into the standalone SVGs in /public/brand.
 */
export function LogoMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        className="fill-accent"
        d="M12 20 Q12 12 20 12 H50 L44 21 H23 Q21 21 21 23 V25.5 Q21 27.5 23 27.5 H36.5 L30.5 36.5 H15 Q12 36.5 12 33.5 V20 Z"
      />
      <path
        className="fill-text"
        d="M52 44 Q52 52 44 52 H14 L20 43 H41 Q43 43 43 41 V38.5 Q43 36.5 41 36.5 H27.5 L33.5 27.5 H49 Q52 27.5 52 30.5 V44 Z"
      />
    </svg>
  );
}

/** The brand mark, linking to the current language's home page. */
export function BrandLink() {
  const pathname = usePathname() ?? '/';
  const locale: Locale = pathname === '/de' || pathname.startsWith('/de/') ? 'de' : 'en';
  return (
    <Link href={localePath(locale)} className="flex items-center gap-2 font-semibold tracking-tight">
      <LogoMark />
      Stampbench
    </Link>
  );
}
