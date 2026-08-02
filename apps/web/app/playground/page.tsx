import type { Metadata } from 'next';
import { Playground } from './playground';

export const metadata: Metadata = {
  title: 'Playground — validate XRechnung online',
  description:
    'Paste an XRechnung / UBL invoice and validate it against EN 16931 and BR-DE rules instantly. Generate compliant XML from JSON. Free, no signup needed.',
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Playground</h1>
      <p className="mb-8 text-sm text-muted">
        Try the API without signing up — validate an XRechnung document or generate one from JSON.
        Anonymous use is limited to 10 requests/hour;{' '}
        <a href="/register" className="text-accent-hi hover:underline">
          create a free account
        </a>{' '}
        for 100 calls a month.
      </p>
      <Playground />
    </div>
  );
}
