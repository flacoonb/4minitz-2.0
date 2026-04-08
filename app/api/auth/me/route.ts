import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { getDefaultPermissions } from '@/lib/permissions';

const SESSION_JSON_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
};

// GET - Get current user
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      // 200 + data: null avoids browser console "failed" noise for the routine
      // "am I logged in?" check (httpOnly cookie → client cannot skip the request).
      return NextResponse.json({ success: true, data: null }, { headers: SESSION_JSON_HEADERS });
    }

    const user = await User.findById(authResult.user._id).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404, headers: SESSION_JSON_HEADERS });
    }

    // Fetch settings to get permissions
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    const rolePermissions = (settings && settings.roles && settings.roles[user.role])
      ? settings.roles[user.role]
      : null;
    const permissions = {
      ...getDefaultPermissions(user.role),
      ...(rolePermissions || {}),
    };

    // Include autoLogout settings for client-side inactivity detection
    const autoLogout = settings?.systemSettings?.autoLogout ?? { enabled: true, minutes: 480 };

    return NextResponse.json(
      {
        success: true,
        data: {
          ...user.toJSON(),
          permissions
        },
        autoLogout,
      },
      { headers: SESSION_JSON_HEADERS }
    );
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Benutzerdaten' },
      { status: 500, headers: SESSION_JSON_HEADERS }
    );
  }
}
