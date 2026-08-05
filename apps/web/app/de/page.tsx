import type { Metadata } from 'next';
import { Landing } from '@/components/landing';
import { de } from '@/lib/copy';

export const metadata: Metadata = {
  // absolute: the root layout template would otherwise append the brand twice.
  title: { absolute: de.meta.title },
  description: de.meta.description,
  keywords: [
    'xrechnung prüfen', 'xrechnung validieren', 'e-rechnung pflicht 2027', 'e-rechnung prüfen',
    'zugferd prüfen', 'en 16931', 'xrechnung validator', 'e-rechnung api', 'factur-x',
  ],
  alternates: { canonical: '/de', languages: { en: '/', de: '/de' } },
  openGraph: { title: de.meta.title, description: de.meta.description, locale: 'de_DE' },
};

export default function GermanLandingPage() {
  return <Landing copy={de} />;
}
