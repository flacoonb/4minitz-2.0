import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import Task from '@/models/Task';
import MeetingEvent from '@/models/MeetingEvent';
import User from '@/models/User';
import ClubFunction from '@/models/ClubFunction';
import { verifyToken } from '@/lib/auth';
import { requirePermission, hasPermission } from '@/lib/permissions';
import { logAction } from '@/lib/audit';
import {
  applyResponsibleSnapshotsToTopics,
  buildFunctionAssignmentMap,
  extractResponsibleValuesFromTopics,
  resolveResponsiblesForTasks,
  validateAssignmentsForResponsibles,
  validateFunctionResponsibles,
} from '@/lib/club-functions';

type AttendanceStatus = 'present' | 'excused' | 'absent';

function mapResponseToAttendance(responseStatus: string): AttendanceStatus {
  if (responseStatus === 'accepted') return 'present';
  if (responseStatus === 'declined') return 'absent';
  if (responseStatus === 'tentative') return 'excused';
  return 'excused';
}

function computeEventDeadline(event: any): Date | null {
  if (!event?.scheduledDate || !event?.startTime) return null;
  const date = new Date(event.scheduledDate);
  if (Number.isNaN(date.getTime())) return null;
  const [hoursRaw, minutesRaw] = String(event.startTime).split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw || '0');
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const deadline = new Date(date);
  deadline.setHours(hours, minutes, 0, 0);
  return deadline;
}

function collectInactiveFunctionIdsFromMinute(minute: any): string[] {
  const ids = new Set<string>();
  const topics = Array.isArray(minute?.topics) ? minute.topics : [];
  for (const topic of topics) {
    const topicSnapshots = Array.isArray(topic?.responsibleSnapshots) ? topic.responsibleSnapshots : [];
    for (const snapshot of topicSnapshots) {
      if (snapshot?.functionId && snapshot?.isActive === false) {
        ids.add(String(snapshot.functionId));
      }
    }
    const items = Array.isArray(topic?.infoItems) ? topic.infoItems : [];
    for (const item of items) {
      const itemSnapshots = Array.isArray(item?.responsibleSnapshots) ? item.responsibleSnapshots : [];
      for (const snapshot of itemSnapshots) {
        if (snapshot?.functionId && snapshot?.isActive === false) {
          ids.add(String(snapshot.functionId));
        }
      }
    }
  }
  return Array.from(ids);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id } = await params;

    // Determine authenticated user (if any)
    const authResult = await verifyToken(request);
    const username = authResult.success && authResult.user ? authResult.user.username : null;
    const userId = authResult.success && authResult.user ? authResult.user._id.toString() : null;

    const minute = await Minutes.findOne({ _id: id })
      .populate({ path: 'meetingSeries_id', model: MeetingSeries })
      .lean();

    if (!minute) {
      return NextResponse.json(
        { error: 'Minute not found' },
        { status: 404 }
      );
    }

    // Check permissions via centralized permission system
    const canViewAll = authResult.user
      ? await hasPermission(authResult.user, 'canViewAllMinutes')
      : false;

    // Check visibility: public minutes are allowed for unauthenticated users.
    const series = minute.meetingSeries_id as any;
    
    // Series-level permissions
    const seriesVisibleFor = series?.visibleFor || [];
    const seriesModerators = series?.moderators || [];
    const seriesParticipants = series?.participants || [];
    const seriesMembers = series?.members || [];
    
    // Minute-level permissions
    const minuteVisibleFor = minute.visibleFor || [];
    const minuteParticipants = minute.participants || [];

    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSeriesModerator = seriesModerators.includes(username) || (userId && seriesModerators.includes(userId));
    const isSeriesMember = userId && seriesMembers.some((m: any) => m.userId === userId);
    const isSeriesParticipant = 
        seriesVisibleFor.includes(username) || (userId && seriesVisibleFor.includes(userId)) ||
        seriesParticipants.includes(username) || (userId && seriesParticipants.includes(userId)) ||
        isSeriesMember;
        
    const isMinuteDirectlyVisible = 
        minuteVisibleFor.includes(username) || (userId && minuteVisibleFor.includes(userId)) ||
        minuteParticipants.includes(username) || (userId && minuteParticipants.includes(userId));

    // Authenticated: allow if...
    if (
      canViewAll ||
      isSeriesModerator ||
      isSeriesParticipant ||
      isMinuteDirectlyVisible
    ) {
      // Keep protocol attendance synchronized with RSVP until meeting start time.
      const linkedEvent = await MeetingEvent.findOne({ linkedMinutesId: id }).lean();
      const deadline = computeEventDeadline(linkedEvent);
      if (linkedEvent && deadline && new Date() < deadline) {
        const existingStatus = new Map<string, AttendanceStatus>();
        const existingParticipantsWithStatus = Array.isArray((minute as any).participantsWithStatus)
          ? (minute as any).participantsWithStatus
          : [];

        for (const participant of existingParticipantsWithStatus) {
          const participantId = String(participant?.userId || '').trim();
          if (!participantId) continue;
          const status = String(participant?.attendance || 'excused') as AttendanceStatus;
          existingStatus.set(participantId, status);
        }

        const syncedByUserId = new Map<string, AttendanceStatus>();
        for (const invitee of linkedEvent.invitees || []) {
          const inviteeId = String((invitee as any)?.userId || '').trim();
          if (!inviteeId) continue;
          syncedByUserId.set(inviteeId, mapResponseToAttendance(String((invitee as any)?.responseStatus || 'pending')));
        }

        for (const member of seriesMembers) {
          const memberId = String((member as any)?.userId || '').trim();
          if (!memberId || syncedByUserId.has(memberId)) continue;
          syncedByUserId.set(memberId, existingStatus.get(memberId) || 'excused');
        }

        // Keep guests or manually added non-series users untouched.
        for (const [participantId, attendance] of existingStatus.entries()) {
          if (syncedByUserId.has(participantId)) continue;
          if (participantId.startsWith('guest:')) {
            syncedByUserId.set(participantId, attendance);
          }
        }

        const participantsWithStatus = Array.from(syncedByUserId.entries()).map(([entryUserId, attendance]) => ({
          userId: entryUserId,
          attendance,
        }));
        const participants = participantsWithStatus
          .map((entry) => entry.userId)
          .filter((entryUserId) => !entryUserId.startsWith('guest:'));

        await Minutes.findByIdAndUpdate(id, {
          $set: { participantsWithStatus, participants, updatedAt: new Date() },
        });
        (minute as any).participantsWithStatus = participantsWithStatus;
        (minute as any).participants = participants;
      }

      return NextResponse.json({ success: true, data: minute });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('Error fetching minute:', error);
    return NextResponse.json(
      { error: 'Failed to fetch minute' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.user._id.toString();
    const username = authResult.user.username;

    const minute = await Minutes.findById(id);

    if (!minute) {
      return NextResponse.json(
        { error: 'Minute not found' },
        { status: 404 }
      );
    }

    const series = await MeetingSeries.findById(minute.meetingSeries_id).lean();
    if (!series) {
      return NextResponse.json(
        { error: 'Meeting series not found' },
        { status: 404 }
      );
    }

    // Check permissions for finalized minutes — requires canEditAllMinutes
    const canEditAll = await hasPermission(authResult.user, 'canEditAllMinutes');

    const isSeriesModerator = series.moderators?.includes(username) || series.moderators?.includes(userId);
    const isSeriesMember = Array.isArray(series.members) && series.members.some((member: any) => member.userId === userId);
    const isSeriesParticipant =
      series.visibleFor?.includes(username) ||
      series.visibleFor?.includes(userId) ||
      series.participants?.includes(username) ||
      series.participants?.includes(userId) ||
      isSeriesMember;
    const isMinuteDirectlyVisible =
      minute.visibleFor?.includes(username) ||
      minute.visibleFor?.includes(userId) ||
      minute.participants?.includes(username) ||
      minute.participants?.includes(userId);

    if (!canEditAll && !isSeriesModerator && !isSeriesParticipant && !isMinuteDirectlyVisible) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (minute.isFinalized && !canEditAll) {
      return NextResponse.json(
        { error: 'Fehlende Berechtigung zum Bearbeiten finalisierter Protokolle' },
        { status: 403 }
      );
    }

    // Check permissions for finalization/reopening
    if (body.isFinalized !== undefined && body.isFinalized !== minute.isFinalized) {
      if (!canEditAll) {
        return NextResponse.json(
          { error: 'Fehlende Berechtigung zum Finalisieren oder Wiedereröffnen von Protokollen' },
          { status: 403 }
        );
      }
    }

    const toAlphabetSuffix = (index: number): string => {
      let n = index + 1;
      let result = '';
      while (n > 0) {
        const remainder = (n - 1) % 26;
        result = String.fromCharCode(97 + remainder) + result;
        n = Math.floor((n - 1) / 26);
      }
      return result;
    };

    const topicsToPersistRaw = Array.isArray(body.topics)
      ? body.topics.map((topic: any, topicIndex: number) => ({
          ...topic,
          infoItems: Array.isArray(topic.infoItems)
            ? topic.infoItems.map((item: any, itemIndex: number) => {
                const autoLabel = `${topicIndex + 1}${toAlphabetSuffix(itemIndex)}`;
                return {
                  ...item,
                  subject: (item.subject || '').trim() || autoLabel,
                };
              })
            : topic.infoItems,
        }))
      : body.topics;

    let topicsToPersist = topicsToPersistRaw;
    const topicResponsibles = Array.isArray(topicsToPersistRaw)
      ? extractResponsibleValuesFromTopics(topicsToPersistRaw)
      : [];
    const functionSlugs = topicResponsibles
      .filter((value) => value.startsWith('function:'))
      .map((value) => value.replace(/^function:/, ''));
    const assignedFunctions = await ClubFunction.find({ slug: { $in: functionSlugs } })
      .select('slug assignedUserId')
      .lean();
    const assignmentMap = buildFunctionAssignmentMap(assignedFunctions as any[]);
    if (Array.isArray(topicsToPersistRaw)) {
      const validation = await validateFunctionResponsibles(
        extractResponsibleValuesFromTopics(topicsToPersistRaw),
        { allowInactiveIds: collectInactiveFunctionIdsFromMinute(minute) }
      );
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || 'Ungültige Vereinsfunktion in Verantwortlichen' },
          { status: 400 }
        );
      }
      const assignmentValidation = validateAssignmentsForResponsibles(
        extractResponsibleValuesFromTopics(topicsToPersistRaw),
        assignmentMap
      );
      if (!assignmentValidation.valid) {
        return NextResponse.json(
          { error: assignmentValidation.error || 'Vereinsfunktion ohne Personenzuordnung' },
          { status: 400 }
        );
      }
      const assignmentUserIds = Array.from(
        new Set(assignedFunctions.map((fn: any) => String(fn.assignedUserId || '')).filter(Boolean))
      );
      const assignmentUsers = assignmentUserIds.length > 0
        ? await User.find({ _id: { $in: assignmentUserIds } })
            .select('_id firstName lastName username')
            .lean()
        : [];
      topicsToPersist = await applyResponsibleSnapshotsToTopics(
        topicsToPersistRaw,
        assignmentUsers as any[]
      );
    }

    // Sync infoItems with Central Task Registry
    if (topicsToPersist) {
      for (const topic of topicsToPersist) {
        // Ensure topic has an ID for linking tasks
        if (!topic._id) {
          topic._id = new mongoose.Types.ObjectId().toString();
        }

        if (topic.infoItems) {
          for (let i = 0; i < topic.infoItems.length; i++) {
            const item = topic.infoItems[i];

            if (item.itemType === 'actionItem') {
              try {
                const taskData = {
                  subject: item.subject,
                  details: item.details,
                  status: item.status || 'open',
                  priority: item.priority || 'medium',
                  dueDate: item.dueDate,
                  responsibles: resolveResponsiblesForTasks(item.responsibles || [], assignmentMap),
                  meetingSeriesId: minute.meetingSeries_id.toString(),
                  minutesId: id,
                  topicId: topic._id,
                  updatedAt: new Date()
                };

                let taskId = item.externalTaskId;

                if (taskId) {
                  await Task.findByIdAndUpdate(taskId, taskData);
                } else {
                  const newTask = await Task.create({
                    ...taskData,
                    createdBy: userId,
                    createdAt: new Date()
                  });
                  taskId = newTask._id;
                  item.externalTaskId = taskId;
                }
              } catch (taskErr) {
                // Task sync failure is non-fatal — minute save continues
                console.error('Task sync failed (non-fatal):', taskErr);
              }
            } else if (item.itemType === 'infoItem' && item.externalTaskId) {
              // Item was changed from actionItem to infoItem — clean up orphaned task
              try {
                await Task.findByIdAndDelete(item.externalTaskId);
                item.externalTaskId = undefined;
              } catch (cleanupErr) {
                // Cleanup failure is non-fatal
                console.error('Task cleanup failed (non-fatal):', cleanupErr);
              }
            }
          }
        }
      }
    }

    const hasField = (field: string) => Object.prototype.hasOwnProperty.call(body, field);

    // Build update object for partial updates only.
    // Important for finalize/reopen calls that intentionally send only status fields.
    const updateData: any = {
      updatedAt: new Date()
    };

    if (hasField('date') && body.date) {
      updateData.date = new Date(body.date);
    }
    if (hasField('participants')) {
      updateData.participants = body.participants;
    }
    if (hasField('participantsWithStatus')) {
      updateData.participantsWithStatus = body.participantsWithStatus;
    }
    if (hasField('topics')) {
      updateData.topics = topicsToPersist;
    }
    if (hasField('globalNote')) {
      updateData.globalNote = body.globalNote;
    }
    if (hasField('time')) {
      updateData.time = body.time || '';
    }
    if (hasField('endTime')) {
      updateData.endTime = body.endTime || '';
    }
    if (hasField('location')) {
      updateData.location = body.location || '';
    }
    if (hasField('title')) {
      updateData.title = body.title || '';
    }

    // Handle finalization status
    if (body.isFinalized !== undefined) {
      updateData.isFinalized = body.isFinalized;
      
      // Check if reopening and add to history
      if (minute.isFinalized && !body.isFinalized && body.reopenReason) {
        const now = new Date();
        const reopeningEntry = {
          reopenedAt: now,
          reopenedBy: userId,
          reason: body.reopenReason
        };
        
        // Initialize array if it doesn't exist, then add entry
        if (!minute.reopeningHistory) {
          updateData.reopeningHistory = [reopeningEntry];
        } else {
          updateData.reopeningHistory = [...minute.reopeningHistory, reopeningEntry];
        }
        
        // Reopening note is now stored in reopeningHistory and not appended to globalNote
      }
      
      // If finalizing, set finalizedAt and finalizedBy
      if (!minute.isFinalized && body.isFinalized) {
        updateData.finalizedAt = new Date();
        updateData.finalizedBy = userId;

        // Close imported tasks in their original minutes to prevent duplicates in dashboard
        if (body.topics) {
          const importedTaskIds: string[] = [];
          body.topics.forEach((topic: any) => {
            topic.infoItems?.forEach((item: any) => {
              if (item.isImported && item.originalTaskId) {
                importedTaskIds.push(item.originalTaskId);
              }
            });
          });

          if (importedTaskIds.length > 0) {
            // Close original tasks by finding and updating them directly
            for (const originalId of importedTaskIds) {
              const sourceMinute = await Minutes.findOne({ "topics.infoItems._id": originalId });
              if (sourceMinute) {
                let modified = false;
                for (const topic of sourceMinute.topics) {
                  if (!topic.infoItems) continue;
                  for (const item of topic.infoItems) {
                    if (item._id?.toString() === originalId) {
                      item.status = 'completed';
                      modified = true;
                    }
                  }
                }
                if (modified) {
                  await sourceMinute.save();
                }
              }
            }
          }
        }
      }
    }

    const updatedMinute = await Minutes.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('meetingSeries_id');

    if (updatedMinute) {
      // Audit Log
      let action = 'UPDATE_MINUTE';
      let details = `Minute ${updatedMinute.date} updated`;
      
      if (body.isFinalized === true) {
        action = 'FINALIZE_MINUTE';
        details = `Minute ${updatedMinute.date} finalized`;
      } else if (body.isFinalized === false && minute.isFinalized) {
        action = 'REOPEN_MINUTE';
        details = `Minute ${updatedMinute.date} reopened`;
      }

      await logAction({
        action,
        details,
        userId,
        username: authResult.user.username,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        resourceType: 'Minute',
        resourceId: id
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedMinute,
    });
  } catch (error) {
    console.error('Error updating minute:', error);
    return NextResponse.json(
      { error: 'Failed to update minute' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id } = await params;

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission - only users with canDeleteMinutes can delete
    const permResult = await requirePermission(authResult.user, 'canDeleteMinutes');
    if (!permResult.success) {
      return NextResponse.json(
        { error: 'Fehlende Berechtigung zum Löschen von Protokollen' },
        { status: 403 }
      );
    }

    const minute = await Minutes.findById(id);

    if (!minute) {
      return NextResponse.json(
        { error: 'Minute not found' },
        { status: 404 }
      );
    }

    // Clean up associated tasks — only delete if not referenced elsewhere
    const taskIds: string[] = [];
    minute.topics?.forEach((topic: any) => {
      topic.infoItems?.forEach((item: any) => {
        if (item.externalTaskId) taskIds.push(item.externalTaskId.toString());
      });
    });
    if (taskIds.length > 0) {
      // Check if any of these tasks are referenced in other minutes
      const otherMinutes = await Minutes.find({
        _id: { $ne: id },
        'topics.infoItems.externalTaskId': { $in: taskIds },
      }).select('_id topics.infoItems.externalTaskId').lean();

      const referencedElsewhere = new Set<string>();
      otherMinutes.forEach((m: any) => {
        m.topics?.forEach((t: any) => {
          t.infoItems?.forEach((i: any) => {
            if (i.externalTaskId) referencedElsewhere.add(i.externalTaskId.toString());
          });
        });
      });

      const toDelete = taskIds.filter(tid => !referencedElsewhere.has(tid));
      const toReassign = taskIds.filter(tid => referencedElsewhere.has(tid));

      if (toDelete.length > 0) {
        await Task.deleteMany({ _id: { $in: toDelete } });
      }
      // Reassign tasks that are still referenced to keep them accessible
      for (const tid of toReassign) {
        const refMinute = otherMinutes.find((m: any) =>
          m.topics?.some((t: any) => t.infoItems?.some((i: any) => i.externalTaskId?.toString() === tid))
        );
        if (refMinute) {
          await Task.findByIdAndUpdate(tid, { minutesId: refMinute._id.toString() });
        }
      }
    }

    await Minutes.findByIdAndDelete(id);

    // Audit Log
    await logAction({
      action: 'DELETE_MINUTE',
      details: `Minute ${minute.date} deleted`,
      userId: authResult.user._id.toString(),
      username: authResult.user.username,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      resourceType: 'Minute',
      resourceId: id
    });

    return NextResponse.json({
      success: true,
      message: 'Minute deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting minute:', error);
    return NextResponse.json(
      { error: 'Failed to delete minute' },
      { status: 500 }
    );
  }
}
