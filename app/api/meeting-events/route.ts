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

function canAccessSeries(series: any, username: string, userId: string, canViewAll: boolean, isAdmin: boolean): boolean {
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
  })
    .select('_id')
    .lean();

  if (!template) {
    throw new Error('PDF-Vorlage nicht gefunden');
  }

  return templateId;
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const userId = user._id.toString();
    const username = user.username;
    const isAdmin = user.role === 'admin';
    const canViewAll = await hasPermission(user, 'canViewAllMeetings');

    const meetingSeriesId = new URL(request.url).searchParams.get('meetingSeriesId')?.trim();
    if (meetingSeriesId) {
      const series = await MeetingSeries.findById(meetingSeriesId).lean();
      if (!series) return NextResponse.json({ error: 'Meeting series not found' }, { status: 404 });
      if (!canAccessSeries(series, username, userId, canViewAll, isAdmin)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const events = await MeetingEvent.find({ meetingSeriesId }).sort({ scheduledDate: 1, startTime: 1 }).lean();
      return NextResponse.json({ success: true, data: events });
    }

    if (isAdmin || canViewAll) {
      const events = await MeetingEvent.find({}).sort({ scheduledDate: 1, startTime: 1 }).lean();
      return NextResponse.json({ success: true, data: events });
    }

    const accessibleSeries = await MeetingSeries.find({
      $or: [
        { visibleFor: { $in: [username, userId] } },
        { moderators: { $in: [username, userId] } },
        { participants: { $in: [username, userId] } },
        { 'members.userId': userId },
      ],
    })
      .select('_id')
      .lean();

    const seriesIds = accessibleSeries.map((series: any) => String(series._id));
    const events = await MeetingEvent.find({ meetingSeriesId: { $in: seriesIds } })
      .sort({ scheduledDate: 1, startTime: 1 })
      .lean();
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('Error fetching meeting events:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const userId = user._id.toString();
    const username = user.username;
    const isAdmin = user.role === 'admin';
    const canCreateMeetings = await hasPermission(user, 'canCreateMeetings');
    if (!canCreateMeetings) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const meetingSeriesId = String(body.meetingSeriesId || '').trim();
    const title = String(body.title || '').trim();
    const startTime = String(body.startTime || '').trim();
    const endTime = String(body.endTime || '').trim();
    const location = String(body.location || '').trim();
    const note = String(body.note || '').trim();
    const minutesTemplateIdInput = String(body.minutesTemplateId || '').trim();
    const pdfTemplateIdInput = String(body.pdfTemplateId || '').trim();
    const scheduledDateRaw = String(body.scheduledDate || '').trim();
    const inviteeUserIds = Array.isArray(body.inviteeUserIds)
      ? body.inviteeUserIds.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : [];

    if (!meetingSeriesId || !title || !scheduledDateRaw || !startTime) {
      return NextResponse.json(
        { error: 'meetingSeriesId, title, scheduledDate and startTime are required' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledDateRaw);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledDate' }, { status: 400 });
    }

    const series = await MeetingSeries.findById(meetingSeriesId).lean();
    if (!series) return NextResponse.json({ error: 'Meeting series not found' }, { status: 404 });

    const isSeriesModerator =
      series.moderators?.includes(username) || series.moderators?.includes(userId);
    const isSeriesParticipant =
      series.visibleFor?.includes(username) ||
      series.visibleFor?.includes(userId) ||
      series.participants?.includes(username) ||
      series.participants?.includes(userId) ||
      (Array.isArray(series.members) && series.members.some((member: any) => member?.userId === userId));
    const canModerateAll = await hasPermission(user, 'canModerateAllMeetings');

    if (!isAdmin && !canModerateAll && !isSeriesModerator && !isSeriesParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let minutesTemplateId: string | undefined;
    let pdfTemplateId: string | undefined;
    try {
      const resolvedMinutesTemplateId = await resolveMinutesTemplateId(minutesTemplateIdInput, meetingSeriesId);
      const resolvedPdfTemplateId = await resolvePdfTemplateId(pdfTemplateIdInput);
      minutesTemplateId = resolvedMinutesTemplateId || undefined;
      pdfTemplateId = resolvedPdfTemplateId || undefined;
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : 'Ungültige Vorlage' },
        { status: 400 }
      );
    }

    const allowedInvitees = new Set(
      Array.isArray(series.members) ? series.members.map((member: any) => String(member.userId)) : []
    );
    const normalizedInvitees: string[] = Array.from(
      new Set(inviteeUserIds.filter((id: string) => allowedInvitees.has(id)))
    );

    const userLookup = await lookupUsersByIdentifiers(normalizedInvitees, '_id email');
    const invitees = normalizedInvitees.map((inviteeId: string) => {
      const resolved = userLookup.get(normalizeIdentifier(inviteeId)) as any;
      const emailSnapshot = String(resolved?.email || '').trim().toLowerCase();
      return {
        userId: inviteeId,
        emailSnapshot: emailSnapshot || undefined,
        responseStatus: 'pending' as const,
      };
    });

    const event = await MeetingEvent.create({
      meetingSeriesId,
      title,
      scheduledDate,
      startTime,
      endTime: endTime || undefined,
      location: location || undefined,
      note: note || undefined,
      minutesTemplateId,
      pdfTemplateId,
      invitees,
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('Error creating meeting event:', error);
    return NextResponse.json({ error: 'Failed to create meeting event' }, { status: 500 });
  }
}
