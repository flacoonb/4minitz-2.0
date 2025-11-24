/**
 * API Route: Single Meeting Series
 * Handles operations for a specific meeting series
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import Settings from '@/models/Settings';
import { verifyToken } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meeting-series/[id]
 * Get a specific meeting series by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await connectDB();
    const { id } = await context.params;

    // For GET, determine authenticated user (if any) using verifyToken.
    // If unauthenticated, only allow viewing public series.
    const authResult = await verifyToken(request);
    const username = authResult.success && authResult.user ? authResult.user.username : null;
    const userId = authResult.success && authResult.user ? authResult.user._id.toString() : null;

    const series = await MeetingSeries.findById(id).select('-__v').lean();

    if (!series) {
      return NextResponse.json(
        { success: false, error: 'Meeting series not found' },
        { status: 404 }
      );
    }

    // Check if user has access (either public or member/moderator)
    const visibleFor = series.visibleFor || [];
    const moderators = series.moderators || [];
    const participants = series.participants || [];

    // Check global permission
    const settings = await Settings.findOne({}).sort({ version: -1 });
    let canViewAll = false;
    if (authResult.user) {
      const userRole = authResult.user.role;
      if (settings && settings.roles && (settings.roles as any)[userRole]) {
        canViewAll = (settings.roles as any)[userRole].canViewAllMeetings;
      } else if (userRole === 'admin') {
        canViewAll = true;
      }
    }

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to view this series' },
        { status: 403 }
      );
    }

    const hasAccess =
      canViewAll ||
      visibleFor.includes(username) ||
      (userId && visibleFor.includes(userId)) ||
      moderators.includes(username) ||
      (userId && moderators.includes(userId)) ||
      participants.includes(username) ||
      (userId && participants.includes(userId));

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to view this series' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: series,
    });
  } catch (error) {
    console.error('Error fetching meeting series:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch meeting series',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/meeting-series/[id]
 * Update a specific meeting series
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await connectDB();
    const { id } = await context.params;
    const body = await request.json();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = authResult.user.username;

    console.log('========= PUT REQUEST START ========='); // Unique marker
    console.log('PUT request body:', JSON.stringify(body, null, 2)); // Debug log
    console.log('Members in body:', body.members); // Debug log

    // Check if user is moderator (moderators contains usernames)
    const series = await MeetingSeries.findById(id);

    if (!series) {
      return NextResponse.json(
        { success: false, error: 'Meeting series not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const settings = await Settings.findOne({}).sort({ version: -1 });
    let canModerateAll = false;
    if (settings && settings.roles && settings.roles[authResult.user.role]) {
      canModerateAll = settings.roles[authResult.user.role].canModerateAllMeetings;
    } else if (authResult.user.role === 'admin') {
      canModerateAll = true;
    }

    if (!series.moderators.includes(username) && !canModerateAll) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to update this series' },
        { status: 403 }
      );
    }

    console.log('Current members before update:', series.members); // Debug log

    // Update allowed fields
    const allowedUpdates = [
      'project', 'name', 'participants', 'informedUsers',
      'additionalResponsibles', 'availableLabels', 'members'
    ];

    allowedUpdates.forEach(field => {
      if (body[field] !== undefined) {
        (series as any)[field] = body[field];
        // Mark array fields as modified for Mongoose
        if (Array.isArray(body[field])) {
          series.markModified(field);
        }
      }
    });

    console.log('Members after assignment:', series.members); // Debug log

    // Detect new members
    const oldMembers = series.members || [];
    const newMembers = body.members || [];
    const addedMembers = newMembers.filter((member: any) =>
      !oldMembers.some((oldMember: any) => oldMember.userId === member.userId)
    );

    console.log('Added members:', addedMembers); // Debug log

    await series.save();

    console.log('Members after save:', series.members); // Debug log

    // If members were added, update all draft minutes
    if (addedMembers.length > 0) {
      console.log(`Adding ${addedMembers.length} new members to draft minutes...`);

      // Find all draft minutes for this series
      const draftMinutes = await Minutes.find({
        meetingSeries_id: id,
        isFinalized: false
      });

      console.log(`Found ${draftMinutes.length} draft minutes to update`);

      // Update each draft minute
      for (const minute of draftMinutes) {
        const existingParticipants = minute.participantsWithStatus || [];

        // Add new members to participantsWithStatus
        const newParticipants = addedMembers.map((member: any) => ({
          userId: member.userId,
          attendance: 'present' as const
        }));

        // Filter out duplicates
        const updatedParticipants = [
          ...existingParticipants,
          ...newParticipants.filter((newP: any) =>
            !existingParticipants.some((existingP: any) => existingP.userId === newP.userId)
          )
        ];

        minute.participantsWithStatus = updatedParticipants;
        await minute.save();

        console.log(`Updated minute ${minute._id} with new participants`);
      }

      console.log('Finished updating draft minutes');
    }

    return NextResponse.json({
      success: true,
      data: series,
      message: 'Meeting series updated successfully',
    });
  } catch (error) {
    console.error('Error updating meeting series:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update meeting series',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/meeting-series/[id]
 * Delete a meeting series
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await connectDB();
    const { id } = await context.params;

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = authResult.user.username;

    // Find the series first to check authorization
    const series = await MeetingSeries.findById(id);

    if (!series) {
      return NextResponse.json(
        { success: false, error: 'Meeting series not found' },
        { status: 404 }
      );
    }

    // Check if user is a moderator (moderators contains usernames, not IDs)
    if (!series.moderators.includes(username)) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to delete this series' },
        { status: 403 }
      );
    }

    // Delete the series
    await MeetingSeries.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Meeting series deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting meeting series:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete meeting series',
      },
      { status: 500 }
    );
  }
}
