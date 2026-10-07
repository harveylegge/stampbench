'use client';

import { useState } from 'react';

/**
 * Code samples in several languages, tabbed.
 *
 * Every sample here is a plain HTTPS request: there is no Stampbench SDK for
 * Python, PHP or anything else, and the caption says so. Presenting these as
 * "supported languages" without that line would be the exact kind of implied
 * coverage the rest of the site is careful not to claim.
 */
export function LangTabs({ samples }: { samples: { id: string; label: string; code: string }[] }) {
  const [active, setActive] = useState(samples[0]!.id);
  const [copied, setCopied] = useState(false);
  const current = samples.find((s) => s.id === active) ?? samples[0]!;

  return (
    <div className="my-4">
      <div
        role="tablist"
        aria-label="Language"
        className="mb-2 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
      >
        {samples.map((sample) => (
          <button
            key={sample.id}
            role="tab"
            id={`lang-tab-${sample.id}`}
            aria-selected={active === sample.id}
            aria-controls={`lang-panel-${sample.id}`}
            onClick={() => setActive(sample.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active === sample.id ? 'bg-accent text-white' : 'text-muted hover:text-text'
            }`}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre
          role="tabpanel"
          id={`lang-panel-${current.id}`}
          aria-labelledby={`lang-tab-${current.id}`}
          className="overflow-x-auto rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-muted"
        >
          {current.code}
        </pre>
        <button
          onClick={() => {
            navigator.clipboard.writeText(current.code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="absolute right-2 top-2 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:text-text"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
