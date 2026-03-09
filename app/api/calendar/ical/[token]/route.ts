import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import MeetingSeries from '@/models/MeetingSeries';
import MeetingEvent from '@/models/MeetingEvent';
import { hasPermission } from '@/lib/permissions';

interface CalendarEventItem {
  _id: string;
  meetingSeriesId: string;
  title: string;
  scheduledDate: Date;
  startTime: string;
  endTime?: string;
  location?: string;
  note?: string;
  status: 'draft' | 'invited' | 'confirmed' | 'cancelled' | 'completed';
  updatedAt?: Date;
  invitees?: Array<{ userId?: string }>;
}

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDateParts(input: Date): { year: number; month: number; day: number } {
  const iso = input.toISOString().slice(0, 10);
  const [y, m, d] = iso.split('-').map((part) => Number(part));
  return { year: y, month: m, day: d };
}

function parseTimeParts(rawTime: string): { hours: number; minutes: number } {
  const match = rawTime.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { hours: 9, minutes: 0 };
  return {
    hours: Math.min(23, Math.max(0, Number(match[1]))),
    minutes: Math.min(59, Math.max(0, Number(match[2]))),
  };
}

function toIcalLocalDateTime(date: Date, time: string): string {
  const dateParts = parseDateParts(date);
  const timeParts = parseTimeParts(time);
  return `${dateParts.year}${pad(dateParts.month)}${pad(dateParts.day)}T${pad(timeParts.hours)}${pad(
    timeParts.minutes
  )}00`;
}

function addOneHour(time: string): string {
  const { hours, minutes } = parseTimeParts(time);
  const totalMinutes = hours * 60 + minutes + 60;
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHours = Math.floor(wrapped / 60);
  const nextMinutes = wrapped % 60;
  return `${pad(nextHours)}:${pad(nextMinutes)}`;
}

function toUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function toSeriesLabel(series: any): string {
  const project = String(series?.project || '').trim();
  const name = String(series?.name || '').trim();
  return name ? `${project} - ${name}` : project || 'Meeting';
}

function mapStatusToSummarySuffix(status: CalendarEventItem['status']): string {
  if (status === 'cancelled') return ' (Cancelled)';
  if (status === 'completed') return ' (Completed)';
  if (status === 'draft') return ' (Draft)';
  return '';
}

function normalizeToken(token: string): string {
  return token.trim();
}

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const { token: rawToken } = await context.params;
    const token = normalizeToken(rawToken);
    if (!/^[a-fA-F0-9]{64}$/.test(token)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const user = await User.findOne({ calendarFeedToken: token, isActive: true })
      .select('_id username usernameHistory email role')
      .lean();

    if (!user) {
      return new NextResponse('Not found', { status: 404 });
    }

    const userId = String(user._id);
    const username = String(user.username || '').trim();
    const usernameHistory = Array.isArray((user as any).usernameHistory)
      ? (user as any).usernameHistory.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : [];
    const userEmail = String((user as any).email || '').trim().toLowerCase();
    const identityCandidates = Array.from(new Set([userId, username, ...usernameHistory].filter(Boolean)));
    const isAdmin = user.role === 'admin';
    const canViewAllMeetings = await hasPermission(user as any, 'canViewAllMeetings');

    let seriesDocs: any[] = [];
    if (isAdmin || canViewAllMeetings) {
      seriesDocs = await MeetingSeries.find({}).select('_id project name').lean();
    } else {
      seriesDocs = await MeetingSeries.find({
        $or: [
          { visibleFor: { $in: identityCandidates } },
          { moderators: { $in: identityCandidates } },
          { participants: { $in: identityCandidates } },
          { 'members.userId': userId },
        ],
      })
        .select('_id project name')
        .lean();
    }

    const seriesById = new Map<string, any>();
    for (const series of seriesDocs) {
      seriesById.set(String(series._id), series);
    }

    const seriesIds = Array.from(seriesById.keys());
    const eventQuery =
      isAdmin || canViewAllMeetings
        ? {}
        : {
            $or: [
              ...(seriesIds.length > 0 ? [{ meetingSeriesId: { $in: seriesIds } }] : []),
              { 'invitees.userId': { $in: identityCandidates } },
              ...(userEmail ? [{ 'invitees.emailSnapshot': userEmail }] : []),
            ],
          };
    const events = (await MeetingEvent.find(eventQuery)
      .sort({ scheduledDate: 1, startTime: 1 })
      .select('meetingSeriesId title scheduledDate startTime endTime location note status updatedAt invitees')
      .lean()) as unknown as CalendarEventItem[];

    // Backfill series labels for events that are visible via direct invitee match.
    const missingSeriesIds = Array.from(
      new Set(
        events
          .map((event) => String(event.meetingSeriesId || '').trim())
          .filter((id) => id && !seriesById.has(id))
      )
    );
    if (missingSeriesIds.length > 0) {
      const missingSeries = await MeetingSeries.find({ _id: { $in: missingSeriesIds } })
        .select('_id project name')
        .lean();
      for (const series of missingSeries) {
        seriesById.set(String(series._id), series);
      }
    }

    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`.replace(/\/+$/, '');
    const now = new Date();
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//4Minitz//Meeting Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:4Minitz Meetings',
      'X-WR-TIMEZONE:Europe/Zurich',
      'X-PUBLISHED-TTL:PT30M',
    ];

    for (const event of events) {
      const series = seriesById.get(String(event.meetingSeriesId));
      const seriesLabel = toSeriesLabel(series);
      const startsAt = toIcalLocalDateTime(event.scheduledDate, event.startTime);
      const endsAt = toIcalLocalDateTime(event.scheduledDate, event.endTime || addOneHour(event.startTime));
      const summary = `${seriesLabel}: ${String(event.title || '').trim()}${mapStatusToSummarySuffix(event.status)}`;
      const details = [event.note, `Series: ${seriesLabel}`, `Status: ${event.status}`].filter(Boolean).join('\n');
      const location = String(event.location || '').trim();
      const status = event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
      const eventUrl = `${baseUrl}/meeting-series/${event.meetingSeriesId}`;
      const updatedAt = event.updatedAt ? new Date(event.updatedAt) : now;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:meeting-event-${event._id}@4minitz`);
      lines.push(`DTSTAMP:${toUtcStamp(updatedAt)}`);
      lines.push(`DTSTART;TZID=Europe/Zurich:${startsAt}`);
      lines.push(`DTEND;TZID=Europe/Zurich:${endsAt}`);
      lines.push(`SUMMARY:${escapeIcalText(summary)}`);
      lines.push(`DESCRIPTION:${escapeIcalText(details)}`);
      if (location) lines.push(`LOCATION:${escapeIcalText(location)}`);
      lines.push(`STATUS:${status}`);
      lines.push(`URL:${escapeIcalText(eventUrl)}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    const body = `${lines.join('\r\n')}\r\n`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Content-Disposition': 'inline; filename="4minitz-calendar.ics"',
      },
    });
  } catch (error) {
    console.error('Error generating iCal feed:', error);
    return new NextResponse('Failed to generate iCal feed', { status: 500 });
  }
}
