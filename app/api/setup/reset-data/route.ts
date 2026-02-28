import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import Task from '@/models/Task';
import MeetingSeries from '@/models/MeetingSeries';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  return NextResponse.json({ error: 'Use POST with admin authentication' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // 1. Delete all Minutes
    const minResult = await Minutes.deleteMany({});
    
    // 2. Delete all Tasks
    const taskResult = await Task.deleteMany({});

    // 3. Reset Meeting Series counters
    const seriesResult = await MeetingSeries.updateMany({}, {
      $set: {
        minutes: [],
        lastMinutesDate: null,
        lastMinutesFinalized: false,
        lastMinutesId: null
      }
    });

    return NextResponse.json({
      success: true,
      deletedMinutes: minResult.deletedCount,
      deletedTasks: taskResult.deletedCount,
      resetSeries: seriesResult.modifiedCount
    });

  } catch (_error) {
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
