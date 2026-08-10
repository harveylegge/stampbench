import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js needs inline styles for streaming; webpack dev runtime needs eval.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      // Parity with the static build's _headers CSP (build-static.mjs): lock
      // down the base tag, plugins, and form targets. The server build is
      // dormant, but a weaker policy on the credentialed surface is exactly
      // the wrong asymmetry to leave lying around.
      "base-uri 'none'",
      "object-src 'none'",
      "form-action 'self'",
    ].join('; '),
  },
];

/**
 * STATIC_EXPORT=1 produces the credential-free marketing site for Cloudflare
 * Pages: no auth, no API routes, playground fully client-side. headers() is
 * ignored by `next export`; the build script emits a `_headers` file for
 * Cloudflare instead.
 */
const isStaticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  transpilePackages: ['@stampbench/core'],
  poweredByHeader: false,
  ...(isStaticExport
    ? { output: 'export' as const, trailingSlash: true, distDir: '.next-static' }
    : {
        async headers() {
          return [{ source: '/(.*)', headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
