import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { hasPermission } from '@/lib/permissions';
import MeetingSeries from '@/models/MeetingSeries';
import MinutesTemplate from '@/models/MinutesTemplate';

function normalizeDateValue(input: unknown): Date | undefined {
  if (typeof input !== 'string' || !input.trim()) return undefined;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function sanitizeTemplateContent(raw: any) {
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
                responsibles: Array.isArray(item?.responsibles)
                  ? item.responsibles.filter((entry: unknown) => typeof entry === 'string' && entry.trim())
                  : [],
                notes: typeof item?.notes === 'string' ? item.notes : '',
              };
            })
            .filter(Boolean)
        : [];
      if (!subject) return null;
      return {
        subject,
        responsibles: Array.isArray(topic?.responsibles)
          ? topic.responsibles.filter((entry: unknown) => typeof entry === 'string' && entry.trim())
          : [],
        infoItems,
      };
    })
    .filter(Boolean);

  return {
    title: typeof raw?.title === 'string' ? raw.title : '',
    time: typeof raw?.time === 'string' ? raw.time : '',
    endTime: typeof raw?.endTime === 'string' ? raw.endTime : '',
    location: typeof raw?.location === 'string' ? raw.location : '',
    globalNote: typeof raw?.globalNote === 'string' ? raw.globalNote : '',
    topics: sanitizedTopics,
  };
}

async function getSeriesAccess(user: any, meetingSeriesId: string) {
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

async function canReadTemplate(user: any, template: any): Promise<boolean> {
  if (user.role === 'admin') return true;

  const canUseTemplates = await hasPermission(user, 'canUseTemplates' as any);
  const canManageGlobalTemplates = await hasPermission(user, 'canManageGlobalTemplates' as any);

  if (template.scope === 'global') {
    return Boolean(canUseTemplates || canManageGlobalTemplates);
  }

  if (!template.meetingSeriesId) return false;
  const seriesAccess = await getSeriesAccess(user, template.meetingSeriesId.toString());
  if (!seriesAccess.exists) return false;
  // For series templates, access must always be bound to the actual series visibility.
  // The permission flag alone must not grant read access across unrelated series.
  return Boolean(seriesAccess.canAccess);
}

async function canWriteTemplate(user: any, template: any): Promise<boolean> {
  if (user.role === 'admin') return true;

  if (template.scope === 'global') {
    return hasPermission(user, 'canManageGlobalTemplates' as any);
  }

  if (!template.meetingSeriesId) return false;
  const canManageSeriesTemplates = await hasPermission(user, 'canManageSeriesTemplates' as any);
  if (!canManageSeriesTemplates) return false;

  const seriesAccess = await getSeriesAccess(user, template.meetingSeriesId.toString());
  return Boolean(seriesAccess.exists && seriesAccess.canModerate);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const template = await MinutesTemplate.findById(id).lean();
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!(await canReadTemplate(auth.user, template))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('Error fetching minutes template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const template = await MinutesTemplate.findById(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!(await canWriteTemplate(auth.user, template))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updatedBy: auth.user._id.toString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.content !== undefined) {
      const sanitizedContent = sanitizeTemplateContent(body.content);
      const hasEntries = sanitizedContent.topics.some((topic: any) => (topic.infoItems || []).length > 0);
      if (!hasEntries) {
        return NextResponse.json(
          { error: 'Mindestens ein Traktandum mit mindestens einem Eintrag ist erforderlich.' },
          { status: 400 }
        );
      }
      updateData.content = sanitizedContent;
    }

    const updatedTemplate = await MinutesTemplate.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return NextResponse.json({ success: true, data: updatedTemplate });
  } catch (error) {
    console.error('Error updating minutes template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const template = await MinutesTemplate.findById(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!(await canWriteTemplate(auth.user, template))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await MinutesTemplate.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting minutes template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
