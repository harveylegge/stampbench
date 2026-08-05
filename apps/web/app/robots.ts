import type { MetadataRoute } from 'next';

// Required for `output: 'export'`; harmless on the hosted build.
export const dynamic = 'force-static';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/api'] }],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
