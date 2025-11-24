import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/tasks/[id]
 * Update task status
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
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

    const { id: taskId } = await context.params;
    const userId = authResult.user._id.toString();
    const body = await request.json();

    const { status, notes, actualHours } = body;

    // Find the minutes containing this task
    const minute = await Minutes.findOne({
      'topics.infoItems._id': taskId,
    });

    if (!minute) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Find and update the specific task
    let taskUpdated = false;
    for (const topic of minute.topics) {
      const task = topic.infoItems?.find(
        (item: any) => item._id?.toString() === taskId
      );

      if (task) {
        // Check if user is responsible for this task
        if (!task.responsibles.includes(userId)) {
          return NextResponse.json(
            { error: 'You are not assigned to this task' },
            { status: 403 }
          );
        }

        // Update task fields
        if (status) task.status = status;
        if (notes !== undefined) task.notes = notes;
        if (actualHours !== undefined) task.actualHours = actualHours;

        // Set completion fields if status is completed
        if (status === 'completed') {
          task.isOpen = false;
          task.completedAt = new Date();
          task.completedBy = userId;
        } else if (status === 'open' || status === 'in-progress') {
          task.isOpen = true;
          task.completedAt = undefined;
          task.completedBy = undefined;
        }

        taskUpdated = true;
        break;
      }
    }

    if (!taskUpdated) {
      return NextResponse.json(
        { error: 'Task not found in minute' },
        { status: 404 }
      );
    }

    await minute.save();

    return NextResponse.json({
      success: true,
      message: 'Task updated successfully',
    });

  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
