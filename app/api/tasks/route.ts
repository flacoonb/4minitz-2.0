import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/tasks
 * Get tasks assigned to current user from Central Task Registry
 */
export async function GET(request: NextRequest) {
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

    const userId = authResult.user._id.toString();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // open, in-progress, completed, cancelled
    const priority = searchParams.get('priority'); // high, medium, low
    const overdue = searchParams.get('overdue'); // true/false

    // Build query
    const query: any = {
      responsibles: userId
    };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      // Only consider open tasks as overdue
      if (!status) {
        query.status = { $in: ['open', 'in-progress'] };
      }
    }

    // Fetch tasks from Central Registry
    const tasks = await Task.find(query).sort({ dueDate: 1, priority: -1 }).lean();

    // Enrich tasks with Meeting Series info
    const seriesIds = [...new Set(tasks.map(t => t.meetingSeriesId))];
    const seriesList = await MeetingSeries.find({ _id: { $in: seriesIds } }).select('project name').lean();
    const seriesMap = new Map(seriesList.map(s => [s._id.toString(), s]));

    // Enrich with Topic Subject (fetch minutes)
    const minutesIds = [...new Set(tasks.map(t => t.minutesId).filter(id => id))];
    const minutesList = await Minutes.find({ _id: { $in: minutesIds } }).select('topics._id topics.subject').lean();
    
    // Create a map of topicId -> subject
    const topicMap = new Map<string, string>();
    minutesList.forEach((minute: any) => {
      if (minute.topics) {
        minute.topics.forEach((topic: any) => {
          if (topic._id) {
            topicMap.set(topic._id.toString(), topic.subject);
          }
        });
      }
    });

    const enrichedTasks = tasks.map(task => ({
      ...task,
      meetingSeries: seriesMap.get(task.meetingSeriesId) || null,
      // Map fields to match frontend expectations
      duedate: task.dueDate, 
      minutesId: task.minutesId || 'central', 
      topicSubject: (task.topicId && topicMap.get(task.topicId)) || 'Task', 
    }));

    return NextResponse.json({
      success: true,
      count: enrichedTasks.length,
      data: enrichedTasks,
    });

  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
