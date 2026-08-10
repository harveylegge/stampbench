import type { MetadataRoute } from 'next';

// Required for `output: 'export'`; harmless on the hosted build.
export const dynamic = 'force-static';
import { env } from '@/lib/env';
import { PAGE_MARKETS } from '@/lib/markets';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.appUrl;
  return [
    '',
    '/playground',
    // The German pages exist and rank; they were simply never listed here.
    '/de',
    '/de/playground',
    '/invoice-generator',
    ...PAGE_MARKETS.map((market) => `/invoice-generator/${market}`),
    '/markets',
    ...PAGE_MARKETS.map((market) => `/markets/${market}`),
    '/docs',
    '/pricing',
    '/trust',
    '/security',
    '/harvey',
    '/terms',
    '/privacy',
    '/impressum',
    // Auth pages exist only on the hosted deployment.
    ...(process.env.NEXT_PUBLIC_STATIC_EXPORT === '1' ? [] : ['/register', '/login']),
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));
}
