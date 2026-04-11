import type { MetadataRoute } from 'next';
import { stripTrailingSlashes } from '@/lib/strip-trailing-slashes';

function baseUrl(): string {
  const u = String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (u) return stripTrailingSlashes(u);
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
