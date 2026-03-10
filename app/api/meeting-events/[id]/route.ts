import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import MeetingEvent from '@/models/MeetingEvent';
import MeetingSeries from '@/models/MeetingSeries';
import MinutesTemplate from '@/models/MinutesTemplate';
import PdfTemplate from '@/models/PdfTemplate';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { lookupUsersByIdentifiers, normalizeIdentifier } from '@/lib/user-identifiers';
import { sendMeetingCancellationEmail } from '@/lib/email-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function hasSeriesAccess(series: any, username: string, userId: string, isAdmin: boolean, canViewAll: boolean): boolean {
  if (isAdmin || canViewAll) return true;
  return Boolean(
    series &&
      (series.visibleFor?.includes(username) ||
        series.visibleFor?.includes(userId) ||
        series.moderators?.includes(username) ||
        series.moderators?.includes(userId) ||
        series.participants?.includes(username) ||
        series.participants?.includes(userId) ||
        (Array.isArray(series.members) && series.members.some((member: any) => member?.userId === userId)))
  );
}

function canManageSeries(series: any, username: string, userId: string, isAdmin: boolean, canModerateAll: boolean): boolean {
  if (isAdmin || canModerateAll) return true;
  return Boolean(series && (series.moderators?.includes(username) || series.moderators?.includes(userId)));
}

async function resolveMinutesTemplateId(templateIdRaw: string, meetingSeriesId: string): Promise<string | null> {
  const templateId = String(templateIdRaw || '').trim();
  if (!templateId) return null;
  if (!mongoose.isValidObjectId(templateId)) {
    throw new Error('Ungültige Sitzungsvorlage');
  }

  const template = await MinutesTemplate.findOne({
    _id: templateId,
    isActive: true,
    $or: [
      { scope: 'global' },
      { scope: 'series', meetingSeriesId: new mongoose.Types.ObjectId(meetingSeriesId) },
    ],
  })
    .select('_id')
    .lean();

  if (!template) {
    throw new Error('Sitzungsvorlage nicht gefunden oder inaktiv');
  }

  return templateId;
}

async function resolvePdfTemplateId(templateIdRaw: string): Promise<string | null> {
  const templateId = String(templateIdRaw || '').trim();
  if (!templateId) return null;
  if (!mongoose.isValidObjectId(templateId)) {
    throw new Error('Ungültige PDF-Vorlage');
  }

  const template = await PdfTemplate.findOne({
    _id: templateId,
    isActive: true,
  })
    .select('_id')
    .lean();

  if (!template) {
    throw new Error('PDF-Vorlage nicht gefunden oder inaktiv');
  }

  return templateId;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const event = await MeetingEvent.findById(id).lean();
    if (!event) return NextResponse.json({ error: 'Meeting event not found' }, { status: 404 });

    const user = authResult.user;
    const userId = user._id.toString();
    const username = user.username;
    const isAdmin = user.role === 'admin';
    const canViewAll = await hasPermission(user, 'canViewAllMeetings');

    const series = await MeetingSeries.findById(event.meetingSeriesId).lean();
    if (!series) return NextResponse.json({ error: 'Meeting series not found' }, { status: 404 });
    if (!hasSeriesAccess(series, username, userId, isAdmin, canViewAll)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error('Error fetching meeting event:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting event' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
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
    if (!canManageSeries(series, username, userId, isAdmin, canModerateAll)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = ['title', 'scheduledDate', 'startTime', 'endTime', 'location', 'note', 'status'] as const;
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'scheduledDate') {
          const dateValue = new Date(String(body[field]));
          if (Number.isNaN(dateValue.getTime())) {
            return NextResponse.json({ error: 'Invalid scheduledDate' }, { status: 400 });
          }
          (event as any)[field] = dateValue;
        } else {
          (event as any)[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
        }
      }
    }

    if (body.minutesTemplateId !== undefined) {
      try {
        const resolvedTemplateId = await resolveMinutesTemplateId(
          String(body.minutesTemplateId || ''),
          String(event.meetingSeriesId)
        );
        event.minutesTemplateId = resolvedTemplateId || undefined;
      } catch (validationError) {
        return NextResponse.json(
          { error: validationError instanceof Error ? validationError.message : 'Ungültige Sitzungsvorlage' },
          { status: 400 }
        );
      }
    }

    if (body.pdfTemplateId !== undefined) {
      try {
        const resolvedPdfTemplateId = await resolvePdfTemplateId(String(body.pdfTemplateId || ''));
        event.pdfTemplateId = resolvedPdfTemplateId || undefined;
      } catch (validationError) {
        return NextResponse.json(
          { error: validationError instanceof Error ? validationError.message : 'Ungültige PDF-Vorlage' },
          { status: 400 }
        );
      }
    }

    if (Array.isArray(body.inviteeUserIds)) {
      const allowedInvitees = new Set(
        Array.isArray(series.members) ? series.members.map((member: any) => String(member.userId)) : []
      );
      const inviteeUserIds = body.inviteeUserIds
        .map((value: unknown) => String(value || '').trim())
        .filter((value: string) => allowedInvitees.has(value));
      const deduped: string[] = Array.from(new Set(inviteeUserIds));

      const currentByUserId = new Map(event.invitees.map((invitee: any) => [String(invitee.userId), invitee]));
      event.invitees = deduped.map((inviteeId: string) => {
        const existing = currentByUserId.get(inviteeId);
        return (
          existing || {
            userId: inviteeId,
            responseStatus: 'pending',
          }
        );
      });
      event.markModified('invitees');
    }

    event.updatedBy = userId;
    await event.save();

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error('Error updating meeting event:', error);
    return NextResponse.json({ error: 'Failed to update meeting event' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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
    if (!canManageSeries(series, username, userId, isAdmin, canModerateAll)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const inviteeIds = event.invitees.map((invitee: any) => String(invitee.userId)).filter(Boolean);
    const userLookup = await lookupUsersByIdentifiers(inviteeIds, '_id email firstName lastName preferences');
    const notifiedEmails = new Set<string>();

    for (const invitee of event.invitees) {
      const resolved = userLookup.get(normalizeIdentifier(String(invitee.userId))) as any;
      const email = String(resolved?.email || invitee.emailSnapshot || '').trim().toLowerCase();
      if (!email || notifiedEmails.has(email)) continue;
      notifiedEmails.add(email);

      const locale = resolved?.preferences?.language === 'en' ? 'en' : 'de';
      try {
        await sendMeetingCancellationEmail(
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
          },
          locale
        );
      } catch (notifyError) {
        console.error(`Failed to send cancellation email to ${email}`, notifyError);
      }
    }

    await MeetingEvent.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: 'Meeting event deleted' });
  } catch (error) {
    console.error('Error deleting meeting event:', error);
    return NextResponse.json({ error: 'Failed to delete meeting event' }, { status: 500 });
  }
}
