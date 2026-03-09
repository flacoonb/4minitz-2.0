import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import ClubFunction from '@/models/ClubFunction';
import User from '@/models/User';
import { createFunctionToken, normalizeFunctionName, slugifyFunctionName } from '@/lib/club-functions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const entry = await ClubFunction.findById(id).lean();
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { ...entry, token: createFunctionToken(entry.slug) } });
  } catch (error) {
    console.error('Error fetching club function:', error);
    return NextResponse.json({ error: 'Failed to fetch club function' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const canManageUsers = await hasPermission(auth.user, 'canManageUsers');
    if (!canManageUsers && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updatedBy: auth.user._id.toString(),
    };

    if (body.name !== undefined) {
      const name = normalizeFunctionName(String(body.name || ''));
      if (!name || name.length < 2) {
        return NextResponse.json({ error: 'Name ist erforderlich (mindestens 2 Zeichen)' }, { status: 400 });
      }
      updateData.name = name;
      if (body.slug === undefined) {
        updateData.slug = slugifyFunctionName(name);
      }
    }

    if (body.slug !== undefined) {
      const slug = slugifyFunctionName(String(body.slug || ''));
      if (!slug) return NextResponse.json({ error: 'Ungültiger Slug' }, { status: 400 });
      updateData.slug = slug;
    }

    if (body.description !== undefined) updateData.description = String(body.description || '').trim();
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder) || 0;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.validFrom !== undefined) updateData.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validTo !== undefined) updateData.validTo = body.validTo ? new Date(body.validTo) : null;
    if (body.assignedUserId !== undefined) {
      const assignedUserId = String(body.assignedUserId || '').trim();
      if (assignedUserId) {
        const userExists = await User.exists({ _id: assignedUserId });
        if (!userExists) {
          return NextResponse.json({ error: 'Zugeordnete Person nicht gefunden' }, { status: 400 });
        }
        updateData.assignedUserId = assignedUserId;
      } else {
        updateData.assignedUserId = null;
      }
      updateData.assignmentUpdatedAt = new Date();
    }

    const updated = await ClubFunction.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: { ...updated, token: createFunctionToken(updated.slug) } });
  } catch (error: any) {
    console.error('Error updating club function:', error);
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Slug bereits vergeben' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update club function' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const canManageUsers = await hasPermission(auth.user, 'canManageUsers');
    if (!canManageUsers && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const updated = await ClubFunction.findByIdAndUpdate(
      id,
      {
        $set: {
          isActive: false,
          validTo: new Date(),
          updatedBy: auth.user._id.toString(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      success: true,
      message: 'Funktion wurde deaktiviert',
      data: { ...updated, token: createFunctionToken(updated.slug) },
    });
  } catch (error) {
    console.error('Error deactivating club function:', error);
    return NextResponse.json({ error: 'Failed to deactivate club function' }, { status: 500 });
  }
}
