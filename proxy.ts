import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicyHeader } from '@/lib/csp-build';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function createNonce(): string {
  const id = globalThis.crypto.randomUUID();
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(id, 'utf8').toString('base64');
  }
  return btoa(id);
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/') && MUTATION_METHODS.has(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
      }
    }
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (process.env.DISABLE_CSP === 'true') {
    return NextResponse.next();
  }

  const nonce = createNonce();
  const appUrl = String(process.env.APP_URL || '').trim().toLowerCase();
  const upgradeInsecure =
    process.env.CSP_UPGRADE_INSECURE_REQUESTS === 'true' ||
    (process.env.NODE_ENV === 'production' && appUrl.startsWith('https://'));

  const csp = buildContentSecurityPolicyHeader({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    allowCloudflareInsights: process.env.ALLOW_CLOUDFLARE_INSIGHTS === 'true',
    strictDynamic: process.env.CSP_DISABLE_STRICT_DYNAMIC !== 'true',
    strictStyles: process.env.CSP_STRICT_STYLES === 'true',
    extraScriptSrc: process.env.CSP_EXTRA_SCRIPT_SRC,
    extraConnectSrc: process.env.CSP_EXTRA_CONNECT_SRC,
    extraImgSrc: process.env.CSP_EXTRA_IMG_SRC,
    upgradeInsecureRequests: upgradeInsecure,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    {
      source: '/((?!api/|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
