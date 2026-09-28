import type { Metadata } from 'next';
import Link from 'next/link';
import { Clause, LegalPage } from '@/components/legal';

export const metadata: Metadata = { title: 'Cookie and Local Storage Policy', description: 'The essential cookies and browser storage used by Stampbench.' };

export default function CookiePolicyPage() {
  return <LegalPage title="Cookie and Local Storage Policy" updated="28 September 2026" intro={<p>This page explains the small amount of information Stampbench stores in your browser. We do not use advertising cookies, behavioural profiling or third-party analytics scripts.</p>}>
    <Clause n="1." title="Do you need to accept cookies?"><p>No consent banner is currently shown because the only cookies are strictly necessary to provide account sign-in and security. If we add optional analytics, advertising or embedded services, they will remain disabled until you choose them.</p></Clause>
    <Clause n="2." title="Essential account cookies"><ul><li><strong className="text-text">Session cookie</strong> — authenticates a signed-in account. It is HttpOnly, Secure and SameSite and expires when the session expires.</li><li><strong className="text-text">Signed-in marker</strong> — tells the interface to check whether an account session exists. It contains no password, API key or invoice data.</li></ul></Clause>
    <Clause n="3." title="Storage on your device"><p>The invoice workbench uses local storage to keep drafts, invoice history, market preferences, recurring rules and usage counters on your own device. The assistant uses session storage for the current tab. These features are requested by you and do not track activity across websites.</p><p>You can remove this information using your browser&apos;s site-data controls. Removing it deletes browser-only drafts and preferences from that device.</p></Clause>
    <Clause n="4." title="Analytics and third parties"><p>Stampbench does not load Google Analytics, Meta Pixel, Hotjar or another browser analytics SDK. The edge service stores aggregate daily page counts without cookies or a per-person identifier. Stripe and PayPal are opened only when you choose a payment action; they are not embedded on ordinary pages.</p></Clause>
    <Clause n="5." title="Changes and questions"><p>If our use of storage changes, this page and the <Link href="/privacy" className="text-accent-hi underline">Privacy Policy</Link> will be updated before optional tracking is enabled. Questions can be sent to <a href="mailto:hello@stampbench.com" className="text-accent-hi underline">hello@stampbench.com</a>.</p></Clause>
  </LegalPage>;
}
