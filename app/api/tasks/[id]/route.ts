import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { updateTaskSchema, validateBody } from '@/lib/validations';

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
    if (!mongoose.isValidObjectId(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const userId = authResult.user._id.toString();
    const username = String(authResult.user.username || '').trim();
    const rawEmail = String((authResult.user as any).email || '').trim();
    const userEmail = rawEmail.toLowerCase();
    const responsibleCandidates = Array.from(
      new Set([userId, username, rawEmail, userEmail].filter(Boolean))
    );
    const normalizedCandidateSet = new Set(responsibleCandidates.map((value) => value.toLowerCase()));
    const matchesResponsible = (responsibles: unknown[] | undefined): boolean => {
      if (!Array.isArray(responsibles)) return false;
      return responsibles.some((responsible) => {
        const value = String(responsible || '').trim();
        if (!value) return false;
        return (
          responsibleCandidates.includes(value) ||
          normalizedCandidateSet.has(value.toLowerCase())
        );
      });
    };

    const isAdmin = authResult.user.role === 'admin';
    const canModerateAllMeetings = await hasPermission(authResult.user, 'canModerateAllMeetings');
    const body = await request.json();
    const validation = validateBody(updateTaskSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { status, notes } = validation.data;
    const actualHours = body.actualHours;

    // Try to find in Task collection first (preferred path)
    const task = await Task.findById(taskId);

    if (task) {
      const isResponsible = matchesResponsible(task.responsibles as unknown[] | undefined);

      let isSeriesModerator = false;
      if (task.meetingSeriesId) {
        const series = await MeetingSeries.findById(task.meetingSeriesId).select('moderators').lean();
        isSeriesModerator = Boolean(
          series &&
            Array.isArray((series as any).moderators) &&
            ((series as any).moderators.includes(userId) || (series as any).moderators.includes(username))
        );
      }

      if (!isAdmin && !canModerateAllMeetings && !isSeriesModerator && !isResponsible) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

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

    let isSeriesModerator = false;
    if (minute.meetingSeries_id) {
      const series = await MeetingSeries.findById(minute.meetingSeries_id).select('moderators').lean();
      isSeriesModerator = Boolean(
        series &&
          Array.isArray((series as any).moderators) &&
          ((series as any).moderators.includes(userId) || (series as any).moderators.includes(username))
      );
    }

    let taskUpdated = false;
    for (const topic of minute.topics) {
      const item = topic.infoItems?.find((i: any) => i._id?.toString() === taskId);
      if (item) {
        const isResponsible = matchesResponsible(item.responsibles as unknown[] | undefined);

        if (!isAdmin && !canModerateAllMeetings && !isSeriesModerator && !isResponsible) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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
