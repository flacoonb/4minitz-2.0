import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import Task from '@/models/Task';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/meeting-series/[id]/pending-tasks?minuteId=xxx
 * Get open tasks from the last finalized minutes of a meeting series
 * Excludes tasks that are already imported in the specified minute
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: seriesId } = await params;

    // Verify user has access to this series
    const username = authResult.user.username;
    const series = await MeetingSeries.findById(seriesId);
    if (!series) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const hasAccess = series.visibleFor?.includes(username) ||
                      series.moderators?.includes(username) ||
                      series.participants?.includes(username) ||
                      authResult.user.role === 'admin';
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the current minute ID from query params (to exclude already imported tasks)
    const { searchParams } = new URL(request.url);
    const currentMinuteId = searchParams.get('minuteId');
    
    // Find the last finalized minutes for this series
    const lastMinutes = await Minutes.findOne({
      meetingSeries_id: seriesId,
      isFinalized: true,
    })
      .sort({ date: -1 })
      .lean();

    // If currentMinuteId is provided, get already imported task IDs
    const alreadyImportedTaskIds = new Set<string>();
    if (currentMinuteId) {
      const currentMinute = await Minutes.findById(currentMinuteId).lean();
      if (currentMinute) {
        currentMinute.topics?.forEach((topic: any) => {
          topic.infoItems?.forEach((item: any) => {
            if (item.originalTaskId) {
              alreadyImportedTaskIds.add(item.originalTaskId.toString());
            }
            // Also track externalTaskIds to prevent duplicate import of Task-collection tasks
            if (item.externalTaskId) {
              alreadyImportedTaskIds.add(item.externalTaskId.toString());
            }
          });
        });
      }
    }

    const pendingTasks: any[] = [];

    // 1) Tasks from last finalized minutes (existing carry-over logic)
    if (lastMinutes) {
      lastMinutes.topics?.forEach((topic: any) => {
        topic.infoItems?.forEach((item: any) => {
          if (item.itemType === 'actionItem' && item.status !== 'completed') {
            const taskId = item._id.toString();
            if (alreadyImportedTaskIds.has(taskId)) return;

            pendingTasks.push({
              _id: item._id,
              subject: item.subject,
              details: item.details,
              priority: item.priority,
              dueDate: item.dueDate,
              responsibles: item.responsibles,
              status: item.status,
              notes: item.notes,
              completedAt: item.completedAt,
              completedBy: item.completedBy,
              externalTaskId: item.externalTaskId,
              isImported: true,
              originalTaskId: taskId,
            });
          }
        });
      });
    }

    // 2) Unbound tasks from Task collection (imported from another series, not yet in any minutes)
    const unboundTasks = await Task.find({
      meetingSeriesId: seriesId,
      status: { $in: ['open', 'in-progress'] },
      $or: [{ minutesId: null }, { minutesId: { $exists: false } }, { minutesId: '' }],
    }).lean();

    for (const task of unboundTasks) {
      const taskId = task._id.toString();
      if (alreadyImportedTaskIds.has(taskId)) continue;

      pendingTasks.push({
        _id: task._id,
        subject: task.subject,
        details: task.details,
        priority: task.priority,
        dueDate: task.dueDate,
        responsibles: task.responsibles,
        status: task.status,
        externalTaskId: taskId,
        isImported: true,
        originalTaskId: taskId,
        isFromTaskRegistry: true, // Flag to distinguish from minutes-based tasks
      });
    }

    return NextResponse.json({
      success: true,
      data: pendingTasks,
      count: pendingTasks.length,
      lastMinutesDate: lastMinutes?.date || null,
    });

  } catch (error) {
    console.error('Error fetching pending tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
