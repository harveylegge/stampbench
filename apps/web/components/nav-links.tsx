'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COPY, localePath, type Locale } from '@/lib/copy';
import { StampbenchMark } from '@/components/logo';

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

/** The brand mark, linking to the current language's home page. */
export function BrandLink() {
  const pathname = usePathname() ?? '/';
  const locale: Locale = pathname === '/de' || pathname.startsWith('/de/') ? 'de' : 'en';
  return (
    <Link href={localePath(locale)} className="flex items-center gap-2 font-semibold tracking-tight">
      <StampbenchMark size={24} />
      Stampbench
    </Link>
  );
}
