import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import Task from '@/models/Task';
import Settings from '@/models/Settings';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/dashboard
 * Get dashboard statistics and open action items
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

    // Get all meeting series where user has access (uses usernames)
    const meetingSeries = await MeetingSeries.find({
      $or: [
        { visibleFor: username },
        { moderators: username },
        { participants: username },
      ],
    }).lean();

    const seriesIds = meetingSeries.map(s => s._id);

    // Get all minutes for these series
    const allMinutes = await Minutes.find({
      meetingSeries_id: { $in: seriesIds },
    }).lean();

    // Calculate statistics
    const totalSeries = meetingSeries.length;
    const totalMinutes = allMinutes.length;
    const finalizedMinutes = allMinutes.filter(m => m.isFinalized).length;
    const draftMinutes = totalMinutes - finalizedMinutes;

    // Get open action items from Central Task Registry
    // We want all open tasks for the visible series
    const openTasks = await Task.find({
      meetingSeriesId: { $in: seriesIds.map(id => id.toString()) },
      status: { $in: ['open', 'in-progress'] }
    }).lean();

    const openActionItems = openTasks;

    const upcomingActionItems: any[] = [];
    const overdueActionItems: any[] = [];
    const today = new Date();

    // Filter for overdue/upcoming (usually only for tasks assigned to user)
    // responsibles stores user ObjectIds, not usernames
    const userOpenTasks = openTasks.filter(t => t.responsibles?.includes(userObjectId));

    userOpenTasks.forEach(task => {
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

        if (daysDiff < 0) {
          overdueActionItems.push(task);
        } else if (daysDiff <= 7) {
          upcomingActionItems.push(task);
        }
      }
    });

    // Recent minutes (last 5)
    const recentMinutes = await Minutes.find({
      meetingSeries_id: { $in: seriesIds },
    })
      .sort({ date: -1 })
      .limit(5)
      .populate('meetingSeries_id', 'project name')
      .lean();

    // Get system settings for last reminder time
    let lastRemindersSentAt = null;
    if (authResult.user.role === 'admin' || authResult.user.role === 'moderator') {
      const settings = await Settings.findOne({}).sort({ version: -1 }).lean() as any;
      if (settings && settings.systemSettings) {
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
          totalActionItems: openActionItems.length,
          overdueActionItems: overdueActionItems.length,
          upcomingActionItems: upcomingActionItems.length,
        },
        openActionItems: openActionItems.slice(0, 20), // Limit to 20
        overdueActionItems,
        upcomingActionItems,
        recentMinutes,
        lastRemindersSentAt,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
