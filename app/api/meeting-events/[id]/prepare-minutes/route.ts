import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import MeetingEvent from '@/models/MeetingEvent';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import MinutesTemplate from '@/models/MinutesTemplate';
import PdfTemplate from '@/models/PdfTemplate';
import User from '@/models/User';
import ClubFunction from '@/models/ClubFunction';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import {
  applyResponsibleSnapshotsToTopics,
  buildFunctionAssignmentMap,
  extractResponsibleValuesFromTopics,
  validateAssignmentsForResponsibles,
  validateFunctionResponsibles,
} from '@/lib/club-functions';

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

function normalizeAttendance(value: unknown): AttendanceStatus {
  const status = String(value || '').trim();
  if (status === 'present' || status === 'absent' || status === 'excused') return status;
  return 'excused';
}

function normalizeTemplateId(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
}

async function resolveMinutesTemplate(event: any, series: any): Promise<any | null> {
  const explicitTemplateId = normalizeTemplateId(event?.minutesTemplateId);
  const seriesDefaultTemplateId = normalizeTemplateId(series?.defaultTemplateId);
  const effectiveTemplateId = explicitTemplateId || seriesDefaultTemplateId;
  const meetingSeriesId = String(event?.meetingSeriesId || '').trim();

  if (
    !effectiveTemplateId ||
    !mongoose.isValidObjectId(effectiveTemplateId) ||
    !meetingSeriesId ||
    !mongoose.isValidObjectId(meetingSeriesId)
  ) {
    return null;
  }

  return MinutesTemplate.findOne({
    _id: effectiveTemplateId,
    isActive: true,
    $or: [
      { scope: 'global' },
      { scope: 'series', meetingSeriesId: new mongoose.Types.ObjectId(meetingSeriesId) },
    ],
  }).lean();
}

async function resolvePdfTemplate(event: any, series: any): Promise<any | null> {
  const explicitTemplateId = normalizeTemplateId(event?.pdfTemplateId);
  const seriesDefaultTemplateId = normalizeTemplateId(series?.defaultPdfTemplateId);
  const effectiveTemplateId = explicitTemplateId || seriesDefaultTemplateId;

  if (!effectiveTemplateId || !mongoose.isValidObjectId(effectiveTemplateId)) {
    return null;
  }

  return PdfTemplate.findOne({
    _id: effectiveTemplateId,
  }).lean();
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

    let participantsWithStatus = Array.from(byUserId.entries()).map(([memberId, attendance]) => ({
      userId: memberId,
      attendance,
    }));
    let participants = participantsWithStatus.map((entry) => entry.userId);
    const visibleFor = Array.from(new Set([...(series.moderators || []), ...(series.participants || [])]));

    const resolvedTemplate = await resolveMinutesTemplate(event, series);
    const resolvedPdfTemplate = await resolvePdfTemplate(event, series);
    const templateContent = resolvedTemplate?.content || {};
    const templateTopicsRaw = Array.isArray(templateContent?.topics) ? templateContent.topics : [];

    const functionValidation = await validateFunctionResponsibles(
      extractResponsibleValuesFromTopics(templateTopicsRaw)
    );
    if (!functionValidation.valid) {
      return NextResponse.json(
        { error: functionValidation.error || 'Ungültige Vereinsfunktion in der Sitzungsvorlage' },
        { status: 400 }
      );
    }

    const functionTokens = extractResponsibleValuesFromTopics(templateTopicsRaw).filter((value) =>
      value.startsWith('function:')
    );
    const functionSlugs = functionTokens.map((value) => value.replace(/^function:/, ''));
    const assignedFunctions = await ClubFunction.find({ slug: { $in: functionSlugs } })
      .select('slug assignedUserId')
      .lean();
    const assignmentMap = buildFunctionAssignmentMap(assignedFunctions as any[]);
    const assignmentValidation = validateAssignmentsForResponsibles(
      extractResponsibleValuesFromTopics(templateTopicsRaw),
      assignmentMap
    );
    if (!assignmentValidation.valid) {
      return NextResponse.json(
        { error: assignmentValidation.error || 'Vereinsfunktion ohne Personenzuordnung' },
        { status: 400 }
      );
    }

    const assignmentUserIds = Array.from(
      new Set(
        assignedFunctions
          .map((entry: any) => String(entry.assignedUserId || '').trim())
          .filter(Boolean)
      )
    );
    const assignmentUsers =
      assignmentUserIds.length > 0
        ? await User.find({ _id: { $in: assignmentUserIds } })
            .select('_id firstName lastName username')
            .lean()
        : [];
    const templateTopics = await applyResponsibleSnapshotsToTopics(templateTopicsRaw, assignmentUsers as any[]);

    let minute: any = null;
    if (event.linkedMinutesId) {
      minute = await Minutes.findById(event.linkedMinutesId);
    }
    if (!minute) {
      const latestDraft = await Minutes.findOne({
        meetingSeries_id: event.meetingSeriesId,
        isFinalized: false,
      }).sort({ createdAt: -1 });

      if (latestDraft) {
        const linkedByOtherEvent = await MeetingEvent.findOne({
          _id: { $ne: event._id },
          linkedMinutesId: latestDraft._id.toString(),
        })
          .select('_id')
          .lean();

        // Reuse only unlinked drafts (or the draft already linked to this event via linkedMinutesId above).
        // This prevents cross-linking different meeting events to the same draft minute.
        if (!linkedByOtherEvent) {
          minute = latestDraft;
        }
      }
    }

    if (minute) {
      const mergedByUserId = new Map<string, AttendanceStatus>();
      const existingParticipantsWithStatus = Array.isArray(minute.participantsWithStatus)
        ? minute.participantsWithStatus
        : [];

      for (const participant of existingParticipantsWithStatus) {
        const participantId = String((participant as any)?.userId || '').trim();
        if (!participantId) continue;
        mergedByUserId.set(participantId, normalizeAttendance((participant as any)?.attendance));
      }

      for (const [memberId, attendance] of byUserId.entries()) {
        if (mergedByUserId.has(memberId)) continue;
        mergedByUserId.set(memberId, attendance);
      }

      participantsWithStatus = Array.from(mergedByUserId.entries()).map(([memberId, attendance]) => ({
        userId: memberId,
        attendance,
      }));
      participants = participantsWithStatus
        .map((entry) => entry.userId)
        .filter((entryUserId) => !entryUserId.startsWith('guest:'));
    }

    const meetingDate = new Date(event.scheduledDate);
    const autoTitle = event.title || `${series.project}${series.name ? ` – ${series.name}` : ''}`;
    const finalTitle = event.title || templateContent.title || autoTitle;
    const finalTime = event.startTime || templateContent.time || '';
    const finalEndTime = event.endTime || templateContent.endTime || '';
    const finalLocation = event.location || templateContent.location || '';
    const finalGlobalNote = event.note || templateContent.globalNote || '';

    if (!minute) {
      minute = await Minutes.create({
        meetingSeries_id: event.meetingSeriesId,
        date: meetingDate,
        title: finalTitle,
        time: finalTime,
        endTime: finalEndTime,
        location: finalLocation,
        participants,
        participantsWithStatus,
        topics: templateTopics,
        globalNote: finalGlobalNote,
        isFinalized: false,
        visibleFor,
        createdBy: userId,
        templateId: resolvedTemplate?._id?.toString(),
        templateNameSnapshot: resolvedTemplate?.name || '',
        pdfTemplateId: resolvedPdfTemplate?._id?.toString(),
        pdfTemplateNameSnapshot: resolvedPdfTemplate?.name || '',
      });
    } else {
      minute.date = meetingDate;
      minute.title = minute.title || finalTitle;
      minute.time = event.startTime || minute.time || templateContent.time || '';
      minute.endTime = event.endTime || minute.endTime || templateContent.endTime || '';
      minute.location = event.location || minute.location || templateContent.location || '';
      minute.participants = participants;
      minute.participantsWithStatus = participantsWithStatus;
      if (!minute.globalNote && finalGlobalNote) minute.globalNote = finalGlobalNote;
      if ((!Array.isArray(minute.topics) || minute.topics.length === 0) && templateTopics.length > 0) {
        minute.topics = templateTopics;
        minute.markModified('topics');
      }
      if (!minute.templateId && resolvedTemplate?._id) {
        minute.templateId = resolvedTemplate._id.toString();
        minute.templateNameSnapshot = resolvedTemplate.name || '';
      }
      if (!(minute as any).pdfTemplateId && resolvedPdfTemplate?._id) {
        (minute as any).pdfTemplateId = resolvedPdfTemplate._id.toString();
        (minute as any).pdfTemplateNameSnapshot = resolvedPdfTemplate.name || '';
      }
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
