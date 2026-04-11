import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import MeetingEvent from '@/models/MeetingEvent';
import MeetingSeries from '@/models/MeetingSeries';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { lookupUsersByIdentifiers, normalizeIdentifier } from '@/lib/user-identifiers';
import { sendMeetingInvitationEmail, resolvePublicAppUrl } from '@/lib/email-service';

interface RouteContext {
  params: Promise<{ id: string }>;
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

import { stripTrailingSlashes } from '@/lib/strip-trailing-slashes';

function normalizeUrlCandidate(value: string): string {
  return stripTrailingSlashes(String(value || '').trim());
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

async function resolveInvitationBaseUrl(request: NextRequest): Promise<string> {
  const requestBaseUrl = normalizeUrlCandidate(getRequestBaseUrl(request));
  const configuredBaseUrl = normalizeUrlCandidate(await resolvePublicAppUrl(requestBaseUrl));

  if (isPublicHttpUrl(configuredBaseUrl)) return configuredBaseUrl;
  if (isPublicHttpUrl(requestBaseUrl)) return requestBaseUrl;
  return configuredBaseUrl || requestBaseUrl;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const event = await MeetingEvent.findById(id);
    if (!event) return NextResponse.json({ error: 'Meeting event not found' }, { status: 404 });

    const user = authResult.user;
    const userId = user._id.toString();
    const username = user.username;
    const isAdmin = user.role === 'admin';
    const canModerateAll = await hasPermission(user, 'canModerateAllMeetings');

    const series = await MeetingSeries.findById(event.meetingSeriesId).lean();
    if (!series) return NextResponse.json({ error: 'Meeting series not found' }, { status: 404 });
    const isSeriesModerator =
      series.moderators?.includes(username) || series.moderators?.includes(userId);
    if (!isAdmin && !canModerateAll && !isSeriesModerator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const inviteeIds = event.invitees.map((invitee: any) => String(invitee.userId)).filter(Boolean);
    const userLookup = await lookupUsersByIdentifiers(inviteeIds, '_id email firstName lastName preferences');
    const baseUrl = await resolveInvitationBaseUrl(request);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    let sentCount = 0;
    for (const invitee of event.invitees) {
      const resolved = userLookup.get(normalizeIdentifier(String(invitee.userId))) as any;
      const email = String(resolved?.email || invitee.emailSnapshot || '').trim().toLowerCase();
      if (!email) continue;

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      invitee.rsvpTokenHash = tokenHash;
      invitee.rsvpTokenExpires = expiresAt;
      invitee.invitedAt = new Date();
      invitee.emailSnapshot = email;
      if (!invitee.responseStatus) invitee.responseStatus = 'pending';

      const locale = resolved?.preferences?.language === 'en' ? 'en' : 'de';
      const buildResponseUrl = (response: 'accepted' | 'tentative' | 'declined') =>
        `${baseUrl}/api/meeting-events/rsvp?token=${token}&response=${response}`;

      try {
        await sendMeetingInvitationEmail(
          {
            email,
            firstName: resolved?.firstName || '',
            lastName: resolved?.lastName || '',
          },
          {
            eventTitle: event.title,
            seriesName: `${series.project}${series.name ? ` – ${series.name}` : ''}`,
            scheduledDate: event.scheduledDate,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            note: event.note,
            acceptUrl: buildResponseUrl('accepted'),
            tentativeUrl: buildResponseUrl('tentative'),
            declineUrl: buildResponseUrl('declined'),
          },
          locale
        );
        sentCount += 1;
      } catch (error) {
        console.error(`Failed to send invite to ${email}`, error);
      }
    }

    event.status = 'invited';
    event.updatedBy = userId;
    event.markModified('invitees');
    await event.save();

    return NextResponse.json({
      success: true,
      message: `Invitations sent: ${sentCount}`,
      sentCount,
      totalInvitees: event.invitees.length,
    });
  } catch (error) {
    console.error('Error sending meeting invites:', error);
    return NextResponse.json({ error: 'Failed to send meeting invites' }, { status: 500 });
  }
}
