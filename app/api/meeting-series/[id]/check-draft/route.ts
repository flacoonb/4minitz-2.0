import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const { id: seriesId } = await params;

    // Verify user has access to this series
    const username = authResult.user.username;
    const series = await MeetingSeries.findById(seriesId);
    if (!series) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const hasAccess = series.visibleFor?.includes(username) ||
                      series.moderators?.includes(username) ||
                      series.participants?.includes(username) ||
                      authResult.user.role === 'admin';
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Check if there's an existing draft for this series
    const draftMinutes = await Minutes.findOne({
      meetingSeries_id: seriesId,
      isFinalized: false
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      hasDraft: !!draftMinutes,
      draft: draftMinutes ? {
        _id: draftMinutes._id,
        date: draftMinutes.date,
        createdAt: draftMinutes.createdAt
      } : null
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Fehler beim Prüfen des Entwurfs' },
      { status: 500 }
    );
  }
}
