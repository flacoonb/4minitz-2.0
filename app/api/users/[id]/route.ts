import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import MeetingSeries from '@/models/MeetingSeries';
import Task from '@/models/Task';
import { verifyToken, requirePermission } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Users can view their own profile, admins can view any profile
    if (authResult.user!._id.toString() !== id) {
      const permResult = await requirePermission(authResult.user!, 'canManageUsers');
      if (!permResult.success) {
        return NextResponse.json(
          { error: permResult.error },
          { status: 403 }
        );
      }
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user
    });

  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen des Benutzers' },
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

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Users can edit their own profile, admins can edit any profile
    const isOwnProfile = authResult.user!._id.toString() === id;
    if (!isOwnProfile) {
      const permResult = await requirePermission(authResult.user!, 'canManageUsers');
      if (!permResult.success) {
        return NextResponse.json(
          { error: permResult.error },
          { status: 403 }
        );
      }
    }

    // Get the user to update
    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    // Update fields
    if (body.firstName) userToUpdate.firstName = body.firstName;
    if (body.lastName) userToUpdate.lastName = body.lastName;
    if (body.email && body.email !== userToUpdate.email) {
      userToUpdate.email = body.email;
      if (isOwnProfile) {
        userToUpdate.isEmailVerified = false;
      }
    }
    if (body.username) userToUpdate.username = body.username;
    if (body.avatar !== undefined) userToUpdate.avatar = body.avatar;

    // Handle preferences
    if (body.preferences) {
      if (body.preferences.language) userToUpdate.preferences.language = body.preferences.language;
      if (body.preferences.theme) userToUpdate.preferences.theme = body.preferences.theme;
      
      // Handle flat structure from frontend (backward compatibility)
      if (body.preferences.emailNotifications !== undefined) {
        userToUpdate.preferences.notifications.email = body.preferences.emailNotifications;
      }
      if (body.preferences.pushNotifications !== undefined) {
        userToUpdate.preferences.notifications.inApp = body.preferences.pushNotifications;
      }

      // Handle nested structure
      if (body.preferences.notifications) {
        if (body.preferences.notifications.email !== undefined) {
          userToUpdate.preferences.notifications.email = body.preferences.notifications.email;
        }
        if (body.preferences.notifications.inApp !== undefined) {
          userToUpdate.preferences.notifications.inApp = body.preferences.notifications.inApp;
        }
        if (body.preferences.notifications.reminders !== undefined) {
          userToUpdate.preferences.notifications.reminders = body.preferences.notifications.reminders;
        }
      }
    }

    // Only admins can update role and status
    if (!isOwnProfile) {
      // Protect last admin from demotion or deactivation
      if (userToUpdate.role === 'admin' && (body.role && body.role !== 'admin' || body.isActive === false)) {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Der letzte aktive Admin kann nicht herabgestuft oder deaktiviert werden' },
            { status: 400 }
          );
        }
      }
      if (body.role) userToUpdate.role = body.role;
      if (body.isActive !== undefined) userToUpdate.isActive = body.isActive;
      if (body.isEmailVerified !== undefined) userToUpdate.isEmailVerified = body.isEmailVerified;
    }

    // Handle password update
    if (body.password) {
      if (isOwnProfile) {
        // Users must provide current password to change it
        if (!body.currentPassword) {
          return NextResponse.json(
            { error: 'Aktuelles Passwort erforderlich' },
            { status: 400 }
          );
        }

        const isCurrentPasswordValid = await userToUpdate.comparePassword(body.currentPassword);
        if (!isCurrentPasswordValid) {
          return NextResponse.json(
            { error: 'Aktuelles Passwort ist falsch' },
            { status: 400 }
          );
        }
      }
      userToUpdate.password = body.password; // Will be hashed by pre-save middleware
    }

    // Update user
    await userToUpdate.save();
    
    // Return user without sensitive fields (toJSON strips password, tokens, etc.)
    const userResponse = userToUpdate.toJSON();

    return NextResponse.json({
      success: true,
      message: 'Benutzer erfolgreich aktualisiert',
      data: userResponse
    });

  } catch (error: any) {
    console.error('Error updating user:', error);

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
      { error: 'Fehler beim Aktualisieren des Benutzers' },
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

    // Verify authentication and admin role
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const permResult = await requirePermission(authResult.user!, 'canManageUsers');
    if (!permResult.success) {
      return NextResponse.json(
        { error: permResult.error },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent self-deletion
    if (authResult.user!._id.toString() === id) {
      return NextResponse.json(
        { error: 'Sie können sich nicht selbst löschen' },
        { status: 400 }
      );
    }

    // Protect last admin from deletion
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    if (userToDelete.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Der letzte Admin kann nicht gelöscht werden' },
          { status: 400 }
        );
      }
    }

    // Cascade cleanup: remove user from meeting series
    const username = userToDelete.username;
    const userId = userToDelete._id.toString();
    await MeetingSeries.updateMany(
      { $or: [{ visibleFor: username }, { moderators: username }, { participants: username }] },
      { $pull: { visibleFor: username, moderators: username, participants: username, members: { userId } } }
    );

    // Remove user from task responsibles
    await Task.updateMany(
      { responsibles: userId },
      { $pull: { responsibles: userId } }
    );

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Benutzer erfolgreich gelöscht'
    });

  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Benutzers' },
      { status: 500 }
    );
  }
}