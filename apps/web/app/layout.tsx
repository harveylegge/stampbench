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
    default: 'Validate & fix XRechnung / EN 16931 e-invoices · Stampbench',
    template: '%s · Stampbench',
  },
  description:
    'E-invoicing is becoming law: Germany already requires XRechnung for public-sector invoices, and every business must issue e-invoices from 2027. Stampbench validates, repairs and generates compliant invoices in TypeScript — open source, on your own machine.',
  keywords: [
    'xrechnung', 'e-rechnung', 'en 16931', 'e-invoicing api', 'xrechnung validieren',
    'xrechnung nodejs', 'ubl invoice', 'peppol', 'e-rechnung pflicht 2027',
  ],
  authors: [{ name: 'Harvey Legge', url: 'https://github.com/ohjl777' }],
  creator: 'Harvey Legge',
  openGraph: {
    title: 'Stampbench — e-invoicing compliance for the mandate era',
    description:
      'Germany requires XRechnung today for public-sector invoices and for all businesses from 2027. Validate, repair and generate compliant e-invoices — open source, in TypeScript.',
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
            <a href="/playground" className="hover:text-muted">Playground</a>
            <a href="/docs" className="hover:text-muted">Documentation</a>
            <a href="/pricing" className="hover:text-muted">Pricing</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted">Open source</span>
            <a href="/docs#library" className="hover:text-muted">@stampbench/core</a>
            <a href="/docs#rules" className="hover:text-muted">Rules coverage</a>
            <a href="https://github.com/ohjl777/stampbench" className="hover:text-muted">GitHub</a>
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
                    'https://github.com/ohjl777',
                    'https://www.linkedin.com/in/harvey-legge-ba687b3ba',
                  ],
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://stampbench.com/#org',
                  name: 'Stampbench',
                  url: 'https://stampbench.com',
                  description:
                    'Open-source e-invoicing compliance tooling: validate, repair and generate XRechnung / EN 16931 invoices in TypeScript.',
                  founder: { '@id': 'https://stampbench.com/#harvey-legge' },
                  sameAs: [
                    'https://github.com/ohjl777/stampbench',
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
