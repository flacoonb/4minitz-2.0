import type { MetadataRoute } from 'next';

function baseUrl(): string {
  const u = String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (u) return u.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

export default function robots(): MetadataRoute.Robots {
  const host = baseUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
