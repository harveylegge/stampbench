import type { Metadata } from 'next';
import { Playground } from '../../playground/playground';
import { de } from '@/lib/copy';

export const metadata: Metadata = {
  title: de.playground.metaTitle,
  description: de.playground.metaDescription,
  alternates: { canonical: '/de/playground', languages: { en: '/playground', de: '/de/playground' } },
};

export default function GermanPlaygroundPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" lang="de">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{de.playground.title}</h1>
      <p className="mb-8 text-sm text-muted">{de.playground.intro}</p>
      <Playground />
    </div>
  );
}
