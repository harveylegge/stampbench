import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ScrollReveal } from '@/components/scroll-reveal';
import { SiteNav } from '@/components/site-nav';
import { AssistantWidget } from '@/components/assistant-widget';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jbmono' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    // The result page already shows the domain above the title, so the brand
    // goes at the end instead of repeating up front.
    default: 'Stampbench: e-invoicing, without the complexity',
    template: '%s · Stampbench',
  },
  /**
   * The site-wide default is deliberately market-neutral, and now
   * audience-neutral too: it names both products in one sentence, because the
   * homepage's job is to route rather than to sell one of them. Jurisdiction
   * terms are not abandoned: they live where they are true and specific:
   * /markets/germany carries XRechnung and ZUGFeRD in English, /de carries the
   * German-language terms that already rank, and /developers carries the
   * standards vocabulary in full.
   */
  description:
    'European e-invoicing validation for software teams. Validate UBL and CII against supported EN 16931 and XRechnung rules with an open-source TypeScript engine and CLI.',
  keywords: [
    'invoice validation', 'e-invoicing api', 'invoice api', 'invoice compliance',
    'en 16931', 'ubl invoice', 'cii invoice', 'xrechnung', 'zugferd', 'factur-x',
  ],
  authors: [{ name: 'Harvey Legge', url: 'https://github.com/harveylegge' }],
  creator: 'Harvey Legge',
  openGraph: {
    title: 'Stampbench: invoice validation and compliance infrastructure',
    description:
      'Validate, repair and create structured e-invoices against documented EN 16931 and XRechnung rules. Open source and designed to run locally.',
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
    <footer className="cream-footer border-t border-border py-9 text-sm text-faint">
      <div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-7 px-6 md:flex-row md:items-end">
        <div><div className="mb-2 font-semibold text-text">Stampbench</div><p>Good work. Properly invoiced.<br />Founded by <a href="/harvey">Harvey Legge</a>.</p></div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer navigation">
          <a href="/">Validation</a><a href="/invoice-generator">Invoice creator</a><a href="/pricing">Integration pilot</a><a href="/trust">Evidence</a><a href="/docs">Docs</a><a href="/security">Security</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/terms">Terms</a><a href="/refunds">Refunds</a><a href="/impressum">Business details</a>
        </nav>
      </div>
      <div className="mx-auto mt-7 max-w-[1180px] px-6 text-xs">© {new Date().getFullYear()} Harvey Legge trading as Stampbench · United Kingdom · <a href="mailto:hello@stampbench.com">hello@stampbench.com</a></div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main-content" className="skip-link">Skip to main content</a>
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
        <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
        <Footer />
        <AssistantWidget />
      </body>
    </html>
  );
}
