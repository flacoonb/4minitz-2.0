import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import MeetingSeries from '@/models/MeetingSeries';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { verifyToken } from '@/lib/auth';
import { sendPendingTasksReminder } from '@/lib/email-service';

export async function POST(request: NextRequest) {
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

    const user = authResult.user;

    // Check permissions (Moderator or Admin)
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Find series where user is moderator (or all if admin)
    let seriesIds: string[] = [];
    if (user.role === 'admin') {
      const allSeries = await MeetingSeries.find({}, '_id');
      seriesIds = allSeries.map((s: any) => s._id.toString());
    } else {
      const modSeries = await MeetingSeries.find({ moderators: user.username }, '_id');
      seriesIds = modSeries.map((s: any) => s._id.toString());
    }

    if (seriesIds.length === 0) {
      return NextResponse.json({ message: 'No series found to manage', count: 0 });
    }

    // Find all open tasks for these series
    const tasks = await Task.find({
      meetingSeriesId: { $in: seriesIds },
      status: { $in: ['open', 'in-progress'] }
    });

    if (tasks.length === 0) {
      return NextResponse.json({ message: 'No open tasks found', count: 0 });
    }

    // Fetch Meeting Series details manually
    const seriesList = await MeetingSeries.find({ _id: { $in: seriesIds } });
    const seriesMap = new Map(seriesList.map((s: any) => [s._id.toString(), s]));

    // Group tasks by responsible user
    const tasksByUser: Record<string, { user: any, tasks: any[] }> = {};
    
    // Let's collect all responsible IDs
    const responsibleIds = new Set<string>();
    tasks.forEach(task => {
      task.responsibles.forEach((r: string) => responsibleIds.add(r));
    });

    // Fetch users to get emails
    const users = await User.find({ _id: { $in: Array.from(responsibleIds) } });
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    for (const task of tasks) {
      const series = seriesMap.get(task.meetingSeriesId);

      for (const respId of task.responsibles) {
        const respUser = userMap.get(respId.toString());
        if (respUser && respUser.email) {
          if (!tasksByUser[respUser.email]) {
            tasksByUser[respUser.email] = {
              user: respUser,
              tasks: []
            };
          }
          
          tasksByUser[respUser.email].tasks.push({
            subject: task.subject,
            dueDate: task.dueDate,
            priority: task.priority,
            meetingSeries: series ? {
                name: series.name,
                project: series.project
            } : null
          });
        }
      }
    }

    // Send emails
    let sentCount = 0;
    for (const [email, data] of Object.entries(tasksByUser)) {
      const { user: targetUser, tasks: userTasks } = data;
      const locale = (targetUser?.preferences?.language as 'de' | 'en') || 'de';

      try {
        await sendPendingTasksReminder({
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName
        }, userTasks, locale);
        sentCount++;
      } catch (e) {
        console.error(`Failed to send reminder to ${email}`, e);
      }
    }

    // Update last execution time in settings
    await Settings.findOneAndUpdate(
      {},
      { $set: { 'systemSettings.lastRemindersSentAt': new Date() } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ 
      success: true, 
      message: `Reminders sent to ${sentCount} users`,
      details: {
        tasksFound: tasks.length,
        usersContacted: sentCount
      }
    });

  } catch (error) {
    console.error('Error sending reminders:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
