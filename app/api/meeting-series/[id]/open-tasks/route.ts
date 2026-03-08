import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import MeetingSeries from '@/models/MeetingSeries';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meeting-series/[id]/open-tasks
 * Returns all open/in-progress tasks for a given meeting series
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: seriesId } = await context.params;
    const series = await MeetingSeries.findById(seriesId).lean();
    if (!series) {
      return NextResponse.json({ error: 'Meeting series not found' }, { status: 404 });
    }

    const username = authResult.user.username;
    const userId = authResult.user._id.toString();
    const canViewAllMeetings = await hasPermission(authResult.user, 'canViewAllMeetings');
    const isSeriesModerator = series.moderators?.includes(username) || series.moderators?.includes(userId);
    const isSeriesParticipant =
      series.visibleFor?.includes(username) ||
      series.visibleFor?.includes(userId) ||
      series.participants?.includes(username) ||
      series.participants?.includes(userId) ||
      (Array.isArray(series.members) && series.members.some((m: any) => m.userId === userId));

    if (!canViewAllMeetings && !isSeriesModerator && !isSeriesParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tasks = await Task.find({
      meetingSeriesId: seriesId,
      status: { $in: ['open', 'in-progress'] },
    })
      .sort({ priority: 1, dueDate: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
