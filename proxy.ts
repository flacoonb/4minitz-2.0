import { NextRequest, NextResponse } from 'next/server';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function proxy(request: NextRequest) {
  // CSRF Protection: Verify Origin header on state-changing API requests
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    MUTATION_METHODS.has(request.method)
  ) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // Allow requests without Origin header (same-origin non-CORS requests, e.g. server-side)
    // But if Origin is present, it must match the host
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json(
            { error: 'CSRF validation failed' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid origin' },
          { status: 403 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
