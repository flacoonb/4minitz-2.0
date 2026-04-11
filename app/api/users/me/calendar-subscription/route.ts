import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { verifyToken } from '@/lib/auth';
import { stripTrailingSlashes } from '@/lib/strip-trailing-slashes';

function getRequestBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host')?.trim();
  if (host) {
    const proto = request.nextUrl.protocol.replace(/:$/, '') || 'https';
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

function createCalendarToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function buildIcalUrl(baseUrl: string, token: string): string {
  return `${stripTrailingSlashes(baseUrl)}/api/calendar/ical/${token}`;
}

function normalizeUrlCandidate(value: string): string {
  return stripTrailingSlashes(value.trim());
}

function isLocalhostLike(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function getFirstPublicCandidate(candidates: string[]): string | null {
  for (const raw of candidates) {
    const candidate = normalizeUrlCandidate(raw);
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      if (isLocalhostLike(candidate)) continue;
      return candidate;
    } catch {
      // ignore invalid candidate
    }
  }
  return null;
}

async function resolvePublicBaseUrl(request: NextRequest): Promise<string> {
  const originHeader = String(request.headers.get('origin') || '');
  const refererHeader = String(request.headers.get('referer') || '');
  const envAppUrl = String(process.env.APP_URL || '');
  const envPublicAppUrl = String(process.env.NEXT_PUBLIC_APP_URL || '');
  const requestDerived = stripTrailingSlashes(getRequestBaseUrl(request));

  const refererOrigin = (() => {
    try {
      return refererHeader ? new URL(refererHeader).origin : '';
    } catch {
      return '';
    }
  })();

  try {
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 }).select('systemSettings.baseUrl').lean();
    const configured = String((settings as any)?.systemSettings?.baseUrl || '').trim();
    const preferred = getFirstPublicCandidate([
      configured,
      envAppUrl,
      envPublicAppUrl,
      originHeader,
      refererOrigin,
      requestDerived,
    ]);
    if (preferred) {
      return preferred;
    }
    if (configured) {
      return normalizeUrlCandidate(configured);
    }
  } catch {
    // Ignore settings lookup errors and fallback to request-derived origin.
  }

  const fallback = getFirstPublicCandidate([
    envAppUrl,
    envPublicAppUrl,
    originHeader,
    refererOrigin,
    requestDerived,
  ]);
  return fallback || requestDerived;
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authResult.user._id).select('calendarFeedToken');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.calendarFeedToken) {
      user.calendarFeedToken = createCalendarToken();
      user.calendarFeedTokenCreatedAt = new Date();
      await user.save();
    }

    const baseUrl = await resolvePublicBaseUrl(request);
    return NextResponse.json({
      success: true,
      data: {
        subscribeUrl: buildIcalUrl(baseUrl, user.calendarFeedToken),
        hasToken: true,
      },
    });
  } catch (error) {
    console.error('Error reading calendar subscription settings:', error);
    return NextResponse.json({ error: 'Failed to load calendar subscription' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authResult.user._id).select('calendarFeedToken calendarFeedTokenCreatedAt');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.calendarFeedToken = createCalendarToken();
    user.calendarFeedTokenCreatedAt = new Date();
    await user.save();

    const baseUrl = await resolvePublicBaseUrl(request);
    return NextResponse.json({
      success: true,
      data: {
        subscribeUrl: buildIcalUrl(baseUrl, user.calendarFeedToken),
        hasToken: true,
      },
    });
  } catch (error) {
    console.error('Error regenerating calendar subscription token:', error);
    return NextResponse.json({ error: 'Failed to regenerate calendar subscription token' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authResult.user._id).select('calendarFeedToken calendarFeedTokenCreatedAt');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.calendarFeedToken = undefined;
    user.calendarFeedTokenCreatedAt = undefined;
    await user.save();

    return NextResponse.json({ success: true, data: { hasToken: false } });
  } catch (error) {
    console.error('Error revoking calendar subscription token:', error);
    return NextResponse.json({ error: 'Failed to revoke calendar subscription token' }, { status: 500 });
  }
}
