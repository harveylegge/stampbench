import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ScrollReveal } from '@/components/scroll-reveal';
import { SiteNav } from '@/components/site-nav';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jbmono' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    // The result page already shows the domain above the title, so the brand
    // goes at the end instead of repeating up front.
    default: 'Stampbench — validate, repair and create compliant e-invoices',
    template: '%s · Stampbench',
  },
  /**
   * The site-wide default is deliberately market-neutral. Jurisdiction terms
   * are not abandoned — they moved to where they are true and specific:
   * /markets/germany carries XRechnung and ZUGFeRD in English, /de carries the
   * German-language terms that already rank. A homepage optimised for
   * "XRechnung" tells a UK visitor the product is not for them before they
   * have read a word of it.
   */
  description:
    'Invoice infrastructure for modern businesses: validate, repair and create structured e-invoices against the standard your market requires. EN 16931 core, the German XRechnung profile, UBL and CII — open source TypeScript that runs on your own machine.',
  keywords: [
    'invoice validation', 'e-invoicing api', 'invoice api', 'invoice compliance',
    'en 16931', 'ubl invoice', 'cii invoice', 'xrechnung', 'zugferd', 'factur-x',
  ],
  authors: [{ name: 'Harvey Legge', url: 'https://github.com/harveylegge' }],
  creator: 'Harvey Legge',
  openGraph: {
    title: 'Stampbench — invoice validation and compliance infrastructure',
    description:
      'Validate, repair and create structured e-invoices against the ruleset that applies where you bill: EN 16931 everywhere, the German XRechnung profile in full. Open source, runs locally.',
    siteName: 'Stampbench',
    type: 'website',
  },
};

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <SiteNav />
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
          <p className="mt-3 text-xs">
            Founded by <a href="/harvey" className="hover:text-muted">Harvey Legge</a>.
          </p>
        </div>
        <div className="flex flex-wrap gap-12">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted">Product</span>
            <a href="/playground" className="hover:text-muted">Validate an invoice</a>
            <a href="/docs" className="hover:text-muted">Documentation</a>
            <a href="/pricing" className="hover:text-muted">Pricing</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted">Markets</span>
            <a href="/markets/uk" className="hover:text-muted">United Kingdom</a>
            <a href="/markets/us" className="hover:text-muted">United States</a>
            <a href="/markets/eu" className="hover:text-muted">European Union</a>
            <a href="/markets/germany" className="hover:text-muted">Germany · XRechnung</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted">Open source</span>
            <a href="/docs#library" className="hover:text-muted">@stampbench/core</a>
            <a href="/docs#rules" className="hover:text-muted">Rules coverage</a>
            <a href="https://github.com/harveylegge/stampbench" className="hover:text-muted">GitHub</a>
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
              '@graph': [
                {
                  '@type': 'Person',
                  '@id': 'https://stampbench.com/#harvey-legge',
                  name: 'Harvey Legge',
                  url: 'https://stampbench.com/harvey',
                  jobTitle: 'Founder',
                  worksFor: { '@id': 'https://stampbench.com/#org' },
                  sameAs: [
                    'https://github.com/harveylegge',
                    'https://www.linkedin.com/in/harvey-legge-ba687b3ba',
                  ],
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://stampbench.com/#org',
                  name: 'Stampbench',
                  url: 'https://stampbench.com',
                  logo: 'https://stampbench.com/brand/stampbench-logo.png',
                  description:
                    'Open-source e-invoicing compliance tooling: validate, repair and generate XRechnung / EN 16931 invoices in TypeScript.',
                  founder: { '@id': 'https://stampbench.com/#harvey-legge' },
                  sameAs: [
                    'https://github.com/harveylegge/stampbench',
                    'https://www.npmjs.com/package/stampbench',
                    'https://www.npmjs.com/package/@stampbench/core',
                  ],
                },
                {
                  '@type': 'SoftwareApplication',
                  '@id': 'https://stampbench.com/#app',
                  name: 'Stampbench',
                  url: 'https://stampbench.com',
                  applicationCategory: 'DeveloperApplication',
                  operatingSystem: 'Cross-platform',
                  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
                  author: { '@id': 'https://stampbench.com/#harvey-legge' },
                  publisher: { '@id': 'https://stampbench.com/#org' },
                },
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
