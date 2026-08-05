import type { Metadata } from 'next';
import { Landing } from '@/components/landing';
import { en } from '@/lib/copy';

export const metadata: Metadata = {
  alternates: { canonical: '/', languages: { en: '/', de: '/de' } },
};

export default function LandingPage() {
  return <Landing copy={en} />;
}
