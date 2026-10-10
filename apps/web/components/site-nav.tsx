'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { me, probablySignedIn, type Me } from '@/lib/account-client';
import { BrandLink } from '@/components/nav-links';

const links = [
  { href: '/', label: 'Validation' },
  { href: '/docs', label: 'Integration docs' },
  { href: '/trust', label: 'Evidence' },
  { href: '/business', label: 'Create invoices' },
  { href: '/pricing', label: 'Pilot' },
  { href: '/my-invoices', label: 'My invoices' },
];

export function SiteNav() {
  const pathname = usePathname() ?? '/';
  const [account, setAccount] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    if (!probablySignedIn()) return setAccount(null);
    let active = true;
    me().then((value) => active && setAccount(value)).catch(() => active && setAccount(null));
    return () => { active = false; };
  }, [pathname]);

  return (
    <div className="cream-nav mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-6 px-6">
      <BrandLink />
      <nav className="hidden items-center gap-7 text-sm lg:flex" aria-label="Main navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={link.href === '/' ? (pathname === '/' ? 'page' : undefined) : (pathname.startsWith(link.href) ? 'page' : undefined)}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="hidden items-center gap-4 text-sm lg:flex">
        <Link href={account ? '/account' : '/signin'}>{account ? 'My account' : 'Sign in'} <span>↗</span></Link>
        {!account && <Link className="cream-account" href="/signup">Create account</Link>}
      </div>
      <button className="cream-menu lg:hidden" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Menu {open ? '−' : '+'}</button>
      {open && (
        <nav className="cream-mobile lg:hidden" aria-label="Mobile navigation">
          {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <Link href={account ? '/account' : '/signin'}>{account ? 'My account' : 'Sign in'} ↗</Link>
          {!account && <Link href="/signup">Create account ↗</Link>}
        </nav>
      )}
    </div>
  );
}
