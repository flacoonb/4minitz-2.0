import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { hasPermission, requirePermission } from '@/lib/permissions';

// GET - Get all users
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    // Check if user can manage users (admin) — affects which fields are returned
    const permResult = await requirePermission(authResult.user!, 'canManageUsers');
    const isManager = permResult.success;
    const canCreateMeetings = await hasPermission(authResult.user!, 'canCreateMeetings');

    const url = new URL(request.url);
    const page = Math.min(Math.max(parseInt(url.searchParams.get('page') || '1') || 1, 1), 10000);
    const requestedLimit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20') || 20, 1), 500);
    const limit = isManager ? requestedLimit : Math.min(requestedLimit, canCreateMeetings ? 200 : 20);
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';
    const status = url.searchParams.get('status') || '';

    // Build filter
    const filter: Record<string, unknown> = {};

    // Non-managers only see active users
    if (!isManager) {
      filter.isActive = true;
    }

    // Regular users without meeting-management capabilities may only view themselves.
    if (!isManager && !canCreateMeetings) {
      filter._id = authResult.user!._id;
    }

    if (search) {
      const escapedSearch = search.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { firstName: { $regex: escapedSearch, $options: 'i' } },
        { lastName: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { username: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    if (isManager && role && ['user', 'moderator', 'admin'].includes(role)) {
      filter.role = role;
    }

    if (isManager) {
      if (status === 'active') {
        filter.isActive = true;
      } else if (status === 'inactive') {
        filter.isActive = false;
      } else if (status === 'pending') {
        filter.isActive = false;
        filter.lastLogin = { $exists: false };
      }
    }

    // Non-managers get limited fields (for autocomplete/participant selection)
    const selectFields = isManager
      ? '-password'
      : canCreateMeetings
        ? '_id firstName lastName email username role'
        : '_id firstName lastName username role';

    // Get total count
    const total = await User.countDocuments(filter);

    // Get users with pagination
    const users = await User.find(filter)
      .select(selectFields)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Benutzer' },
      { status: 500 }
    );
  }
}

// POST - Create new user (Admin only)
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Verify authentication and admin role
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const createPermResult = await requirePermission(authResult.user!, 'canManageUsers');
    if (!createPermResult.success) {
      return NextResponse.json(
        { error: createPermResult.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      role = 'user',
      isActive = true
    } = body;

    // Validation
    if (!email || !username || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Alle Pflichtfelder müssen ausgefüllt werden' },
        { status: 400 }
      );
    }

    const normalizedUsername = String(username).trim();
    if (/^[a-fA-F0-9]{24}$/.test(normalizedUsername)) {
      return NextResponse.json(
        { error: 'Benutzername ist reserviert' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username: normalizedUsername }, { usernameHistory: normalizedUsername }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'E-Mail' : 'Benutzername';
      return NextResponse.json(
        { error: `${field} wird bereits verwendet` },
        { status: 409 }
      );
    }

    // Create new user
    const newUser = new User({
      email,
      username: normalizedUsername,
      password,
      firstName,
      lastName,
      role,
      isActive,
      isEmailVerified: true // Admin-created users are auto-verified
    });

    await newUser.save();

    return NextResponse.json({
      success: true,
      message: 'Benutzer erfolgreich erstellt',
      data: newUser.toJSON()
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating user:', error);

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { error: `Validierungsfehler: ${validationErrors.join(', ')}` },
        { status: 400 }
      );
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldName = field === 'email' ? 'E-Mail' : 'Benutzername';
      return NextResponse.json(
        { error: `${fieldName} wird bereits verwendet` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Benutzers' },
      { status: 500 }
    );
  }
}
