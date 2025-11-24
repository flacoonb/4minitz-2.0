import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EnhancedMinutes, { IEnhancedMinutes } from '@/models/EnhancedMinutes';
import { verifyToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;

    const { id } = await params;

    const minutes = await EnhancedMinutes.findOne({ _id: id, userId })
      .populate('meetingSeries_id', 'project name participants')
      .lean();

    if (!minutes) {
      return NextResponse.json(
        { error: 'Minutes not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: minutes
    });

  } catch (error) {
    console.error('Error fetching enhanced minutes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch minutes' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;

    const { id } = await params;
    const updates = await request.json();

    // Remove userId and meetingSeries_id from updates for security
    delete updates.userId;
    delete updates.meetingSeries_id;
    delete updates._id;

    // Process agenda items to maintain numbering
    if (updates.agendaItems) {
      updates.agendaItems = updates.agendaItems.map((item: any, index: number) => ({
        ...item,
        agendaNumber: index + 1,
        entries: (item.entries || []).map((entry: any, entryIndex: number) => ({
          ...entry,
          entryNumber: entryIndex + 1,
          id: entry.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
        })),
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
      }));
    }

    const updatedMinutes = await EnhancedMinutes.findOneAndUpdate(
      { _id: id, userId },
      { 
        ...updates,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('meetingSeries_id', 'project name participants');

    if (!updatedMinutes) {
      return NextResponse.json(
        { error: 'Minutes not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedMinutes
    });

  } catch (error: any) {
    console.error('Error updating enhanced minutes:', error);

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { error: `Validation failed: ${validationErrors.join(', ')}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update minutes' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;

    const { id } = await params;

    const deletedMinutes = await EnhancedMinutes.findOneAndDelete({
      _id: id,
      userId
    });

    if (!deletedMinutes) {
      return NextResponse.json(
        { error: 'Minutes not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Minutes deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting enhanced minutes:', error);
    return NextResponse.json(
      { error: 'Failed to delete minutes' },
      { status: 500 }
    );
  }
}