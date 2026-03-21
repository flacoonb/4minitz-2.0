import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

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
    // CSP: set per request in proxy.ts (nonces). See SECURITY.md / docs/CSP.md.
    const securityHeaders: { key: string; value: string }[] = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    // HSTS: only when explicitly enabled or APP_URL is https (avoid sending on plain HTTP installs).
    const appUrl = String(process.env.APP_URL || '').trim().toLowerCase();
    const enableHsts =
      process.env.ENABLE_HSTS === 'true' ||
      (process.env.NODE_ENV === 'production' && appUrl.startsWith('https://'));
    if (enableHsts && process.env.DISABLE_HSTS !== 'true') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
