import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

/**
 * POST /api/admin/fix-user-access-all
 * Add current user to all meeting series and minutes they should have access to
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const userId = authResult.user.username;

    // Add user to all meeting series where they don't have access yet
    const seriesResult = await MeetingSeries.updateMany(
      {
        // Find series where user is not in visibleFor array
        visibleFor: { $ne: userId }
      },
      {
        // Add user to visibleFor array
        $addToSet: {
          visibleFor: userId,
          participants: userId
        }
      }
    );

    // Add user to all minutes where they don't have access yet
    const minutesResult = await Minutes.updateMany(
      {
        // Find minutes where user is not in visibleFor array
        visibleFor: { $ne: userId }
      },
      {
        // Add user to visibleFor array
        $addToSet: {
          visibleFor: userId,
          participants: userId
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: `User ${userId} added to ${seriesResult.modifiedCount} meeting series and ${minutesResult.modifiedCount} minutes`,
      seriesModified: seriesResult.modifiedCount,
      minutesModified: minutesResult.modifiedCount
    });
    
  } catch (error) {
    console.error('Error fixing user access:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
