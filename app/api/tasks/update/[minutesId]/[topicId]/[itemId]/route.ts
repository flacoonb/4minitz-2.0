import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { updateTaskSchema, validateBody } from '@/lib/validations';

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
    if (
      !mongoose.isValidObjectId(minutesId) ||
      !mongoose.isValidObjectId(topicId) ||
      !mongoose.isValidObjectId(itemId)
    ) {
      return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
    }

    const rawBody = await request.json();
    const validation = validateBody(updateTaskSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { status, notes } = validation.data;

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

    const userId = authResult.user._id.toString();
    const username = String(authResult.user.username || '').trim();
    const rawEmail = String((authResult.user as any).email || '').trim();
    const userEmail = rawEmail.toLowerCase();
    const responsibleCandidates = Array.from(
      new Set([userId, username, rawEmail, userEmail].filter(Boolean))
    );
    const normalizedCandidateSet = new Set(responsibleCandidates.map((value) => value.toLowerCase()));
    const isResponsible = Array.isArray(item.responsibles)
      ? item.responsibles.some((responsible: unknown) => {
          const value = String(responsible || '').trim();
          if (!value) return false;
          return (
            responsibleCandidates.includes(value) ||
            normalizedCandidateSet.has(value.toLowerCase())
          );
        })
      : false;
    const isAdmin = authResult.user.role === 'admin';
    const canModerateAllMeetings = await hasPermission(authResult.user, 'canModerateAllMeetings');
    let isSeriesModerator = false;
    if ((minutes as any).meetingSeries_id) {
      const series = await MeetingSeries.findById((minutes as any).meetingSeries_id)
        .select('moderators')
        .lean();
      isSeriesModerator = Boolean(
        series &&
          Array.isArray((series as any).moderators) &&
          ((series as any).moderators.includes(userId) || (series as any).moderators.includes(username))
      );
    }

    if (!isAdmin && !canModerateAllMeetings && !isSeriesModerator && !isResponsible) {
      return NextResponse.json(
        { error: 'Forbidden' },
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
      if (notes !== undefined) taskUpdate.details = notes;
      
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
