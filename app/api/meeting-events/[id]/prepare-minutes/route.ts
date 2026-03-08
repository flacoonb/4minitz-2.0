import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MeetingEvent from '@/models/MeetingEvent';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

type AttendanceStatus = 'present' | 'excused' | 'absent';

function mapResponseToAttendance(responseStatus: string): AttendanceStatus {
  if (responseStatus === 'accepted') return 'present';
  if (responseStatus === 'declined') return 'absent';
  if (responseStatus === 'tentative') return 'excused';
  return 'excused';
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

    const byUserId = new Map<string, AttendanceStatus>();
    for (const invitee of event.invitees) {
      const inviteeId = String((invitee as any).userId || '').trim();
      if (!inviteeId) continue;
      byUserId.set(inviteeId, mapResponseToAttendance((invitee as any).responseStatus));
    }

    if (Array.isArray(series.members)) {
      for (const member of series.members as any[]) {
        const memberId = String(member?.userId || '').trim();
        if (!memberId || byUserId.has(memberId)) continue;
        byUserId.set(memberId, 'excused');
      }
    }

    const participantsWithStatus = Array.from(byUserId.entries()).map(([memberId, attendance]) => ({
      userId: memberId,
      attendance,
    }));
    const participants = participantsWithStatus.map((entry) => entry.userId);
    const visibleFor = Array.from(new Set([...(series.moderators || []), ...(series.participants || [])]));

    let minute: any = null;
    if (event.linkedMinutesId) {
      minute = await Minutes.findById(event.linkedMinutesId);
    }
    if (!minute) {
      minute = await Minutes.findOne({
        meetingSeries_id: event.meetingSeriesId,
        isFinalized: false,
      }).sort({ createdAt: -1 });
    }

    const meetingDate = new Date(event.scheduledDate);
    const autoTitle = event.title || `${series.project}${series.name ? ` – ${series.name}` : ''}`;

    if (!minute) {
      minute = await Minutes.create({
        meetingSeries_id: event.meetingSeriesId,
        date: meetingDate,
        title: autoTitle,
        time: event.startTime,
        endTime: event.endTime || '',
        location: event.location || '',
        participants,
        participantsWithStatus,
        topics: [],
        globalNote: event.note || '',
        isFinalized: false,
        visibleFor,
        createdBy: userId,
      });
    } else {
      minute.date = meetingDate;
      minute.title = minute.title || autoTitle;
      minute.time = event.startTime || minute.time;
      minute.endTime = event.endTime || minute.endTime;
      minute.location = event.location || minute.location;
      minute.participants = participants;
      minute.participantsWithStatus = participantsWithStatus;
      if (!minute.globalNote && event.note) minute.globalNote = event.note;
      minute.markModified('participantsWithStatus');
      await minute.save();
    }

    event.linkedMinutesId = minute._id.toString();
    event.updatedBy = userId;
    if (event.status === 'draft') event.status = 'confirmed';
    await event.save();

    return NextResponse.json({
      success: true,
      data: {
        minutesId: minute._id,
        meetingEventId: event._id,
      },
    });
  } catch (error) {
    console.error('Error preparing minutes from event:', error);
    return NextResponse.json({ error: 'Failed to prepare minutes' }, { status: 500 });
  }
}
