'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { COPY, localePath, type Copy, type Locale } from '@/lib/copy';
import { StampbenchMark } from '@/components/logo';

/**
 * The header links, grouped into the two audiences Stampbench serves.
 *
 * The flat row this replaces put Validate, Create invoice, My invoices,
 * Markets, Docs and Pricing at one level, which quietly asked every visitor to
 * work out which three of the six were meant for them. Grouping answers that
 * once: a business visitor opens "Business" and finds an invoice; a developer
 * opens "Developers" and finds an engine. The group containing the current
 * page is marked, so you always know which experience you are in.
 *
 * Localisation is by URL, because the root layout is shared by both languages.
 * Only the homepage and the playground exist in German, so the rest keep their
 * English URLs while taking a German label.
 */

export interface NavItem {
  href: string;
  label: string;
  sub: string;
  external?: boolean;
}

export interface NavGroup {
  id: 'business' | 'developers';
  label: string;
  items: NavItem[];
}

/** The grouped menus, resolved for a locale. Shared with the mobile panel. */
export function navGroups(copy: Copy, locale: Locale): NavGroup[] {
  return [
    {
      id: 'business',
      label: copy.nav.business,
      items: [
        { href: '/invoice-generator', label: copy.nav.create, sub: copy.nav.createSub },
        { href: '/my-invoices', label: copy.nav.invoices, sub: copy.nav.invoicesSub },
      ],
    },
    {
      id: 'developers',
      label: copy.nav.developers,
      items: [
        { href: '/developers', label: copy.nav.devPlatform, sub: copy.nav.devPlatformSub },
        {
          href: localePath(locale, 'playground'),
          label: copy.nav.playground,
          sub: copy.nav.playgroundSub,
        },
        { href: '/docs', label: copy.nav.docs, sub: copy.nav.docsSub },
        { href: '/markets', label: copy.nav.markets, sub: copy.nav.marketsSub },
      ],
    },
  ];
}

/** Which group, if any, owns the current path: used to mark the active menu. */
export function activeGroup(pathname: string): 'business' | 'developers' | null {
  if (
    pathname.startsWith('/invoice-generator') ||
    pathname.startsWith('/my-invoices')
  ) {
    return 'business';
  }
  if (
    pathname.startsWith('/developers') ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/markets') ||
    pathname === '/playground' ||
    pathname.startsWith('/playground/') ||
    pathname === '/de/playground'
  ) {
    return 'developers';
  }
  return null;
}

export function NavLinks() {
  const pathname = usePathname() ?? '/';
  const locale: Locale = pathname === '/de' || pathname.startsWith('/de/') ? 'de' : 'en';
  const copy = COPY[locale];
  const groups = navGroups(copy, locale);
  const active = activeGroup(pathname);
  const [open, setOpen] = useState<string | null>(null);

  // A route change means the menu has done its job.
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  return (
    <nav className="hidden items-center gap-1 text-sm text-muted lg:flex">
      {groups.map((group) => (
        <NavMenu
          key={group.id}
          group={group}
          isActive={active === group.id}
          open={open === group.id}
          onOpen={() => setOpen(group.id)}
          onClose={() => setOpen((current) => (current === group.id ? null : current))}
        />
      ))}
      <Link
        href="/my-invoices"
        className={`rounded-lg px-3 py-1.5 transition hover:text-text ${
          pathname.startsWith('/my-invoices') ? 'text-text' : ''
        }`}
      >
        {copy.nav.invoices}
      </Link>
      <Link
        href="/pricing"
        className={`rounded-lg px-3 py-1.5 transition hover:text-text ${
          pathname.startsWith('/pricing') ? 'text-text' : ''
        }`}
      >
        {copy.nav.pricing}
      </Link>
      <Link
        href="/trust"
        className={`rounded-lg px-3 py-1.5 transition hover:text-text ${
          pathname.startsWith('/trust') ? 'text-text' : ''
        }`}
      >
        {copy.nav.trust}
      </Link>
    </nav>
  );
}

/**
 * One dropdown.
 *
 * Opens on hover for a pointer and on click for everything else, which is the
 * combination that works without a mouse: the trigger is a real button with
 * aria-expanded, Escape closes it and hands focus back, and moving focus out of
 * the whole group closes it so tabbing past a menu does not leave it hanging
 * open over the page.
 */
function NavMenu({
  group,
  isActive,
  open,
  onOpen,
  onClose,
}: {
  group: NavGroup;
  isActive: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onClose]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? onClose() : onOpen())}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition hover:text-text ${
          isActive || open ? 'text-text' : ''
        }`}
      >
        {group.label}
        <span
          aria-hidden
          className={`text-[0.6rem] transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
        {isActive && <span className="sr-only">(current section)</span>}
      </button>

      {/* Rendered always so the close animation can play; `inert` keeps the
          links out of the tab order while it is shut. */}
      <div
        id={id}
        inert={!open}
        className={`absolute left-0 top-full z-50 w-72 pt-2 transition duration-150 ease-out motion-reduce:transition-none ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        <ul className="flex flex-col gap-0.5 rounded-xl border border-border bg-bg/95 p-2 shadow-lg backdrop-blur">
          {group.items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className="block rounded-lg px-3 py-2 transition hover:bg-surface"
              >
                <span className="block font-medium text-text">{item.label}</span>
                <span className="block text-xs leading-snug text-faint">{item.sub}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
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
