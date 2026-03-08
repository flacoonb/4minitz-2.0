import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { getDefaultPermissions } from '@/lib/permissions';

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
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    const permissions = (settings && settings.roles && settings.roles[user.role])
      ? settings.roles[user.role]
      : getDefaultPermissions(user.role);

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