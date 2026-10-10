import type { Metadata } from 'next';
import { EnterpriseLanding } from '@/components/enterprise-landing';

export const metadata: Metadata = {
  title: { absolute: 'Stampbench: European e-invoicing validation for software' },
  description:
    'Validate UBL and CII invoices against supported EN 16931 and XRechnung rules. Integrate structured rule IDs and source locations into your software.',
  alternates: { canonical: '/', languages: { en: '/', de: '/de' } },
  openGraph: {
    title: 'European e-invoicing validation for your software',
    description:
      'Validate UBL and CII invoices and return structured diagnostics inside the workflow your product already uses.',
  },
};

export default function LandingPage() {
  return <EnterpriseLanding />;
}
