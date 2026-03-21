import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import Task from '@/models/Task';
import Settings from '@/models/Settings';
import { verifyToken } from '@/lib/auth';
import { serializeDashboardMinute } from '@/lib/dashboard-response';

/**
 * GET /api/dashboard
 * Statistics + recent minutes preview only (task lists come from GET /api/tasks).
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const username = authResult.user.username;
    const userObjectId = authResult.user._id.toString();

    const meetingSeriesQuery =
      authResult.user.role === 'admin'
        ? {}
        : {
            $or: [
              { visibleFor: { $in: [username, userObjectId] } },
              { moderators: { $in: [username, userObjectId] } },
              { participants: { $in: [username, userObjectId] } },
              { 'members.userId': userObjectId },
            ],
          };

    const meetingSeries = await MeetingSeries.find(meetingSeriesQuery).lean();

    const seriesIds = meetingSeries.map((s) => s._id);

    const totalSeries = meetingSeries.length;
    const seriesFilter = { meetingSeries_id: { $in: seriesIds } };
    const [totalMinutes, finalizedMinutes] = await Promise.all([
      Minutes.countDocuments(seriesFilter),
      Minutes.countDocuments({ ...seriesFilter, isFinalized: true }),
    ]);
    const draftMinutes = totalMinutes - finalizedMinutes;

    const openTasks = await Task.find({
      meetingSeriesId: { $in: seriesIds.map((id) => id.toString()) },
      status: { $in: ['open', 'in-progress'] },
    })
      .select('dueDate responsibles')
      .lean();

    const userOpenTasks = openTasks.filter(
      (t) =>
        Array.isArray(t.responsibles) &&
        t.responsibles.some((responsible: unknown) => {
          const value = String(responsible);
          return value === userObjectId || value === username;
        })
    );

    const today = new Date();
    let overdueCount = 0;
    let upcomingCount = 0;

    for (const task of userOpenTasks) {
      if (!task.dueDate) continue;
      const dueDate = new Date(task.dueDate as Date);
      const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      if (daysDiff < 0) overdueCount += 1;
      else if (daysDiff <= 7) upcomingCount += 1;
    }

    const recentMinutesRaw = await Minutes.find({
      meetingSeries_id: { $in: seriesIds },
    })
      .sort({ date: -1 })
      .limit(5)
      .populate('meetingSeries_id', 'project name')
      .select('date isFinalized meetingSeries_id')
      .lean();

    const recentMinutes = recentMinutesRaw
      .map((m) => serializeDashboardMinute(m as Record<string, unknown>))
      .filter((m): m is Record<string, unknown> => m != null);

    let lastRemindersSentAt = null;
    if (authResult.user.role === 'admin' || authResult.user.role === 'moderator') {
      const settings = (await Settings.findOne({}).sort({ updatedAt: -1 }).lean()) as {
        systemSettings?: { lastRemindersSentAt?: unknown };
      } | null;
      if (settings?.systemSettings) {
        lastRemindersSentAt = settings.systemSettings.lastRemindersSentAt;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        statistics: {
          totalSeries,
          totalMinutes,
          finalizedMinutes,
          draftMinutes,
          totalActionItems: userOpenTasks.length,
          overdueActionItems: overdueCount,
          upcomingActionItems: upcomingCount,
        },
        recentMinutes,
        lastRemindersSentAt,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
