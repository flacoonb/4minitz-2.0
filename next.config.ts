import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    const strictCspMode = process.env.STRICT_CSP_MODE === 'true';
    const allowInlineScripts = process.env.ALLOW_INLINE_SCRIPTS === 'true';
    const scriptSrc =
      process.env.NODE_ENV === 'production'
        ? strictCspMode || !allowInlineScripts
          ? "script-src 'self'"
          : "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ');

    const securityHeaders: { key: string; value: string }[] = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: csp },
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
