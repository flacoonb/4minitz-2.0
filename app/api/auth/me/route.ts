import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';

// GET - Get current user
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const user = await User.findById(authResult.user._id).select('-password');
    if (!user) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    // Fetch settings to get permissions
    const settings = await Settings.findOne({}).sort({ version: -1 });
    let permissions = {};
    
    if (settings && settings.roles && settings.roles[user.role]) {
      permissions = settings.roles[user.role];
    } else {
      // Default permissions if no settings found
      if (user.role === 'admin') {
        permissions = {
          canCreateMeetings: true,
          canModerateAllMeetings: true,
          canViewAllMeetings: true,
          canEditAllMinutes: true,
          canDeleteMinutes: true,
          canManageUsers: true,
          canAssignModerators: true,
          canExportData: true,
          canAccessReports: true
        };
      } else if (user.role === 'moderator') {
        permissions = {
          canCreateMeetings: true,
          canModerateAllMeetings: false,
          canViewAllMeetings: false,
          canEditAllMinutes: false,
          canDeleteMinutes: false,
          canManageUsers: false,
          canAssignModerators: false,
          canExportData: true,
          canAccessReports: false
        };
      } else {
        permissions = {
          canCreateMeetings: false,
          canModerateAllMeetings: false,
          canViewAllMeetings: false,
          canEditAllMinutes: false,
          canDeleteMinutes: false,
          canManageUsers: false,
          canAssignModerators: false,
          canExportData: false,
          canAccessReports: false
        };
      }
    }

    // Include autoLogout settings for client-side inactivity detection
    const autoLogout = settings?.systemSettings?.autoLogout ?? { enabled: true, minutes: 480 };

    return NextResponse.json({
      success: true,
      data: {
        ...user.toJSON(),
        permissions
      },
      autoLogout
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Benutzerdaten' },
      { status: 500 }
    );
  }
}