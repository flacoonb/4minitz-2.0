import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import MeetingSeries from '@/models/MeetingSeries';
import { verifyToken } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/meeting-series/[id]/import-tasks
 * Import open/in-progress tasks from another series into this one
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: targetSeriesId } = await context.params;
    const body = await request.json();
    const { sourceSeriesId, taskIds } = body;

    if (!sourceSeriesId) {
      return NextResponse.json({ error: 'sourceSeriesId is required' }, { status: 400 });
    }

    if (sourceSeriesId === targetSeriesId) {
      return NextResponse.json({ error: 'Source and target series must differ' }, { status: 400 });
    }

    // Verify target series exists and user has access
    const targetSeries = await MeetingSeries.findById(targetSeriesId);
    if (!targetSeries) {
      return NextResponse.json({ error: 'Target series not found' }, { status: 404 });
    }

    const username = authResult.user.username;
    const hasTargetAccess = targetSeries.visibleFor?.includes(username) ||
      targetSeries.moderators?.includes(username) ||
      authResult.user.role === 'admin';
    if (!hasTargetAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify source series exists and user has access
    const sourceSeries = await MeetingSeries.findById(sourceSeriesId);
    if (!sourceSeries) {
      return NextResponse.json({ error: 'Source series not found' }, { status: 404 });
    }

    const hasSourceAccess = sourceSeries.visibleFor?.includes(username) ||
      sourceSeries.moderators?.includes(username) ||
      authResult.user.role === 'admin';
    if (!hasSourceAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get open/in-progress tasks from source series
    const query: Record<string, unknown> = {
      meetingSeriesId: sourceSeriesId,
      status: { $in: ['open', 'in-progress'] },
    };
    if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
      query._id = { $in: taskIds };
    }

    const sourceTasks = await Task.find(query).lean();

    if (sourceTasks.length === 0) {
      return NextResponse.json({ success: true, imported: 0, message: 'No tasks to import' });
    }

    // Check for already-imported tasks (prevent duplicates)
    const sourceTaskIds = sourceTasks.map((t) => t._id.toString());
    const alreadyImported = await Task.find({
      meetingSeriesId: targetSeriesId,
      sourceTaskId: { $in: sourceTaskIds },
    }).lean();
    const alreadyImportedSourceIds = new Set(alreadyImported.map((t) => (t as any).sourceTaskId));

    // Create new tasks for the target series
    const userId = authResult.user._id.toString();
    const newTasks = [];

    for (const task of sourceTasks) {
      const taskId = task._id.toString();
      if (alreadyImportedSourceIds.has(taskId)) {
        continue; // Skip already imported
      }

      newTasks.push({
        subject: task.subject,
        details: task.details,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        responsibles: task.responsibles,
        meetingSeriesId: targetSeriesId,
        sourceTaskId: taskId,
        createdBy: userId,
      });
    }

    if (newTasks.length === 0) {
      return NextResponse.json({ success: true, imported: 0, message: 'All tasks already imported' });
    }

    const created = await Task.insertMany(newTasks);

    return NextResponse.json({
      success: true,
      imported: created.length,
      tasks: created,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
