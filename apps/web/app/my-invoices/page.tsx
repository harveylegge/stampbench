import type { Metadata } from 'next';

import { InvoicesView } from './invoices-view';

export const metadata: Metadata = {
  title: 'My invoices',
  // Every visitor sees their own browser-local list — nothing for a crawler.
  robots: { index: false, follow: false },
};

export default function MyInvoicesPage() {
  return <InvoicesView />;
}
