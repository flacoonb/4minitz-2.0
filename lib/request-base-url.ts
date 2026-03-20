import type { NextRequest } from 'next/server';

/**
 * Builds scheme + host for absolute URLs (e.g. email links, redirects).
 * Only trusts `x-forwarded-proto` / `x-forwarded-host` when `TRUST_PROXY_HEADERS=true`,
 * consistent with `lib/rate-limit.ts` (prevents Host-header / proxy spoofing).
 */
export function getSafeRequestOriginBase(request: NextRequest): string {
  const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === 'true';
  if (trustProxyHeaders) {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    if (forwardedProto && forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
    }
  }

  const host = request.headers.get('host')?.trim();
  if (host) {
    const proto = request.nextUrl.protocol.replace(/:$/, '') || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return new URL(request.url).origin.replace(/\/+$/, '');
}
