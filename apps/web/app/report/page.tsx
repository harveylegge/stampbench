import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReportView } from './report-view';

export const metadata: Metadata = {
  title: 'Validation report',
  description: 'A shared Stampbench validation report.',
  // Every report link is unique and private-ish; none belong in a search index.
  robots: { index: false },
};

export default function ReportPage() {
  return (
    // The viewer reads ?id= via useSearchParams, which static export requires
    // to sit inside a Suspense boundary.
    <Suspense>
      <ReportView />
    </Suspense>
  );
}
