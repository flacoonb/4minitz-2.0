import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import Settings from '@/models/Settings';
import Task from '@/models/Task';
import { verifyToken } from '@/lib/auth';
import { logAction } from '@/lib/audit';

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
    const userRole = authResult.success && authResult.user ? authResult.user.role : null;

    const minute = await Minutes.findOne({ _id: id })
      .populate({ path: 'meetingSeries_id', model: MeetingSeries })
      .lean();

    if (!minute) {
      return NextResponse.json(
        { error: 'Minute not found' },
        { status: 404 }
      );
    }
    
    // Check permissions via Settings
    const settings = await Settings.findOne({}).sort({ version: -1 });
    let canViewAll = false;

    if (settings && settings.roles && userRole && (settings.roles as any)[userRole]) {
      const rolePermissions = (settings.roles as any)[userRole];
      if (rolePermissions.canViewAllMinutes !== undefined) {
        canViewAll = rolePermissions.canViewAllMinutes;
      } else {
        // Default: Admin gets access, others don't (strict separation from canViewAllMeetings)
        canViewAll = (userRole === 'admin');
      }
    }

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
    const userRole = authResult.user.role;

    const minute = await Minutes.findById(id);
    
    if (!minute) {
      return NextResponse.json(
        { error: 'Minute not found' },
        { status: 404 }
      );
    }

    // Check permissions for finalized minutes
    if (minute.isFinalized && userRole === 'user') {
      return NextResponse.json(
        { error: 'Forbidden: Nur Administratoren und Moderatoren dürfen finalisierte Protokolle bearbeiten' },
        { status: 403 }
      );
    }

    // Check permissions for finalization/reopening
    if (body.isFinalized !== undefined && body.isFinalized !== minute.isFinalized) {
      if (userRole === 'user') {
        return NextResponse.json(
          { error: 'Forbidden: Nur Administratoren und Moderatoren dürfen Protokolle finalisieren oder wiedereröffnen' },
          { status: 403 }
        );
      }
    }

    // Sync infoItems with Central Task Registry
    if (body.topics) {
      for (const topic of body.topics) {
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
                  responsibles: item.responsibles || [],
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
              } catch {
                // Task sync failure is non-fatal — minute save continues
              }
            } else if (item.itemType === 'infoItem' && item.externalTaskId) {
              // Item was changed from actionItem to infoItem — clean up orphaned task
              try {
                await Task.findByIdAndDelete(item.externalTaskId);
                item.externalTaskId = undefined;
              } catch {
                // Cleanup failure is non-fatal
              }
            }
          }
        }
      }
    }

    // Build update object with explicit field setting
    const updateData: any = {
      date: body.date ? new Date(body.date) : minute.date,
      participants: body.participants,
      participantsWithStatus: body.participantsWithStatus,
      topics: body.topics,
      globalNote: body.globalNote,
      time: body.time || '', // Set to empty string if undefined/null
      location: body.location || '', // Set to empty string if undefined/null
      title: body.title || '', // Set to empty string if undefined/null
      updatedAt: new Date()
    };

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

    // Check role - only admin and moderator can delete minutes
    if (authResult.user.role === 'user') {
      return NextResponse.json(
        { error: 'Forbidden: Nur Administratoren und Moderatoren dürfen Protokolle löschen' },
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
