import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { hasPermission } from '@/lib/permissions';
import MeetingSeries from '@/models/MeetingSeries';
import MinutesTemplate from '@/models/MinutesTemplate';
import {
  applyResponsibleSnapshotsToTopics,
  extractResponsibleValuesFromTopics,
  sanitizeResponsibles,
  validateFunctionResponsibles,
} from '@/lib/club-functions';

type SeriesAccessResult = {
  exists: boolean;
  canAccess: boolean;
  canModerate: boolean;
};

function normalizeDateValue(input: unknown): Date | undefined {
  if (typeof input !== 'string' || !input.trim()) return undefined;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function sanitizeTemplateContent(raw: any) {
  const topics = Array.isArray(raw?.topics) ? raw.topics : [];
  const sanitizedTopics = topics
    .map((topic: any) => {
      const subject = typeof topic?.subject === 'string' ? topic.subject.trim() : '';
      const infoItems = Array.isArray(topic?.infoItems)
        ? topic.infoItems
            .map((item: any) => {
              const itemSubject = typeof item?.subject === 'string' ? item.subject.trim() : '';
              if (!itemSubject) return null;
              return {
                subject: itemSubject,
                details: typeof item?.details === 'string' ? item.details : '',
                itemType: item?.itemType === 'actionItem' ? 'actionItem' : 'infoItem',
                status:
                  item?.status === 'open' ||
                  item?.status === 'in-progress' ||
                  item?.status === 'completed' ||
                  item?.status === 'cancelled'
                    ? item.status
                    : 'open',
                priority:
                  item?.priority === 'high' || item?.priority === 'medium' || item?.priority === 'low'
                    ? item.priority
                    : 'medium',
                dueDate: normalizeDateValue(item?.dueDate),
                responsibles: sanitizeResponsibles(item?.responsibles),
                notes: typeof item?.notes === 'string' ? item.notes : '',
              };
            })
            .filter(Boolean)
        : [];
      if (!subject) return null;
      return {
        subject,
        responsibles: sanitizeResponsibles(topic?.responsibles),
        infoItems,
      };
    })
    .filter(Boolean);

  const topicsWithSnapshots = await applyResponsibleSnapshotsToTopics(sanitizedTopics as any[]);

  return {
    title: typeof raw?.title === 'string' ? raw.title : '',
    time: typeof raw?.time === 'string' ? raw.time : '',
    endTime: typeof raw?.endTime === 'string' ? raw.endTime : '',
    location: typeof raw?.location === 'string' ? raw.location : '',
    globalNote: typeof raw?.globalNote === 'string' ? raw.globalNote : '',
    topics: topicsWithSnapshots,
  };
}

async function getSeriesAccess(user: any, meetingSeriesId: string): Promise<SeriesAccessResult> {
  const series = await MeetingSeries.findById(meetingSeriesId).lean();
  if (!series) return { exists: false, canAccess: false, canModerate: false };

  if (user.role === 'admin') {
    return { exists: true, canAccess: true, canModerate: true };
  }

  const username = user.username;
  const userId = user._id.toString();
  const canViewAllMeetings = await hasPermission(user, 'canViewAllMeetings');
  const canModerateAllMeetings = await hasPermission(user, 'canModerateAllMeetings');

  const isSeriesModerator =
    series.moderators?.includes(username) || series.moderators?.includes(userId);
  const isSeriesParticipant =
    series.visibleFor?.includes(username) ||
    series.visibleFor?.includes(userId) ||
    series.participants?.includes(username) ||
    series.participants?.includes(userId) ||
    (Array.isArray(series.members) && series.members.some((m: any) => m.userId === userId));

  return {
    exists: true,
    canAccess: Boolean(canViewAllMeetings || isSeriesModerator || isSeriesParticipant),
    canModerate: Boolean(canModerateAllMeetings || isSeriesModerator),
  };
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;
    const { searchParams } = new URL(request.url);
    const meetingSeriesId = searchParams.get('meetingSeriesId');
    const scope = searchParams.get('scope');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const canUseTemplates = await hasPermission(user, 'canUseTemplates' as any);
    const canManageGlobalTemplates = await hasPermission(user, 'canManageGlobalTemplates' as any);
    const canManageSeriesTemplates = await hasPermission(user, 'canManageSeriesTemplates' as any);

    const isAdmin = user.role === 'admin';
    if (!isAdmin && !canUseTemplates && !canManageGlobalTemplates && !canManageSeriesTemplates) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const query: any = {};
    if (!includeInactive) query.isActive = true;
    if (scope === 'global' || scope === 'series') query.scope = scope;

    if (meetingSeriesId) {
      if (!mongoose.isValidObjectId(meetingSeriesId)) {
        return NextResponse.json({ error: 'Invalid meetingSeriesId' }, { status: 400 });
      }

      const seriesAccess = await getSeriesAccess(user, meetingSeriesId);
      if (!seriesAccess.exists) {
        return NextResponse.json({ error: 'Meeting series not found' }, { status: 404 });
      }
      if (!seriesAccess.canAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      query.$or = [
        ...(isAdmin || canUseTemplates || canManageGlobalTemplates ? [{ scope: 'global' }] : []),
        { scope: 'series', meetingSeriesId: new mongoose.Types.ObjectId(meetingSeriesId) },
      ];
    } else if (!query.scope) {
      // Without series context, default to global templates.
      query.scope = 'global';
    }

    const templates = await MinutesTemplate.find(query).sort({ scope: 1, name: 1 }).lean();
    return NextResponse.json({ success: true, count: templates.length, data: templates });
  } catch (error) {
    console.error('Error loading minutes templates:', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;
    const isAdmin = user.role === 'admin';
    const userId = user._id.toString();
    const body = await request.json();

    const {
      name,
      description,
      scope,
      meetingSeriesId,
      isActive = true,
      content,
    } = body;

    if (!name || !scope || !content || !Array.isArray(content.topics)) {
      return NextResponse.json(
        { error: 'name, scope and content.topics are required' },
        { status: 400 }
      );
    }

    if (!['global', 'series'].includes(scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    if (scope === 'global') {
      const canManageGlobalTemplates = await hasPermission(user, 'canManageGlobalTemplates' as any);
      if (!isAdmin && !canManageGlobalTemplates) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (scope === 'series') {
      if (!meetingSeriesId || !mongoose.isValidObjectId(meetingSeriesId)) {
        return NextResponse.json({ error: 'Valid meetingSeriesId is required' }, { status: 400 });
      }
      const canManageSeriesTemplates = await hasPermission(user, 'canManageSeriesTemplates' as any);
      if (!isAdmin && !canManageSeriesTemplates) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const seriesAccess = await getSeriesAccess(user, meetingSeriesId);
      if (!seriesAccess.exists) {
        return NextResponse.json({ error: 'Meeting series not found' }, { status: 404 });
      }
      if (!seriesAccess.canModerate) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const sanitizedContent = await sanitizeTemplateContent(content);
    const validation = await validateFunctionResponsibles(
      extractResponsibleValuesFromTopics(sanitizedContent.topics as any[])
    );
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Ungültige Vereinsfunktion' }, { status: 400 });
    }
    const hasEntries = sanitizedContent.topics.some((topic: any) => (topic.infoItems || []).length > 0);
    if (!hasEntries) {
      return NextResponse.json(
        { error: 'Mindestens ein Traktandum mit mindestens einem Eintrag ist erforderlich.' },
        { status: 400 }
      );
    }

    const template = await MinutesTemplate.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      scope,
      meetingSeriesId: scope === 'series' ? meetingSeriesId : undefined,
      isActive: Boolean(isActive),
      content: sanitizedContent,
      createdBy: userId,
      updatedBy: userId,
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    console.error('Error creating minutes template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
