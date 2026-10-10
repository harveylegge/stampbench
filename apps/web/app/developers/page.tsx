import type { Metadata } from 'next';

import { EnterpriseLanding } from '@/components/enterprise-landing';

export const metadata: Metadata = {
  title: 'E-invoice validation for software teams',
  description:
    'Validate EN 16931 and XRechnung UBL or CII invoices locally with a TypeScript engine and CLI. Return exact rule IDs, source locations and versioned diagnostics.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Stampbench: e-invoice validation for software teams',
    description:
      'Local-first EN 16931 and XRechnung validation for software teams, with no Java runtime.',
  },
};

export default function DevelopersPage() {
  return <EnterpriseLanding />;
}
