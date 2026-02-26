import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import { verifyToken } from '@/lib/auth';

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
