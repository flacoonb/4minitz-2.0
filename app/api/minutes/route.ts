import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import MinutesTemplate from '@/models/MinutesTemplate';
import User from '@/models/User';
import { sendNewMinutesNotification } from '@/lib/email-service';
import mongoose from 'mongoose';
import { verifyToken } from '@/lib/auth';
import { requirePermission, hasPermission } from '@/lib/permissions';
import { createMinutesSchema, validateBody } from '@/lib/validations';
import {
  applyResponsibleSnapshotsToTopics,
  buildFunctionAssignmentMap,
  extractResponsibleValuesFromTopics,
  validateAssignmentsForResponsibles,
  validateFunctionResponsibles,
} from '@/lib/club-functions';
import ClubFunction from '@/models/ClubFunction';

/**
 * GET /api/minutes
 * Get all minutes (with optional filters)
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const meetingSeriesId = searchParams.get('meetingSeriesId');
    const isFinalized = searchParams.get('isFinalized');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);

    // Determine requesting user (if any) using verifyToken. If unauthenticated
    // allow only public minutes (visibleFor empty). If authenticated, use
    // their username to filter visible minutes.
    const authResult = await verifyToken(request);
    let username: string | null = null;
    let userId: string | null = null;

    if (authResult.success && authResult.user) {
      username = authResult.user.username;
      userId = authResult.user._id.toString();
    }

    // Check permissions via centralized permission system
    const canViewAll = authResult.user
      ? await hasPermission(authResult.user, 'canViewAllMinutes')
      : false;

    // Build the query with proper filters
    const query: Record<string, unknown> = {};

    if (meetingSeriesId) {
      if (!mongoose.isValidObjectId(meetingSeriesId)) {
        return NextResponse.json({ error: 'Invalid meetingSeriesId' }, { status: 400 });
      }
      query.meetingSeries_id = new mongoose.Types.ObjectId(meetingSeriesId);
    }

    if (isFinalized !== null && isFinalized !== undefined) {
      query.isFinalized = isFinalized === 'true';
    }

    // Add visibility filter
    if (username && userId) {
      if (!canViewAll) {
        // 1. Find Series where user is Moderator
        const modSeries = await MeetingSeries.find({
          $or: [
            { moderators: username },
            { moderators: userId }
          ]
        }).select('_id').lean();
        const modSeriesIds = modSeries.map(s => s._id);

        // 2. Find Series where user is Participant/Visible
        const partSeries = await MeetingSeries.find({
          $or: [
            { visibleFor: username },
            { visibleFor: userId },
            { participants: username },
            { participants: userId },
            { 'members.userId': userId }
          ],
          _id: { $nin: modSeriesIds } // Optimization: Exclude ones where they are already mod
        }).select('_id').lean();
        const partSeriesIds = partSeries.map(s => s._id);

        query.$or = [
          // Direct access on Minute document (Legacy/Specific)
          { visibleFor: username },
          { visibleFor: userId },
          { participants: username },
          { participants: userId },
          { moderators: username },
          { moderators: userId },

          // Access via Series Moderator (All minutes, including drafts)
          { meetingSeries_id: { $in: modSeriesIds } },

          // Access via Series Participant (All minutes, including drafts)
          { meetingSeries_id: { $in: partSeriesIds } }
        ];
      }
    } else {
      // Unauthenticated: no access
      return NextResponse.json({
        success: true,
        count: 0,
        total: 0,
        page,
        pages: 0,
        data: [],
      });
    }

    // Fetch minutes with pagination
    const skip = (page - 1) * limit;
    const minutes = await Minutes.find(query)
      .sort({ date: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .populate('meetingSeries_id', 'project name')
      .lean();

    const total = await Minutes.countDocuments(query);

    return NextResponse.json({
      success: true,
      count: minutes.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: minutes,
    });
  } catch (error) {
    console.error('Error fetching minutes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch minutes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/minutes
 * Create a new minute
 * Only admins and moderators are allowed
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission - only users with canCreateMeetings can create minutes
    const permResult = await requirePermission(authResult.user, 'canCreateMeetings');
    if (!permResult.success) {
      return NextResponse.json(
        { error: 'Nur Benutzer mit Protokoll-Erstell-Berechtigung dürfen Protokolle erstellen' },
        { status: 403 }
      );
    }

    const userId = authResult.user._id.toString();
    const body = await request.json();

    const validation = validateBody(createMinutesSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      meetingSeries_id,
      date,
      participants,
      topics,
      agendaItems,
      globalNote,
      title,
      time,
      endTime,
      location,
      templateId,
    } = validation.data;

    // Convert agendaItems to topics format if provided
    let processedTopics = topics || [];
    if (agendaItems && agendaItems.length > 0) {
      processedTopics = agendaItems.map((item: any) => ({
        subject: item.title,
        responsibles: item.responsible ? [item.responsible] : [],
        infoItems: item.entries ? item.entries.map((entry: any) => ({
          subject: entry.subject,
          details: entry.content,
          itemType: 'infoItem',
          status: entry.isCompleted ? 'completed' : 'open'
        })) : []
      }));
    }

    // Check if meeting series exists
    const meetingSeries = await MeetingSeries.findById(meetingSeries_id);
    if (!meetingSeries) {
      return NextResponse.json(
        { error: 'Meeting series not found' },
        { status: 404 }
      );
    }

    // Check if user is authorized
    // Admins and moderators can create minutes for any meeting series
    // Regular users must be a moderator or participant of the specific series
    const username = authResult.user.username;
    const userRole = authResult.user.role;

    if (userRole !== 'admin' && userRole !== 'moderator') {
      // For regular users, check if they're a moderator or participant of this series
      const isModerator =
        meetingSeries.moderators.includes(username) || meetingSeries.moderators.includes(userId);
      const isParticipant =
        meetingSeries.participants.includes(username) ||
        meetingSeries.participants.includes(userId) ||
        meetingSeries.visibleFor?.includes(username) ||
        meetingSeries.visibleFor?.includes(userId) ||
        (Array.isArray(meetingSeries.members) &&
          meetingSeries.members.some((member: any) => member?.userId === userId));

      if (!isModerator && !isParticipant) {
        return NextResponse.json(
          { error: 'Forbidden: You must be a moderator or participant of this meeting series' },
          { status: 403 }
        );
      }
    }

    const explicitTemplateId = typeof templateId === 'string' ? templateId.trim() : '';
    const seriesDefaultTemplateId = meetingSeries.defaultTemplateId
      ? String(meetingSeries.defaultTemplateId)
      : '';
    const effectiveTemplateId = explicitTemplateId || seriesDefaultTemplateId;

    let resolvedTemplate: any = null;
    if (effectiveTemplateId) {
      const isExplicitTemplateSelection = Boolean(explicitTemplateId);

      if (!mongoose.isValidObjectId(effectiveTemplateId)) {
        if (isExplicitTemplateSelection) {
          return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
        }
      } else {
        if (isExplicitTemplateSelection) {
          const canUseTemplates = await hasPermission(authResult.user, 'canUseTemplates' as any);
          const canManageGlobalTemplates = await hasPermission(authResult.user, 'canManageGlobalTemplates' as any);
          const canManageSeriesTemplates = await hasPermission(authResult.user, 'canManageSeriesTemplates' as any);
          const isAdmin = authResult.user.role === 'admin';
          if (!isAdmin && !canUseTemplates && !canManageGlobalTemplates && !canManageSeriesTemplates) {
            return NextResponse.json({ error: 'Forbidden: no template permission' }, { status: 403 });
          }
        }

        const templateFromDb = await MinutesTemplate.findById(effectiveTemplateId).lean();
        if (!templateFromDb || !templateFromDb.isActive) {
          if (isExplicitTemplateSelection) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
          }
        } else {
          if (templateFromDb.scope === 'series') {
            if (templateFromDb.meetingSeriesId?.toString() !== meetingSeries_id.toString()) {
              if (isExplicitTemplateSelection) {
                return NextResponse.json(
                  { error: 'Series template can only be used in its own meeting series' },
                  { status: 400 }
                );
              }
            } else {
              const userIdValue = authResult.user._id.toString();
              const isSeriesModerator =
                meetingSeries.moderators.includes(username) ||
                meetingSeries.moderators.includes(userIdValue);
              const isSeriesParticipant =
                meetingSeries.visibleFor?.includes(username) ||
                meetingSeries.visibleFor?.includes(userIdValue) ||
                meetingSeries.participants.includes(username) ||
                meetingSeries.participants.includes(userIdValue) ||
                meetingSeries.members?.some((m: any) => m.userId === userIdValue);
              const canModerateAll = await hasPermission(authResult.user, 'canModerateAllMeetings');
              const isAdmin = authResult.user.role === 'admin';

              if (!isAdmin && !canModerateAll && !isSeriesModerator && !isSeriesParticipant) {
                if (isExplicitTemplateSelection) {
                  return NextResponse.json({ error: 'Forbidden: no access to series template' }, { status: 403 });
                }
              } else {
                resolvedTemplate = templateFromDb;
              }
            }
          } else {
            resolvedTemplate = templateFromDb;
          }
        }
      }
    }

    // Derive visibility from meeting series members
    const visibleFor = [
      ...new Set([...meetingSeries.moderators, ...meetingSeries.participants])
    ];

    const hasManualTopics = Array.isArray(processedTopics) && processedTopics.length > 0;
    const templateContent = resolvedTemplate?.content || {};
    const finalTopicsRaw = hasManualTopics ? processedTopics : (templateContent.topics || []);
    const functionValidation = await validateFunctionResponsibles(
      extractResponsibleValuesFromTopics(finalTopicsRaw)
    );
    if (!functionValidation.valid) {
      return NextResponse.json(
        { error: functionValidation.error || 'Ungültige Vereinsfunktion in Verantwortlichen' },
        { status: 400 }
      );
    }
    const functionTokens = extractResponsibleValuesFromTopics(finalTopicsRaw).filter((value) => value.startsWith('function:'));
    const functionSlugs = functionTokens.map((value) => value.replace(/^function:/, ''));
    const assignedFunctions = await ClubFunction.find({ slug: { $in: functionSlugs } })
      .select('slug assignedUserId')
      .lean();
    const assignmentMap = buildFunctionAssignmentMap(assignedFunctions as any[]);
    const assignmentValidation = validateAssignmentsForResponsibles(
      extractResponsibleValuesFromTopics(finalTopicsRaw),
      assignmentMap
    );
    if (!assignmentValidation.valid) {
      return NextResponse.json(
        { error: assignmentValidation.error || 'Vereinsfunktion ohne Personenzuordnung' },
        { status: 400 }
      );
    }
    const assignmentUserIds = Array.from(new Set(assignedFunctions.map((fn: any) => String(fn.assignedUserId || '')).filter(Boolean)));
    const assignmentUsers = assignmentUserIds.length > 0
      ? await User.find({ _id: { $in: assignmentUserIds } })
          .select('_id firstName lastName username')
          .lean()
      : [];
    const finalTopics = await applyResponsibleSnapshotsToTopics(
      finalTopicsRaw,
      assignmentUsers as any[]
    );
    const finalGlobalNote = globalNote ?? templateContent.globalNote ?? '';
    const finalTitle = title ?? templateContent.title ?? '';
    const finalTime = time ?? templateContent.time ?? '';
    const finalEndTime = endTime ?? templateContent.endTime ?? '';
    const finalLocation = location ?? templateContent.location ?? '';

    // Create new minute
    const minute = await Minutes.create({
      meetingSeries_id,
      date: new Date(date),
      participants: participants || [],
      topics: finalTopics,
      globalNote: finalGlobalNote,
      title: finalTitle,
      time: finalTime,
      endTime: finalEndTime,
      location: finalLocation,
      isFinalized: false,
      createdBy: userId,
      visibleFor,
      templateId: resolvedTemplate?._id?.toString(),
      templateNameSnapshot: resolvedTemplate?.name || '',
    });

    // Populate meetingSeries for email
    await minute.populate('meetingSeries_id');

    // Update meeting series with last minutes info
    await MeetingSeries.findByIdAndUpdate(meetingSeries_id, {
      lastMinutesDate: minute.date,
      lastMinutesId: minute._id,
      lastMinutesFinalized: false,
    });

    // Send email notification (async, don't wait)
    const locale = request.headers.get('accept-language')?.startsWith('de') ? 'de' : 'en';
    sendNewMinutesNotification(minute, locale as 'de' | 'en').catch(err =>
      console.error('Failed to send email notification:', err)
    );

    return NextResponse.json(
      {
        success: true,
        data: minute,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating minute:', error);
    return NextResponse.json(
      { error: 'Failed to create minute' },
      { status: 500 }
    );
  }
}
