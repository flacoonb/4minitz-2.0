import type { MetadataRoute } from 'next';

function baseUrl(): string {
  const u = String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (u) return u.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

/** Minimal sitemap so responses are app-served with security headers (ZAP #65). */
export default function sitemap(): MetadataRoute.Sitemap {
  const host = baseUrl();
  const now = new Date();
  return [
    {
      url: host,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
