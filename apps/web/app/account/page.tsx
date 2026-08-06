import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AccountView } from './account-view';

export const metadata: Metadata = {
  title: 'Account',
  // Every visitor sees their own data here — nothing for a crawler.
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    /* AccountView reads ?upgrade= via useSearchParams, which the static
       export requires to sit under a Suspense boundary. */
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-16" />}>
      <AccountView />
    </Suspense>
  );
}
