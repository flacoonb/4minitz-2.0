import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id: seriesId } = await params;

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
  } catch (error) {
    console.error('Error checking draft:', error);
    return NextResponse.json(
      { success: false, error: 'Fehler beim Prüfen des Entwurfs' },
      { status: 500 }
    );
  }
}
