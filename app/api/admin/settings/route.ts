import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings, { ISettings } from '@/models/Settings';
import { verifyToken } from '@/lib/auth';
import { logAction } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin-Berechtigung erforderlich' },
        { status: 403 }
      );
    }

    const settings = (await Settings.findOne({}).sort({ version: -1 }).lean()) as ISettings | null;

    if (!settings) {
      return NextResponse.json({
        success: true,
        data: {
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
            allowSelfRegistration: true,
            defaultRole: 'user',
            maxMembersPerMeeting: 50,
            enableGuestAccess: false,
            guestLinkExpiryDays: 7
          },
          languageSettings: {
            defaultLanguage: 'de',
            availableLanguages: ['de', 'en'],
            enforceLanguage: false,
            enableRTL: false
          },
          notificationSettings: {
            enableEmailNotifications: true,
            enablePushNotifications: true,
            sendMeetingReminders: true,
            reminderHoursBefore: 24,
            enableDigestEmails: false,
            digestFrequency: 'weekly'
          },
          systemSettings: {
            organizationName: '4Minitz',
            organizationLogo: null,
            timezone: 'Europe/Berlin',
            dateFormat: 'DD.MM.YYYY',
            timeFormat: '24h',
            enableAuditLog: true,
            sessionTimeout: 480,
            maxFileUploadSize: 10,
            allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
            baseUrl: 'http://localhost:3000'
          },
          smtpSettings: {
            host: 'localhost',
            port: 587,
            secure: false,
            auth: {
              user: '',
              pass: ''
            },
            from: 'noreply@4minitz.local'
          }
        }
      });
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

    return NextResponse.json({
      success: true,
      data: settings
    });

  } catch (error: any) {
    console.error('Error fetching admin settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin-Berechtigung erforderlich' },
        { status: 403 }
      );
    }

    const userId = authResult.user._id.toString();

    const body = await request.json();
    let settings = await Settings.findOne({}).sort({ version: -1 });

    if (!settings) {
      settings = new Settings({
        ...body,
        version: 1,
        lastModified: new Date(),
        modifiedBy: userId
      });
    } else {
      Object.assign(settings, body);
      settings.version += 1;
      settings.lastModified = new Date();
      settings.modifiedBy = userId;
    }

    await settings.save();

    // Audit Log
    await logAction({
      action: 'UPDATE_SETTINGS',
      details: 'System settings updated',
      userId: userId,
      username: authResult.user.username,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      resourceType: 'Settings',
      resourceId: settings._id.toString()
    });

    return NextResponse.json({
      success: true,
      data: settings
    });

  } catch (error: any) {
    console.error('Error updating admin settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
