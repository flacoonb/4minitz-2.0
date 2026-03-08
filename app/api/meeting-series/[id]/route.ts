/**
 * API Route: Single Meeting Series
 * Handles operations for a specific meeting series
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import Task from '@/models/Task';
import Attachment from '@/models/Attachment';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

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
    const canViewAll = authResult.user
      ? await hasPermission(authResult.user, 'canViewAllMeetings')
      : false;

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

    // Check if user is moderator (moderators contains usernames)
    const series = await MeetingSeries.findById(id);

    if (!series) {
      return NextResponse.json(
        { success: false, error: 'Meeting series not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canModerateAll = await hasPermission(authResult.user, 'canModerateAllMeetings');

    if (!series.moderators.includes(username) && !canModerateAll) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to update this series' },
        { status: 403 }
      );
    }

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

    // Detect new members
    const oldMembers = series.members || [];
    const newMembers = body.members || [];
    const addedMembers = newMembers.filter((member: any) =>
      !oldMembers.some((oldMember: any) => oldMember.userId === member.userId)
    );

    await series.save();

    // If members were added, update all draft minutes
    if (addedMembers.length > 0) {
      const draftMinutes = await Minutes.find({
        meetingSeries_id: id,
        isFinalized: false
      });

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
      }
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

    // Check if user is a moderator of this series or has global moderator permission
    const canModerateAll = await hasPermission(authResult.user, 'canModerateAllMeetings');
    if (!series.moderators.includes(username) && !canModerateAll) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to delete this series' },
        { status: 403 }
      );
    }

    // Cascade delete: remove associated minutes, tasks, and attachments
    const minuteIds = await Minutes.find({ meetingSeries_id: id }).distinct('_id');
    if (minuteIds.length > 0) {
      await Attachment.deleteMany({ minuteId: { $in: minuteIds } });
      await Task.deleteMany({ meetingSeriesId: id });
      await Minutes.deleteMany({ meetingSeries_id: id });
    }

    // Delete the series
    await MeetingSeries.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Meeting series deleted successfully',
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete meeting series',
      },
      { status: 500 }
    );
  }
}
