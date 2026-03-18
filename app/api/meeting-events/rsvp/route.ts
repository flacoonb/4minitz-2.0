import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import MeetingEvent from '@/models/MeetingEvent';
import { checkRateLimit, checkRateLimitByKey } from '@/lib/rate-limit';
import { resolvePublicAppUrl } from '@/lib/email-service';

const ALLOWED_RESPONSES = new Set(['accepted', 'tentative', 'declined']);

function normalizeUrlCandidate(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return false;
  }
}

function getRequestBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const host = request.headers.get('host')?.trim();
  if (host) {
    const proto = request.nextUrl.protocol.replace(/:$/, '') || 'https';
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

async function resolveRedirectBaseUrl(request: NextRequest): Promise<string> {
  const requestBaseUrl = normalizeUrlCandidate(getRequestBaseUrl(request));
  const configuredBaseUrl = normalizeUrlCandidate(await resolvePublicAppUrl(requestBaseUrl));

  if (isPublicHttpUrl(configuredBaseUrl)) return configuredBaseUrl;
  if (isPublicHttpUrl(requestBaseUrl)) return requestBaseUrl;
  return configuredBaseUrl || requestBaseUrl || 'http://localhost:3000';
}

function isLikelyUserNavigation(request: NextRequest): boolean {
  const secFetchUser = request.headers.get('sec-fetch-user');
  if (secFetchUser === '?1') return true;

  const secFetchMode = request.headers.get('sec-fetch-mode');
  const secFetchDest = request.headers.get('sec-fetch-dest');
  if (secFetchMode === 'navigate' && (!secFetchDest || secFetchDest === 'document')) {
    return true;
  }

  const accept = String(request.headers.get('accept') || '').toLowerCase();
  const userAgent = String(request.headers.get('user-agent') || '').toLowerCase();
  const looksLikeScanner =
    /scanner|proofpoint|barracuda|mimecast|safelinks|urlscan|mailguard|symantec|trendmicro|defender|security|crawl|bot/.test(
      userAgent
    );

  return accept.includes('text/html') && !looksLikeScanner;
}

async function processRsvp(token: string, response: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date();

  const event = await MeetingEvent.findOne({
    invitees: {
      $elemMatch: {
        rsvpTokenHash: tokenHash,
        rsvpTokenExpires: { $gt: now },
      },
    },
  });

  if (!event) {
    return { success: false as const, error: 'Invalid or expired RSVP token' };
  }

  const invitee = event.invitees.find(
    (entry: any) =>
      String(entry?.rsvpTokenHash || '') === tokenHash &&
      (!entry?.rsvpTokenExpires || new Date(entry.rsvpTokenExpires) > now)
  );
  if (!invitee) {
    return { success: false as const, error: 'Invitation not found for token' };
  }

  invitee.responseStatus = response as any;
  invitee.respondedAt = new Date();
  invitee.responseSource = 'magic-link';
  event.markModified('invitees');

  const hasAccepted = event.invitees.some((entry: any) => entry.responseStatus === 'accepted');
  if (hasAccepted && event.status !== 'cancelled' && event.status !== 'completed') {
    event.status = 'confirmed';
  }

  await event.save();
  return {
    success: true as const,
    data: {
      eventId: event._id,
      responseStatus: invitee.responseStatus,
      respondedAt: invitee.respondedAt,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const ipRateLimit = checkRateLimit(request, 25, 60 * 60 * 1000);
    if (!ipRateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await connectDB();
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const response = String(body.response || '').trim().toLowerCase();

    if (!token || !ALLOWED_RESPONSES.has(response)) {
      return NextResponse.json({ error: 'token and valid response are required' }, { status: 400 });
    }

    const tokenThrottleKey = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
    const tokenRateLimit = checkRateLimitByKey(`meeting-rsvp:${tokenThrottleKey}`, 20, 60 * 60 * 1000);
    if (!tokenRateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const result = await processRsvp(token, response);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error processing RSVP:', error);
    return NextResponse.json({ error: 'Failed to process RSVP' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const token = String(searchParams.get('token') || '').trim();
    const response = String(searchParams.get('response') || '').trim().toLowerCase();
    const redirectBaseUrl = await resolveRedirectBaseUrl(request);

    if (!token || !ALLOWED_RESPONSES.has(response)) {
      const invalidUrl = new URL('/rsvp', redirectBaseUrl);
      return NextResponse.redirect(invalidUrl);
    }

    // Keep scanners from consuming tokens before real users click.
    if (!isLikelyUserNavigation(request)) {
      const fallbackUrl = new URL('/rsvp', redirectBaseUrl);
      fallbackUrl.searchParams.set('token', token);
      fallbackUrl.searchParams.set('response', response);
      return NextResponse.redirect(fallbackUrl);
    }

    const ipRateLimit = checkRateLimit(request, 25, 60 * 60 * 1000);
    if (!ipRateLimit.allowed) {
      const limitedUrl = new URL('/rsvp', redirectBaseUrl);
      limitedUrl.searchParams.set('status', 'error');
      limitedUrl.searchParams.set('message', 'Zu viele Anfragen');
      return NextResponse.redirect(limitedUrl);
    }

    const tokenThrottleKey = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
    const tokenRateLimit = checkRateLimitByKey(`meeting-rsvp:${tokenThrottleKey}`, 20, 60 * 60 * 1000);
    if (!tokenRateLimit.allowed) {
      const limitedUrl = new URL('/rsvp', redirectBaseUrl);
      limitedUrl.searchParams.set('status', 'error');
      limitedUrl.searchParams.set('message', 'Zu viele Anfragen');
      return NextResponse.redirect(limitedUrl);
    }

    await connectDB();
    const result = await processRsvp(token, response);
    const doneUrl = new URL('/rsvp', redirectBaseUrl);
    doneUrl.searchParams.set('response', response);
    if (result.success) {
      doneUrl.searchParams.set('status', 'success');
    } else {
      doneUrl.searchParams.set('status', 'error');
      doneUrl.searchParams.set('message', result.error);
    }
    return NextResponse.redirect(doneUrl);
  } catch (error) {
    console.error('Error processing RSVP via link:', error);
    const redirectBaseUrl = await resolveRedirectBaseUrl(request);
    const redirectUrl = new URL('/rsvp', redirectBaseUrl);
    redirectUrl.searchParams.set('status', 'error');
    redirectUrl.searchParams.set('message', 'Die Antwort konnte nicht gespeichert werden.');
    return NextResponse.redirect(redirectUrl);
  }
}
