import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How Stampbench handles your invoice data, credentials and infrastructure: encryption, key handling, XML parsing safety, rate limiting, and responsible disclosure.',
};

/**
 * Only measures actually implemented in this codebase are listed. Anything
 * planned is in the "not yet" section — no aspirational security claims.
 */

const MEASURES = [
  {
    area: 'Invoice data',
    items: [
      'Invoice XML sent to the hosted API is processed in memory to produce a validation result and is not written to our database. We store the outcome (valid/invalid, rule counts, timestamp) for your usage metering — not the document.',
      'Request bodies are capped at 2 MB and every field is schema-validated before it reaches the rule engine.',
      'The open-source library runs entirely on your own infrastructure. If you never want an invoice to leave your network, use it and never call the API — it is MIT-licensed and has the same rule engine.',
    ],
  },
  {
    area: 'XML parsing (XXE and entity attacks)',
    items: [
      'Our parser performs no DTD processing and no external-entity resolution, so classic XXE file-disclosure and SSRF-via-entity attacks are structurally absent rather than filtered.',
      'Billion-laughs style entity-expansion bombs are likewise not applicable, since entity expansion is not performed.',
      'Non-finite and malformed numeric values are rejected at the API boundary and defensively guarded again in the generator, so they can never be emitted into a document.',
    ],
  },
  {
    area: 'Credentials & sessions',
    items: [
      'Passwords are hashed with bcrypt at cost factor 12. Plaintext passwords are never stored or logged.',
      'API keys are generated from 24 bytes of cryptographic randomness, stored only as a SHA-256 hash, and displayed exactly once at creation. We cannot recover a lost key — you rotate it.',
      'Revoking a key takes effect immediately: revoked or unrecognised credentials return 401 and are never silently downgraded to anonymous access.',
      'Sessions are server-side records referenced by an HttpOnly, SameSite=Lax, Secure cookie; the session token is stored hashed with a server-side pepper, so database contents alone cannot be replayed as a login.',
      'Login and registration are rate-limited per IP, and authentication runs a constant-time comparison whether or not the account exists, so response timing does not reveal which emails are registered.',
    ],
  },
  {
    area: 'Application & transport',
    items: [
      'HTTPS everywhere, enforced by the hosting platform.',
      'Security headers on every response: a Content-Security-Policy restricting script and connection sources, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, a strict Referrer-Policy, and a Permissions-Policy disabling camera, microphone and geolocation.',
      'Database access goes exclusively through a parameterised query layer (Prisma); no string-concatenated SQL exists in the codebase.',
      'Per-key and per-IP rate limiting plus monthly quotas, so a leaked key has a bounded blast radius.',
      'Stripe webhooks are verified by cryptographic signature; unsigned or mis-signed payloads are rejected before any account state changes.',
      'Structured JSON logging that records outcomes and never request bodies, credentials or invoice contents.',
    ],
  },
  {
    area: 'Development practice',
    items: [
      '57 automated tests run on every change, including regression tests for the specific validation bugs we have previously fixed.',
      'The codebase passed a multi-agent adversarial security review in which every finding had to survive a second reviewer attempting to refute it; all high-severity findings were remediated before launch.',
      'Dependencies are deliberately few. The rule engine has two runtime dependencies.',
    ],
  },
];

const NOT_YET = [
  'SOC 2 Type II or ISO 27001 certification. We do not have either, and we will not imply otherwise.',
  'A signed DPA/AVV and a formal EU-data-residency commitment — in progress for the Platform tier; ask us for current status before relying on it.',
  'A third-party penetration test. Our review was internal and adversarial, but it was not an external pentest.',
  'A published uptime SLA. The service is new; we would rather commit to a number we have history for.',
];

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      <ul className="space-y-2.5">
        {items.map((t) => (
          <li key={t} className="flex gap-3 text-sm leading-relaxed text-muted">
            <span className="mt-0.5 shrink-0 text-success">✓</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">Security</h1>
      <p className="mb-10 leading-relaxed text-muted">
        You are considering sending us documents that contain your customers&apos; names, addresses
        and bank details. This page states precisely what we do with them and how the service is
        built — including the things we have not done yet.
      </p>

      <div className="mb-10 rounded-xl border border-accent/30 bg-accent-dim/20 p-5">
        <h2 className="mb-2 text-sm font-medium text-accent-hi">
          The strongest guarantee we can offer
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          If your security review says invoice data must never leave your infrastructure, you do not
          need to argue with us about our controls — use{' '}
          <code className="font-mono text-xs text-accent-hi">@stampbench/core</code> locally. It is
          MIT-licensed, runs offline, has no telemetry, and contains the same rule engine the hosted
          API uses. The hosted product exists to save you maintenance, not to hold your data.
        </p>
      </div>

      {MEASURES.map((m) => (
        <Section key={m.area} title={m.area} items={m.items} />
      ))}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">AI-generated explanations</h2>
        <p className="text-sm leading-relaxed text-muted">
          The optional &ldquo;explain this error&rdquo; feature sends the{' '}
          <strong className="text-text">validation findings</strong> — rule identifiers, business
          terms and our own message text — to Anthropic&apos;s API to produce a plain-language fix
          list. It is opt-in per request, the prompt is size-capped, and the feature degrades to a
          deterministic non-AI explanation if it is unavailable. If your data-processing policy does
          not permit a sub-processor, simply do not call that endpoint; validation and generation are
          entirely unaffected.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">What we have not done yet</h2>
        <ul className="space-y-2.5">
          {NOT_YET.map((t) => (
            <li key={t} className="flex gap-3 text-sm leading-relaxed text-muted">
              <span className="mt-0.5 shrink-0 text-faint">—</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Reporting a vulnerability</h2>
        <p className="mb-3 text-sm leading-relaxed text-muted">
          If you believe you have found a security issue, please report it privately to{' '}
          <span className="font-mono text-accent-hi">security@stampbench.com</span> before
          disclosing it publicly. Include enough detail to reproduce the issue.
        </p>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>• We aim to acknowledge reports within 3 working days.</li>
          <li>• We will keep you updated while we investigate and tell you when it is fixed.</li>
          <li>• We will credit you when a fix ships, unless you prefer otherwise.</li>
          <li>
            • We will not pursue legal action against good-faith research that respects user privacy
            and avoids service disruption or data destruction.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          Please do not run automated scanners against the production API — use the open-source
          library locally instead, where you can test freely.
        </p>
      </section>

      <p className="mt-10 text-center text-sm text-faint">
        See also:{' '}
        <Link href="/trust" className="text-accent-hi hover:underline">
          test evidence
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="text-accent-hi hover:underline">
          privacy policy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className="text-accent-hi hover:underline">
          terms
        </Link>
      </p>
    </div>
  );
}
