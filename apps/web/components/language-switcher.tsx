'use client';

import { usePathname } from 'next/navigation';
import { LOCALES, TRANSLATED_PATHS, type Locale } from '@/lib/copy';

/**
 * EN / DE toggle.
 *
 * Deliberately a switch rather than a redirect: silently sending a German
 * visitor to German copy takes the choice away from someone who may well
 * prefer English docs, and it muddies which page search engines should rank.
 * The browser's preference is only used to *hint* which option to nudge — the
 * visitor still decides.
 *
 * Pages that exist in one language only (docs, trust, security, legal) switch
 * back to the corresponding home page rather than 404ing.
 */
function counterpart(pathname: string, target: Locale): string {
  const stripped = pathname.replace(/^\/de(?=\/|$)/, '').replace(/^\/+|\/+$/g, '');
  const exists = (TRANSLATED_PATHS as readonly string[]).includes(stripped);
  const slug = exists ? stripped : '';
  const base = target === 'en' ? '' : '/de';
  return `${base}/${slug}`.replace(/\/+$/, '') || '/';
}

export function LanguageSwitcher() {
  const pathname = usePathname() ?? '/';
  const active: Locale = pathname === '/de' || pathname.startsWith('/de/') ? 'de' : 'en';

  return (
    <div
      className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs font-medium"
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((locale) => {
        const isActive = locale === active;
        return (
          <a
            key={locale}
            href={counterpart(pathname, locale)}
            hrefLang={locale}
            aria-current={isActive ? 'true' : undefined}
            className={`rounded-md px-2 py-1 uppercase tracking-wide transition ${
              isActive
                ? 'bg-accent text-white'
                : 'text-faint hover:text-text'
            }`}
          >
            {locale}
          </a>
        );
      })}
    </div>
  );
}
