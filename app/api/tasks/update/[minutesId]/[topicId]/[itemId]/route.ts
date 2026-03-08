import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';

/**
 * PATCH /api/tasks/update/[minutesId]/[topicId]/[itemId]
 * Update task status and notes
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ minutesId: string; topicId: string; itemId: string }> }
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

    // Await params (Next.js 15+)
    const { minutesId, topicId, itemId } = await params;
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = ['open', 'in-progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Find the minutes document
    const minutes = await Minutes.findById(minutesId);
    if (!minutes) {
      return NextResponse.json(
        { error: 'Minutes not found' },
        { status: 404 }
      );
    }

    // Find the topic
    const topic = minutes.topics.find(
      (t: any) => t._id.toString() === topicId
    );
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // Find the info item
    const item = topic.infoItems?.find(
      (i: any) => i._id.toString() === itemId
    );
    if (!item) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check if user is assigned to this task
    const userId = authResult.user._id.toString();
    if (!item.responsibles?.includes(userId)) {
      return NextResponse.json(
        { error: 'You are not assigned to this task' },
        { status: 403 }
      );
    }

    // Update the item
    if (status !== undefined) {
      item.status = status;
      
      // Set completion metadata
      if (status === 'completed') {
        item.completedAt = new Date();
        item.completedBy = userId;
      } else {
        // Clear completion metadata if status changed from completed
        item.completedAt = undefined;
        item.completedBy = undefined;
      }
    }

    if (notes !== undefined) {
      item.notes = notes;
    }

    // Update Central Task Registry
    if (item.externalTaskId) {
      const taskUpdate: any = {};
      if (status !== undefined) taskUpdate.status = status;
      if (notes !== undefined) taskUpdate.notes = notes;
      
      await Task.findByIdAndUpdate(item.externalTaskId, taskUpdate);
    }

    // Mark the nested array as modified so Mongoose detects the change
    minutes.markModified('topics');
    
    await minutes.save();

    return NextResponse.json({
      success: true,
      message: 'Task updated successfully',
      data: {
        status: item.status,
        notes: item.notes,
        completedAt: item.completedAt,
        completedBy: item.completedBy,
      },
    });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
