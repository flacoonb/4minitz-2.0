import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EnhancedMinutes from '@/models/EnhancedMinutes';
import Label from '@/models/Label';
import MeetingSeries from '@/models/MeetingSeries';
import { verifyToken } from '@/lib/auth';

// GET - Fetch all enhanced minutes
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;

    const url = new URL(request.url);
    const seriesId = url.searchParams.get('seriesId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const skip = parseInt(url.searchParams.get('skip') || '0');
    
    // Build filter
    const filter: any = { userId };
    if (seriesId) {
      filter.meetingSeries_id = seriesId;
    }

    const minutes = await EnhancedMinutes.find(filter)
      .populate('meetingSeries_id', 'project name')
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await EnhancedMinutes.countDocuments(filter);

    return NextResponse.json({
      success: true,
      data: minutes,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total
      }
    });

  } catch (error) {
    console.error('Error fetching enhanced minutes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch minutes' },
      { status: 500 }
    );
  }
}

// POST - Create new enhanced minutes
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;

    const body = await request.json();
    const {
      meetingSeries_id,
      date,
      title,
      participants,
      agendaItems,
      globalNote,
      location,
      startTime,
      endTime,
    } = body;

    // Validation
    if (!meetingSeries_id || !date) {
      return NextResponse.json(
        { error: 'Meeting series and date are required' },
        { status: 400 }
      );
    }

    // Verify meeting series exists and belongs to user
    const meetingSeries = await MeetingSeries.findOne({
      _id: meetingSeries_id,
      userId
    });

    if (!meetingSeries) {
      return NextResponse.json(
        { error: 'Meeting series not found' },
        { status: 404 }
      );
    }

    // Validate label references in agenda items
    if (agendaItems && agendaItems.length > 0) {
      const labelIds = agendaItems
        .flatMap((item: any) => item.entries || [])
        .map((entry: any) => entry.labelId)
        .filter((id: string) => id);

      if (labelIds.length > 0) {
        const existingLabels = await Label.find({
          _id: { $in: labelIds },
          $or: [{ userId }, { isSystemLabel: true }]
        });

        const existingLabelIds = existingLabels.map((l: any) => l._id.toString());
        const invalidLabelIds = labelIds.filter((id: string) => 
          !existingLabelIds.includes(id)
        );

        if (invalidLabelIds.length > 0) {
          return NextResponse.json(
            { error: `Invalid label IDs: ${invalidLabelIds.join(', ')}` },
            { status: 400 }
          );
        }
      }
    }

    // Generate agenda item numbers and entry IDs
    const processedAgendaItems = (agendaItems || []).map((item: any, index: number) => ({
      ...item,
      agendaNumber: index + 1,
      entries: (item.entries || []).map((entry: any, entryIndex: number) => ({
        ...entry,
        entryNumber: entryIndex + 1,
        id: entry.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
      })),
      id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }));

    // Create the enhanced minutes
    const newMinutes = new EnhancedMinutes({
      userId,
      meetingSeries_id,
      date: new Date(date),
      title: title || '',
      participants: participants || [],
      agendaItems: processedAgendaItems,
      globalNote: globalNote || '',
      location: location || '',
      startTime: startTime || '',
      endTime: endTime || '',
      isFinalized: false,
    });

    await newMinutes.save();

    // Populate the response
    const populatedMinutes = await EnhancedMinutes.findById(newMinutes._id)
      .populate('meetingSeries_id', 'project name')
      .lean();

    return NextResponse.json({
      success: true,
      data: populatedMinutes
    });

  } catch (error: any) {
    console.error('Error creating enhanced minutes:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { error: `Validation failed: ${validationErrors.join(', ')}` },
        { status: 400 }
      );
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'A meeting with this date already exists for this series' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create minutes' },
      { status: 500 }
    );
  }
}