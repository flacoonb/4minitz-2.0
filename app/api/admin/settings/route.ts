import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings, { ISettings } from '@/models/Settings';
import { verifyToken } from '@/lib/auth';
import { logAction } from '@/lib/audit';

/** Default settings used when no DB record exists and for reset-to-defaults */
const DEFAULT_SETTINGS = {
  roles: {
    admin: {
      canCreateMeetings: true,
      canModerateAllMeetings: true,
      canViewAllMeetings: true,
      canViewAllMinutes: true,
      canEditAllMinutes: true,
      canDeleteMinutes: true,
      canManageUsers: true,
      canAssignModerators: true,
      canExportData: true,
      canAccessReports: true
    },
    moderator: {
      canCreateMeetings: true,
      canModerateAllMeetings: false,
      canViewAllMeetings: true,
      canViewAllMinutes: false,
      canEditAllMinutes: false,
      canDeleteMinutes: false,
      canManageUsers: false,
      canAssignModerators: false,
      canExportData: true,
      canAccessReports: false
    },
    user: {
      canCreateMeetings: false,
      canModerateAllMeetings: false,
      canViewAllMeetings: false,
      canViewAllMinutes: false,
      canEditAllMinutes: false,
      canDeleteMinutes: false,
      canManageUsers: false,
      canAssignModerators: false,
      canExportData: false,
      canAccessReports: false
    }
  },
  memberSettings: {
    requireEmailVerification: true,
    allowSelfRegistration: false,
  },
  notificationSettings: {
    enableEmailNotifications: true,
    enableDigestEmails: false,
    digestFrequency: 'weekly'
  },
  systemSettings: {
    organizationName: '4Minitz 2.0',
    organizationLogo: null,
    timezone: 'Europe/Berlin',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    enableAuditLog: true,
    autoLogout: { enabled: true, minutes: 480 },
    maxFileUploadSize: 10,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    baseUrl: 'http://localhost:3000'
  }
};

/** Verify admin authentication */
async function verifyAdmin(request: NextRequest) {
  const authResult = await verifyToken(request);
  if (!authResult.success || !authResult.user) {
    return { error: NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 }) };
  }
  if (authResult.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin-Berechtigung erforderlich' }, { status: 403 }) };
  }
  return { user: authResult.user };
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const settings = (await Settings.findOne({}).sort({ updatedAt: -1 }).lean()) as ISettings | null;

    if (!settings) {
      return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
    }

    // Ensure new permissions exist in the response
    if (settings.roles) {
      (['admin', 'moderator', 'user'] as const).forEach(role => {
        if (settings.roles[role]) {
          if (settings.roles[role].canViewAllMinutes === undefined) {
            settings.roles[role].canViewAllMinutes = role === 'admin';
          }
        }
      });
    }

    // Mask SMTP password in response
    if (settings.smtpSettings?.auth?.pass) {
      settings.smtpSettings.auth.pass = '********';
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const userId = auth.user._id.toString();
    const body = await request.json();

    // Only allow specific top-level sections to be updated (prevent arbitrary field injection)
    const allowedSections = ['roles', 'memberSettings', 'notificationSettings', 'systemSettings'] as const;
    const setData: Record<string, unknown> = { updatedBy: userId };
    for (const section of allowedSections) {
      if (body[section] !== undefined) setData[section] = body[section];
    }

    // Atomic upsert to avoid read-modify-write race condition
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: setData },
      { upsert: true, new: true, sort: { updatedAt: -1 }, runValidators: true }
    );

    await logAction({
      action: 'UPDATE_SETTINGS',
      details: 'System settings updated',
      userId,
      username: auth.user.username,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      resourceType: 'Settings',
      resourceId: settings._id.toString()
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating admin settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();

    if (body.action !== 'reset-to-defaults') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const userId = auth.user._id.toString();

    // Delete existing settings and create fresh with defaults
    await Settings.deleteMany({});
    const settings = new Settings({
      ...DEFAULT_SETTINGS,
      updatedBy: userId
    });
    await settings.save();

    await logAction({
      action: 'RESET_SETTINGS',
      details: 'System settings reset to defaults',
      userId,
      username: auth.user.username,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      resourceType: 'Settings',
      resourceId: settings._id.toString()
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
