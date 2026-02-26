import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/tasks/[id]
 * Update task status — syncs both Task collection and Minutes infoItem
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: taskId } = await context.params;
    const userId = authResult.user._id.toString();
    const body = await request.json();
    const { status, notes, actualHours } = body;

    // Validate status
    const validStatuses = ['open', 'in-progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // Try to find in Task collection first (preferred path)
    const task = await Task.findById(taskId);

    if (task) {
      // Update Task collection
      const taskUpdate: Record<string, unknown> = {};
      if (status !== undefined) taskUpdate.status = status;
      if (notes !== undefined) taskUpdate.details = notes;
      await Task.findByIdAndUpdate(taskId, taskUpdate);

      // Sync to Minutes infoItem if minutesId exists
      if (task.minutesId) {
        const minute = await Minutes.findById(task.minutesId);
        if (minute) {
          for (const topic of minute.topics) {
            const item = topic.infoItems?.find(
              (i: any) => i.externalTaskId?.toString() === taskId
            );
            if (item) {
              if (status !== undefined) {
                item.status = status;
                if (status === 'completed') {
                  item.completedAt = new Date();
                  item.completedBy = userId;
                } else {
                  item.completedAt = undefined;
                  item.completedBy = undefined;
                }
              }
              if (notes !== undefined) item.notes = notes;
              if (actualHours !== undefined) item.actualHours = actualHours;
              minute.markModified('topics');
              await minute.save();
              break;
            }
          }
        }
      }

      return NextResponse.json({ success: true, message: 'Task updated successfully' });
    }

    // Fallback: search by infoItem _id in Minutes
    const minute = await Minutes.findOne({ 'topics.infoItems._id': taskId });
    if (!minute) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    let taskUpdated = false;
    for (const topic of minute.topics) {
      const item = topic.infoItems?.find((i: any) => i._id?.toString() === taskId);
      if (item) {
        if (status !== undefined) {
          item.status = status;
          if (status === 'completed') {
            item.completedAt = new Date();
            item.completedBy = userId;
          } else {
            item.completedAt = undefined;
            item.completedBy = undefined;
          }
        }
        if (notes !== undefined) item.notes = notes;
        if (actualHours !== undefined) item.actualHours = actualHours;

        // Also sync to Task collection if linked
        if (item.externalTaskId) {
          const extUpdate: Record<string, unknown> = {};
          if (status !== undefined) extUpdate.status = status;
          if (notes !== undefined) extUpdate.details = notes;
          await Task.findByIdAndUpdate(item.externalTaskId, extUpdate);
        }

        taskUpdated = true;
        break;
      }
    }

    if (!taskUpdated) {
      return NextResponse.json({ error: 'Task not found in minute' }, { status: 404 });
    }

    minute.markModified('topics');
    await minute.save();

    return NextResponse.json({ success: true, message: 'Task updated successfully' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
