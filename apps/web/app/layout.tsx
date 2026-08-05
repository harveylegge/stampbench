import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { ScrollReveal } from '@/components/scroll-reveal';
import './globals.css';

/**
 * The static export (Cloudflare Pages) has no server: no auth, no dashboard,
 * no API routes. Auth is loaded with a dynamic import so Prisma and the
 * session machinery stay entirely out of the static build graph.
 */
const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jbmono' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    // The result page already shows the domain above the title, so the brand
    // goes at the end instead of repeating up front.
    default: 'Validate & fix XRechnung / EN 16931 e-invoices · Stampbench',
    template: '%s · Stampbench',
  },
  description:
    'E-invoicing is becoming law: Germany already requires XRechnung for public-sector invoices, and every business must issue e-invoices from 2027. Stampbench validates, repairs and generates compliant invoices in TypeScript — open source, on your own machine.',
  keywords: [
    'xrechnung', 'e-rechnung', 'en 16931', 'e-invoicing api', 'xrechnung validieren',
    'xrechnung nodejs', 'ubl invoice', 'peppol', 'e-rechnung pflicht 2027',
  ],
  openGraph: {
    title: 'Stampbench — e-invoicing compliance for the mandate era',
    description:
      'Germany requires XRechnung today for public-sector invoices and for all businesses from 2027. Validate, repair and generate compliant e-invoices — open source, in TypeScript.',
    siteName: 'Stampbench',
    type: 'website',
  },
};

async function Nav() {
  const user = IS_STATIC ? null : await (await import('@/lib/auth')).getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent font-mono text-xs text-white">
              SB
            </span>
            Stampbench
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
            <Link href="/playground" className="transition hover:text-text">Playground</Link>
            <Link href="/docs" className="transition hover:text-text">Docs</Link>
            <Link href="/pricing" className="transition hover:text-text">Pricing</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {IS_STATIC ? (
            <a
              href="https://www.npmjs.com/package/stampbench"
              className="rounded-lg bg-accent px-3.5 py-1.5 font-medium text-white transition hover:bg-accent-hi"
            >
              Get it on npm
            </a>
          ) : user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-accent px-3.5 py-1.5 font-medium text-white transition hover:bg-accent-hi"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted transition hover:text-text">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-accent px-3.5 py-1.5 font-medium text-white transition hover:bg-accent-hi"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10 text-sm text-faint">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 font-semibold text-muted">Stampbench</div>
          <p className="max-w-xs leading-relaxed">
            E-invoicing compliance tooling for developers. Not legal advice — for
            certification-grade checks also run the official KoSIT validator.
          </p>
          <p className="mt-3 text-xs">Founded by Harvey Legge.</p>
        </div>
        <div className="flex flex-wrap gap-12">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted">Product</span>
            <a href="/playground" className="hover:text-muted">Playground</a>
            <a href="/docs" className="hover:text-muted">Documentation</a>
            <a href="/pricing" className="hover:text-muted">Pricing</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted">Open source</span>
            <a href="/docs#library" className="hover:text-muted">@stampbench/core</a>
            <a href="/docs#rules" className="hover:text-muted">Rules coverage</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted">Trust</span>
            <a href="/trust" className="hover:text-muted">Test evidence</a>
            <a href="/security" className="hover:text-muted">Security</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted">Legal</span>
            <a href="/terms" className="hover:text-muted">Terms</a>
            <a href="/privacy" className="hover:text-muted">Privacy</a>
            <a href="/impressum" className="hover:text-muted">Impressum</a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-6xl px-4">
        © {new Date().getFullYear()} Stampbench. All rights reserved.
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Stampbench',
              url: 'https://stampbench.com',
              description:
                'Open-source e-invoicing compliance tooling: validate, repair and generate XRechnung / EN 16931 invoices in TypeScript.',
              founder: { '@type': 'Person', name: 'Harvey Legge', jobTitle: 'Founder' },
              sameAs: [
                'https://www.npmjs.com/package/stampbench',
                'https://www.npmjs.com/package/@stampbench/core',
              ],
            }),
          }}
        />
        <Nav />
        <ScrollReveal />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
