import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** CSP for non-HTML assets (no scripts/styles); HTML pages get nonce CSP from proxy.ts */
const STATIC_TEXT_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    // CSP: HTML from proxy.ts (nonces). See SECURITY.md / docs/CSP.md.
    const appUrl = String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '')
      .trim()
      .toLowerCase();
    // HSTS: production builds targeting HTTPS (ZAP #65). If APP_URL is unset at build, still emit
    // HSTS (browsers only enforce it on HTTPS responses). Pure-HTTP prod: DISABLE_HSTS=true.
    const enableHsts =
      process.env.DISABLE_HSTS !== 'true' &&
      (process.env.ENABLE_HSTS === 'true' ||
        (process.env.NODE_ENV === 'production' && (!appUrl || appUrl.startsWith('https://'))));

    const baseHeaders: { key: string; value: string }[] = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // ZAP 90004: satisfy CORP on app-controlled responses (not Cloudflare edge scripts).
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    ];

    if (enableHsts) {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    const staticSeoHeaders = [
      ...baseHeaders,
      { key: 'Content-Security-Policy', value: STATIC_TEXT_CSP },
      // Explicit policy for ZAP 10015 / cache heuristics on text responses
      { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
    ];

    return [
      // Next.js: when several sources match, the *last* block wins per header key. Put catch-all
      // first so /robots.txt and /sitemap.xml keep CSP + Cache-Control (GitHub #65).
      { source: '/(.*)', headers: baseHeaders },
      { source: '/robots.txt', headers: staticSeoHeaders },
      { source: '/sitemap.xml', headers: staticSeoHeaders },
    ];
  },
};

export default withNextIntl(nextConfig);
