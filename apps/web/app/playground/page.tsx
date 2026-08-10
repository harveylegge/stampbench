import type { Metadata } from 'next';

import { en } from '@/lib/copy';
import { Playground } from './playground';

const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';

export const metadata: Metadata = {
  title: en.playground.metaTitle,
  description: en.playground.metaDescription,
  alternates: { canonical: '/playground', languages: { en: '/playground', de: '/de/playground' } },
};

/**
 * The English playground opens on the European core rather than the German
 * profile: a visitor who has not told us where they bill should not have a
 * national customisation applied on their behalf. The moment they choose a
 * market — here, on the homepage or on a market page — that choice sticks, and
 * a document that declares itself XRechnung gets offered the German ruleset
 * explicitly.
 */
export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{en.playground.title}</h1>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted">
        {IS_STATIC ? (
          en.playground.intro
        ) : (
          <>
            Try the API without signing up — validate an invoice or create one from JSON. Anonymous
            use is limited to 10 requests/hour;{' '}
            <a href="/register" className="text-accent-hi hover:underline">
              create a free account
            </a>{' '}
            for 100 calls a month.
          </>
        )}
      </p>
      <Playground defaultMarket="eu" />
    </div>
  );
}
