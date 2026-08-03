import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jbmono' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'InvoiceGate — XRechnung & EN 16931 e-invoicing API for developers',
    template: '%s · InvoiceGate',
  },
  description:
    'Validate and generate legally compliant e-invoices (XRechnung, EN 16931) with a TypeScript-first API. Plain-language error explanations powered by AI. Built for the German B2B e-invoicing mandate.',
  keywords: [
    'xrechnung', 'e-rechnung', 'en 16931', 'e-invoicing api', 'xrechnung validieren',
    'xrechnung nodejs', 'ubl invoice', 'peppol', 'e-rechnung pflicht 2027',
  ],
  openGraph: {
    title: 'InvoiceGate — e-invoicing compliance API',
    description: 'Validate and generate XRechnung / EN 16931 e-invoices in TypeScript.',
    siteName: 'InvoiceGate',
    type: 'website',
  },
};

async function Nav() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent font-mono text-xs text-white">
              IG
            </span>
            InvoiceGate
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
            <Link href="/playground" className="transition hover:text-text">Playground</Link>
            <Link href="/docs" className="transition hover:text-text">Docs</Link>
            <Link href="/pricing" className="transition hover:text-text">Pricing</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
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
          <div className="mb-2 font-semibold text-muted">InvoiceGate</div>
          <p className="max-w-xs leading-relaxed">
            E-invoicing compliance tooling for developers. Not legal advice — for
            certification-grade checks also run the official KoSIT validator.
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
            <a href="/docs#library" className="hover:text-muted">@invoicegate/core</a>
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
        © {new Date().getFullYear()} InvoiceGate. All rights reserved.
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
