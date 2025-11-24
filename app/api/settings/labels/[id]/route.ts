/**
 * API Route: Single Label
 * Handles operations for a specific label
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Label from '@/models/Label';
import { verifyToken } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/settings/labels/[id]
 * Get a specific label by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await connectDB();
    const { id } = await context.params;
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }
    const userId = authResult.user.username;
    
    const label = await Label.findOne({
      _id: id,
      $or: [
        { createdBy: userId },
        { isSystemLabel: true }
      ]
    }).select('-__v').lean();
    
    if (!label) {
      return NextResponse.json(
        { success: false, error: 'Label not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: label,
    });
  } catch (error) {
    console.error('Error fetching label:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch label',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/labels/[id]
 * Update a specific label
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await connectDB();
    const { id } = await context.params;
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }
    const userId = authResult.user.username;
    const body = await request.json();
    
    // Check if label exists and user owns it (or is system label that can be modified)
    const label = await Label.findOne({
      _id: id,
      $or: [
        { createdBy: userId },
        { isSystemLabel: true }
      ]
    });
    
    if (!label) {
      return NextResponse.json(
        { success: false, error: 'Label not found or not authorized' },
        { status: 404 }
      );
    }
    
    // System labels cannot be deleted or have their core properties changed
    if (label.isSystemLabel) {
      return NextResponse.json(
        { success: false, error: 'System labels cannot be modified' },
        { status: 403 }
      );
    }
    
    // Check if new name conflicts with existing labels
    if (body.name && body.name !== label.name) {
      const existingLabel = await Label.findOne({
        name: body.name,
        _id: { $ne: id },
        $or: [
          { createdBy: userId },
          { isSystemLabel: true }
        ]
      });
      
      if (existingLabel) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'A label with this name already exists',
          },
          { status: 400 }
        );
      }
    }
    
    // Update allowed fields
    const allowedUpdates = ['name', 'color', 'description', 'icon'];
    allowedUpdates.forEach(field => {
      if (body[field] !== undefined) {
        (label as any)[field] = field === 'name' || field === 'description' 
          ? body[field]?.trim() 
          : body[field];
      }
    });
    
    await label.save();
    
    return NextResponse.json({
      success: true,
      data: label,
      message: 'Label updated successfully',
    });
  } catch (error) {
    console.error('Error updating label:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update label',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/labels/[id]
 * Delete a label
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await connectDB();
    const { id } = await context.params;
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }
    const userId = authResult.user.username;
    
    const label = await Label.findOne({
      _id: id,
      createdBy: userId,
      isSystemLabel: false, // Only allow deletion of custom labels
    });
    
    if (!label) {
      return NextResponse.json(
        { success: false, error: 'Label not found or cannot be deleted' },
        { status: 404 }
      );
    }
    
    await Label.findByIdAndDelete(id);
    
    return NextResponse.json({
      success: true,
      message: 'Label deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting label:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete label',
      },
      { status: 500 }
    );
  }
}