/**
 * API Route: Settings Labels
 * Handles CRUD operations for custom labels/categories
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Label from '@/models/Label';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/settings/labels
 * Retrieve all labels for the user
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;

    // Get user's custom labels and system labels
    const labels = await Label.find({
      $or: [
        { createdBy: userId },
        { isSystemLabel: true }
      ]
    })
    .sort({ isSystemLabel: -1, name: 1 }) // System labels first, then alphabetically
    .select('-__v')
    .lean();
    
    return NextResponse.json({
      success: true,
      count: labels.length,
      data: labels,
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch labels',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/labels
 * Create a new custom label
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;
    
    // Validation
    if (!body.name || !body.color) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Name and color are required',
        },
        { status: 400 }
      );
    }
    
    // Check if label name already exists for this user
    const existingLabel = await Label.findOne({
      name: body.name,
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
    
    // Create new label
    const newLabel = await Label.create({
      name: body.name.trim(),
      color: body.color,
      description: body.description?.trim() || '',
      icon: body.icon || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // Default info icon
      isSystemLabel: authResult.user.role === 'admin' && body.isSystemLabel ? true : false,
      createdBy: userId,
    });
    
    return NextResponse.json(
      {
        success: true,
        data: newLabel,
        message: 'Label created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating label:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create label',
      },
      { status: 500 }
    );
  }
}