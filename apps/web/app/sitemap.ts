import type { MetadataRoute } from 'next';

// Required for `output: 'export'`; harmless on the hosted build.
export const dynamic = 'force-static';
import { env } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.appUrl;
  return [
    '',
    '/playground',
    '/docs',
    '/pricing',
    '/trust',
    '/security',
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
