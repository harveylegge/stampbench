import type { Metadata } from 'next';
import { Landing } from '@/components/landing';
import { en } from '@/lib/copy';

export const metadata: Metadata = {
  // absolute: the root layout's template would otherwise append the brand twice.
  title: { absolute: en.meta.title },
  description: en.meta.description,
  alternates: { canonical: '/', languages: { en: '/', de: '/de' } },
  openGraph: { title: en.meta.title, description: en.meta.description },
};

export default function LandingPage() {
  return <Landing copy={en} />;
}
