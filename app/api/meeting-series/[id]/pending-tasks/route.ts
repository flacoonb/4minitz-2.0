import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
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

    if (!lastMinutes) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No previous minutes found',
      });
    }

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
          });
        });
      }
    }

    // Extract all open action items (only tasks that are not completed)
    const pendingTasks: any[] = [];
    
    lastMinutes.topics?.forEach((topic: any) => {
      topic.infoItems?.forEach((item: any) => {
        // Only include action items that are open (not completed)
        if (item.itemType === 'actionItem' && item.status !== 'completed') {
          const taskId = item._id.toString();
          
          // Skip if this task is already imported in the current minute
          if (alreadyImportedTaskIds.has(taskId)) {
            return;
          }
          
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
            externalTaskId: item.externalTaskId, // IMPORTANT: Pass reference to central task
            isImported: true,
            originalTaskId: taskId,
          });
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: pendingTasks,
      count: pendingTasks.length,
      lastMinutesDate: lastMinutes.date
    });

  } catch (error: any) {
    console.error('Error fetching pending tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
