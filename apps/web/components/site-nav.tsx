'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { me, probablySignedIn, type Me } from '@/lib/account-client';
import { COPY, localePath, type Locale } from '@/lib/copy';
import { LanguageSwitcher } from '@/components/language-switcher';
import { BrandLink, NavLinks } from '@/components/nav-links';

const NPM_URL = 'https://www.npmjs.com/package/stampbench';
const GITHUB_URL = 'https://github.com/harveylegge/stampbench';

/**
 * The entire header row: brand, links, language toggle, session-aware CTA and
 * the mobile hamburger menu. Client-side because the static export cannot know
 * at build time who is signed in — the header asks the worker on mount and
 * renders the signed-out variant until it hears back. That is the right answer
 * for almost every visitor, so nobody sees a spinner or a blank gap; a
 * signed-in visitor sees the CTA swap to their account a beat after load,
 * which is the honest trade for a static page.
 *
 * The mobile panel animates with the grid-template-rows 0fr → 1fr trick, so it
 * measures its own height and there is no magic max-height to fall out of date
 * as links are added. When closed the panel is `inert`, keeping its links out
 * of the tab order without unmounting them (unmounting would kill the close
 * animation).
 */
export function SiteNav() {
  const pathname = usePathname() ?? '/';
  const locale: Locale = pathname === '/de' || pathname.startsWith('/de/') ? 'de' : 'en';
  const copy = COPY[locale];

  const [account, setAccount] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Re-checked on every route change, not just mount: signing in navigates
  // client-side (no remount of the layout), and the CTA must follow. The
  // marker check keeps anonymous page views from touching the worker at all.
  useEffect(() => {
    if (!probablySignedIn()) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    me()
      .then((user) => {
        if (!cancelled) setAccount(user);
      })
      .catch(() => {
        // The header must never break over a session check. Signed-out it is.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Belt and braces: onClick below closes the menu, but a navigation that
  // happens any other way (browser back, in-page anchor) should not leave the
  // panel hanging open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the menu and hands focus back to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  // Docs, Pricing and Trust exist in English only, so they keep their English
  // URLs while taking a German label — same rule as the desktop links.
  const menuLinks = [
    { href: localePath(locale, 'playground'), label: copy.nav.playground },
    { href: '/docs', label: copy.nav.docs },
    { href: '/pricing', label: copy.nav.pricing },
    { href: '/trust', label: copy.nav.trust },
    { href: GITHUB_URL, label: copy.nav.github, external: true },
  ];

  const bar =
    'absolute h-[1.5px] w-4 rounded-full bg-text transition duration-[250ms] ease-out motion-reduce:transition-none';
  const menuItem = 'py-2.5 text-muted transition hover:text-text';

  return (
    <div className="relative">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <BrandLink />
          <NavLinks />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <LanguageSwitcher />

          {/* Desktop: sign-in/npm while signed out (also the loading state,
              so the common case never flickers), account once we know. */}
          <div className="hidden items-center gap-3 sm:flex">
            {account ? (
              <Link
                href="/account"
                className="rounded-lg bg-accent px-3.5 py-1.5 font-medium text-white transition hover:bg-accent-hi"
              >
                {copy.nav.account}
              </Link>
            ) : (
              <>
                <Link href="/signin" className="text-muted transition hover:text-text">
                  {copy.nav.signIn}
                </Link>
                <a
                  href={NPM_URL}
                  className="rounded-lg bg-accent px-3.5 py-1.5 font-medium text-white transition hover:bg-accent-hi"
                >
                  {copy.nav.cta}
                </a>
              </>
            )}
          </div>

          {/* Mobile: three bars that morph into an X. */}
          <button
            ref={toggleRef}
            type="button"
            aria-label={copy.nav.menu}
            aria-expanded={open}
            aria-controls="site-nav-menu"
            onClick={() => setOpen((v) => !v)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface transition hover:border-border-hi sm:hidden"
          >
            <span
              aria-hidden
              className={`${bar} ${open ? 'rotate-45' : '-translate-y-[5px]'}`}
            />
            <span aria-hidden className={`${bar} ${open ? 'opacity-0' : ''}`} />
            <span
              aria-hidden
              className={`${bar} ${open ? '-rotate-45' : 'translate-y-[5px]'}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile dropdown. Overlays the page rather than pushing it down; the
          sticky header is a containing block, so top-full lands it exactly
          under the row. */}
      <div
        id="site-nav-menu"
        inert={!open}
        className={`absolute inset-x-0 top-full grid border-b border-border bg-bg/95 backdrop-blur transition-[grid-template-rows,opacity] duration-[280ms] ease-out motion-reduce:transition-none sm:hidden ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <nav
            aria-label={copy.nav.menu}
            className={`mx-auto flex max-w-6xl flex-col px-4 py-3 text-sm transition-transform duration-[280ms] ease-out motion-reduce:transition-none ${
              open ? 'translate-y-0' : '-translate-y-2'
            }`}
          >
            {menuLinks.map((link) =>
              link.external ? (
                <a key={link.href} href={link.href} onClick={close} className={menuItem}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} onClick={close} className={menuItem}>
                  {link.label}
                </Link>
              ),
            )}
            <div className="mt-2 border-t border-border pt-2">
              {account ? (
                <Link
                  href="/account"
                  onClick={close}
                  className="block py-2.5 font-medium text-text transition hover:text-accent-hi"
                >
                  {copy.nav.account}
                </Link>
              ) : (
                <Link
                  href="/signin"
                  onClick={close}
                  className="block py-2.5 font-medium text-text transition hover:text-accent-hi"
                >
                  {copy.nav.signIn}
                </Link>
              )}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
