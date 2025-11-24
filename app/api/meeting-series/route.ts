/**
 * API Route: Meeting Series
 * Handles CRUD operations for meeting series
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MeetingSeries from '@/models/MeetingSeries';
import Settings from '@/models/Settings';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/meeting-series
 * Retrieve all meeting series visible to the user
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Verify authentication (optional). If authenticated, filter by username;
    // otherwise only return public meeting series.
    const authResult = await verifyToken(request);
    const username = authResult.success && authResult.user ? authResult.user.username : null;
    const userId = authResult.success && authResult.user ? authResult.user._id.toString() : null;
    const userRole = authResult.success && authResult.user ? authResult.user.role : null;

    // Check permissions via Settings
    const settings = await Settings.findOne({}).sort({ version: -1 });
    let canViewAll = false;

    if (settings && settings.roles && userRole && (settings.roles as any)[userRole]) {
      canViewAll = (settings.roles as any)[userRole].canViewAllMeetings;
    }

    // Build query
    let query: any = {};
    if (username && userId) {
      if (!canViewAll) {
        query = {
          $or: [
            { visibleFor: username },
            { visibleFor: userId },
            { moderators: username },
            { moderators: userId },
            { participants: username },
            { participants: userId },
          ],
        };
      }
      // If canViewAll is true, we don't add any filter, so all series are returned
    } else {
      // Unauthenticated: no access
      return NextResponse.json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const series = await MeetingSeries.find(query)
    .sort({ lastMinutesDate: -1, updatedAt: -1 })
    .limit(50)
    .select('-__v')
    .lean();
    
    return NextResponse.json({
      success: true,
      count: series.length,
      data: series,
    });
  } catch (error) {
    console.error('Error fetching meeting series:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch meeting series',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meeting-series
 * Create a new meeting series
 * Only admins and moderators are allowed
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    
    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const username = authResult.user.username;
    const userRole = authResult.user.role;

    // Check permissions via Settings
    const settings = await Settings.findOne({}).sort({ version: -1 });
    let canCreate = false;

    if (settings && settings.roles && settings.roles[userRole]) {
      canCreate = settings.roles[userRole].canCreateMeetings;
    } else {
      // Fallback: Only admin and moderator can create
      canCreate = ['admin', 'moderator'].includes(userRole);
    }
    
    if (!canCreate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden: Sie haben keine Berechtigung, Sitzungsserien zu erstellen' 
        },
        { status: 403 }
      );
    }
    
    // Validation
    if (!body.project || !body.name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Project and name are required',
        },
        { status: 400 }
      );
    }
    
    // Create new meeting series
    // Note: moderators, participants, visibleFor should contain usernames, not IDs
    const newSeries = await MeetingSeries.create({
      project: body.project,
      name: body.name,
      visibleFor: body.visibleFor || [], // Can be empty for public access
      moderators: [username, ...(body.moderators || [])].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
      participants: body.participants || [],
      informedUsers: body.informedUsers || [],
      additionalResponsibles: body.additionalResponsibles || [],
      members: body.members || [],
      availableLabels: body.availableLabels || [
        { name: 'Important', color: '#FF0000', isDefaultLabel: true },
        { name: 'Decision', color: '#00FF00', isDefaultLabel: true },
        { name: 'TODO', color: '#0000FF', isDefaultLabel: true },
      ],
    });
    
    return NextResponse.json(
      {
        success: true,
        data: newSeries,
        message: 'Meeting series created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating meeting series:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create meeting series',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
