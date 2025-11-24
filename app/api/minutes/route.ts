import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import Settings from '@/models/Settings';
import { sendNewMinutesNotification } from '@/lib/email-service';
import mongoose from 'mongoose';
import { verifyToken } from '@/lib/auth';

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
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    // Determine requesting user (if any) using verifyToken. If unauthenticated
    // allow only public minutes (visibleFor empty). If authenticated, use
    // their username to filter visible minutes.
    const authResult = await verifyToken(request);
    let username: string | null = null;
    let userId: string | null = null;
    let userRole: string | null = null;

    if (authResult.success && authResult.user) {
      username = authResult.user.username;
      userId = authResult.user._id.toString();
      userRole = authResult.user.role;
    }

    // Check permissions via Settings
    const settings = await Settings.findOne({}).sort({ version: -1 });
    let canViewAll = false;

    if (settings && settings.roles && userRole && (settings.roles as any)[userRole]) {
      const rolePermissions = (settings.roles as any)[userRole];
      // Use specific permission if available, otherwise fallback to admin check
      if (rolePermissions.canViewAllMinutes !== undefined) {
        canViewAll = rolePermissions.canViewAllMinutes;
      } else {
        // Default: Admin gets access, others don't (strict separation from canViewAllMeetings)
        canViewAll = (userRole === 'admin');
      }
    }

    // Build the query with proper filters
    const query: any = {};

    if (meetingSeriesId) {
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

    // Check role - only admin and moderator can create minutes
    if (authResult.user.role === 'user') {
      return NextResponse.json(
        { error: 'Forbidden: Nur Administratoren und Moderatoren dürfen Protokolle erstellen' },
        { status: 403 }
      );
    }

    const userId = authResult.user._id.toString();
    const body = await request.json();
    const { meetingSeries_id, date, participants, topics, agendaItems, globalNote } = body;

    // Validate required fields
    if (!meetingSeries_id || !date) {
      return NextResponse.json(
        { error: 'meetingSeries_id and date are required' },
        { status: 400 }
      );
    }

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
          isComplete: entry.isCompleted || false
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
      const isModerator = meetingSeries.moderators.includes(username);
      const isParticipant = meetingSeries.participants.includes(username);

      if (!isModerator && !isParticipant) {
        console.log('Auth failed:', { username, role: userRole, moderators: meetingSeries.moderators, participants: meetingSeries.participants });
        return NextResponse.json(
          { error: 'Forbidden: You must be a moderator or participant of this meeting series' },
          { status: 403 }
        );
      }
    }

    // Create new minute
    const minute = await Minutes.create({
      meetingSeries_id,
      date: new Date(date),
      participants: participants || [],
      topics: processedTopics,
      globalNote: globalNote || '',
      isFinalized: false,
      createdBy: userId,
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
