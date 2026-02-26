import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';

// GET - Get all users (Admin only)
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

    // Allow access if user has 'canManageUsers' OR if it's a simple lookup (e.g. for autocomplete)
    // For now, we relax this to allow authenticated users to see the user list (needed for assigning tasks/participants)
    // Ideally, we should have a separate endpoint for "search users" vs "manage users"
    // const permResult = await requirePermission(authResult.user!, 'canManageUsers');
    // if (!permResult.success) {
    //   return NextResponse.json(
    //     { error: permResult.error },
    //     { status: 403 }
    //   );
    // }

    const url = new URL(request.url);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1') || 1, 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20') || 20, 1), 100);
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';
    const status = url.searchParams.get('status') || '';

    // Build filter
    const filter: Record<string, unknown> = {};
    
    if (search) {
      const escapedSearch = search.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { firstName: { $regex: escapedSearch, $options: 'i' } },
        { lastName: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { username: { $regex: escapedSearch, $options: 'i' } }
      ];
    }
    
    if (role && ['user', 'moderator', 'admin'].includes(role)) {
      filter.role = role;
    }
    
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    // Get total count
    const total = await User.countDocuments(filter);

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
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
        pages: Math.ceil(total / limit),
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

    if (authResult.user!.role !== 'admin') {
      return NextResponse.json(
        { error: 'Nur Administratoren haben Zugriff auf diese Ressource' },
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

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
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
      username,
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