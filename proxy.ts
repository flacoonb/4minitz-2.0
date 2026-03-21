import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicyHeader } from '@/lib/csp-build';
import { verifyJwtHs256Edge } from '@/lib/verify-jwt-edge';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** App sections that must not return 200 without a valid session (see server layouts + security smoke tests). */
function isProtectedAppPath(pathname: string): boolean {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return true;
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return true;
  return false;
}

function createNonce(): string {
  const id = globalThis.crypto.randomUUID();
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(id, 'utf8').toString('base64');
  }
  return btoa(id);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Next.js 16 can still respond 200 to document requests even when a layout calls redirect().
  // Enforce HTTP redirects here so scanners and smoke tests see 302/307 (matches server layouts).
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !pathname.startsWith('/api/') &&
    isProtectedAppPath(pathname)
  ) {
    const secret = process.env.JWT_SECRET;
    const token = request.cookies.get('auth-token')?.value;
    const ok = Boolean(secret && token && (await verifyJwtHs256Edge(token, secret)));
    if (!ok) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = '';
      const back = pathname + (request.nextUrl.search || '');
      url.searchParams.set('redirect', back.startsWith('/') ? back : `/${back}`);
      return NextResponse.redirect(url, 307);
    }
  }

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
      // Exclude SEO text routes so next.config STATIC_TEXT_CSP + Cache-Control apply (ZAP #65).
      source: '/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
