import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import User from '@/models/User';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import Task from '@/models/Task';
import Attachment from '@/models/Attachment';
import PendingNotification from '@/models/PendingNotification';

type ResetTarget = 'users' | 'minutes' | 'meeting-series' | 'all';

async function verifyAdmin(request: NextRequest) {
  const authResult = await verifyToken(request);
  if (!authResult.success || !authResult.user) {
    return { error: NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 }) };
  }
  if (authResult.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin-Berechtigung erforderlich' }, { status: 403 }) };
  }
  return { user: authResult.user };
}

async function resetUsers(currentUserId: string) {
  const usersResult = await User.deleteMany({ _id: { $ne: currentUserId } });
  const pendingResult = await PendingNotification.deleteMany({});
  return {
    usersDeleted: usersResult.deletedCount ?? 0,
    pendingNotificationsDeleted: pendingResult.deletedCount ?? 0,
  };
}

async function resetMinutesOnly() {
  const minuteIds = await Minutes.find({}).distinct('_id');
  const minuteIdStrings = minuteIds.map((id) => id.toString());

  const [minutesResult, tasksResult, attachmentsResult, pendingResult] = await Promise.all([
    Minutes.deleteMany({}),
    Task.deleteMany({}),
    Attachment.deleteMany({ minuteId: { $in: minuteIds } }),
    PendingNotification.deleteMany({
      type: { $in: ['newMinute', 'actionItemAssigned', 'actionItemOverdue'] },
    }),
  ]);

  await MeetingSeries.updateMany(
    {},
    {
      $unset: {
        lastMinutesDate: '',
        lastMinutesId: '',
      },
      $set: {
        lastMinutesFinalized: false,
      },
    }
  );

  return {
    minutesDeleted: minutesResult.deletedCount ?? 0,
    tasksDeleted: tasksResult.deletedCount ?? 0,
    attachmentsDeleted: attachmentsResult.deletedCount ?? 0,
    pendingNotificationsDeleted: pendingResult.deletedCount ?? 0,
    minuteIdsAffected: minuteIdStrings.length,
  };
}

async function resetMeetingSeriesWithRelatedMinutes() {
  const seriesIds = await MeetingSeries.find({}).distinct('_id');
  const seriesIdStrings = seriesIds.map((id) => id.toString());
  const minuteIds = await Minutes.find({ meetingSeries_id: { $in: seriesIds } }).distinct('_id');

  const [meetingSeriesResult, minutesResult, tasksResult, attachmentsResult] = await Promise.all([
    MeetingSeries.deleteMany({}),
    Minutes.deleteMany({ meetingSeries_id: { $in: seriesIds } }),
    Task.deleteMany({ meetingSeriesId: { $in: seriesIdStrings } }),
    Attachment.deleteMany({ minuteId: { $in: minuteIds } }),
  ]);

  return {
    meetingSeriesDeleted: meetingSeriesResult.deletedCount ?? 0,
    minutesDeleted: minutesResult.deletedCount ?? 0,
    tasksDeleted: tasksResult.deletedCount ?? 0,
    attachmentsDeleted: attachmentsResult.deletedCount ?? 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const target = body?.target as ResetTarget;
    const allowedTargets: ResetTarget[] = ['users', 'minutes', 'meeting-series', 'all'];

    if (!allowedTargets.includes(target)) {
      return NextResponse.json({ error: 'Invalid reset target' }, { status: 400 });
    }

    const result: Record<string, number> = {};

    if (target === 'users') {
      Object.assign(result, await resetUsers(auth.user._id.toString()));
    } else if (target === 'minutes') {
      Object.assign(result, await resetMinutesOnly());
    } else if (target === 'meeting-series') {
      Object.assign(result, await resetMeetingSeriesWithRelatedMinutes());
    } else if (target === 'all') {
      Object.assign(result, await resetUsers(auth.user._id.toString()));
      Object.assign(result, await resetMinutesOnly());
      Object.assign(result, await resetMeetingSeriesWithRelatedMinutes());
    }

    await logAction({
      action: 'RESET_SYSTEM_DATA',
      details: `System data reset executed for target: ${target}`,
      userId: auth.user._id.toString(),
      username: auth.user.username,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      resourceType: 'System',
      resourceId: target,
      metadata: result,
    });

    return NextResponse.json({
      success: true,
      message: `Reset for "${target}" completed`,
      data: result,
    });
  } catch (error) {
    console.error('Error resetting system data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

