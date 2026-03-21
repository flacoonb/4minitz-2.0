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
    const appUrl = String(process.env.APP_URL || '').trim().toLowerCase();
    const enableHsts =
      process.env.ENABLE_HSTS === 'true' ||
      (process.env.NODE_ENV === 'production' && appUrl.startsWith('https://'));

    const baseHeaders: { key: string; value: string }[] = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // ZAP 90004: satisfy CORP on app-controlled responses (not Cloudflare edge scripts).
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    ];

    if (enableHsts && process.env.DISABLE_HSTS !== 'true') {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    const robotsSitemapHeaders = [
      ...baseHeaders,
      { key: 'Content-Security-Policy', value: STATIC_TEXT_CSP },
    ];

    return [
      { source: '/robots.txt', headers: robotsSitemapHeaders },
      { source: '/sitemap.xml', headers: robotsSitemapHeaders },
      { source: '/(.*)', headers: baseHeaders },
    ];
  },
};

export default withNextIntl(nextConfig);
