import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings, { ISettings } from '@/models/Settings';
import { verifyToken } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { DEFAULT_BRAND_COLORS, sanitizeBrandColors } from '@/lib/brand-colors';
import { stripTrailingSlashes } from '@/lib/strip-trailing-slashes';

function normalizeUrlCandidate(value: string): string {
  const s = String(value || '').trim();
  return stripTrailingSlashes(s.length > 4096 ? s.slice(0, 4096) : s);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalhostLike(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function resolveDefaultBaseUrl(): string {
  const candidates = [
    String(process.env.APP_URL || ''),
    String(process.env.NEXT_PUBLIC_APP_URL || ''),
    'http://localhost:3000',
  ];

  for (const raw of candidates) {
    const candidate = normalizeUrlCandidate(raw);
    if (!candidate || !isHttpUrl(candidate) || isLocalhostLike(candidate)) continue;
    return candidate;
  }

  for (const raw of candidates) {
    const candidate = normalizeUrlCandidate(raw);
    if (!candidate || !isHttpUrl(candidate)) continue;
    return candidate;
  }

  return 'http://localhost:3000';
}

/** Default settings used when no DB record exists and for reset-to-defaults */
const DEFAULT_SETTINGS = {
  roles: {
    admin: {
      canCreateMeetings: true,
      canModerateAllMeetings: true,
      canViewAllMeetings: true,
      canViewAllMinutes: true,
      canViewAllDocuments: true,
      canUploadDocuments: true,
      canDeleteAllDocuments: true,
      canEditAllMinutes: true,
      canDeleteMinutes: true,
      canManageUsers: true,
      canAssignModerators: true,
      canExportData: true,
      canAccessReports: true,
      canManageGlobalTemplates: true,
      canManageSeriesTemplates: true,
      canUseTemplates: true
    },
    moderator: {
      canCreateMeetings: true,
      canModerateAllMeetings: false,
      canViewAllMeetings: true,
      canViewAllMinutes: false,
      canViewAllDocuments: false,
      canUploadDocuments: true,
      canDeleteAllDocuments: false,
      canEditAllMinutes: false,
      canDeleteMinutes: false,
      canManageUsers: false,
      canAssignModerators: false,
      canExportData: true,
      canAccessReports: false,
      canManageGlobalTemplates: false,
      canManageSeriesTemplates: true,
      canUseTemplates: true
    },
    user: {
      canCreateMeetings: false,
      canModerateAllMeetings: false,
      canViewAllMeetings: false,
      canViewAllMinutes: false,
      canViewAllDocuments: false,
      canUploadDocuments: true,
      canDeleteAllDocuments: false,
      canEditAllMinutes: false,
      canDeleteMinutes: false,
      canManageUsers: false,
      canAssignModerators: false,
      canExportData: false,
      canAccessReports: false,
      canManageGlobalTemplates: false,
      canManageSeriesTemplates: false,
      canUseTemplates: false
    }
  },
  memberSettings: {
    requireEmailVerification: true,
    allowSelfRegistration: false,
    agendaItemLabelMode: 'topic-alpha',
  },
  notificationSettings: {
    enableEmailNotifications: true,
    enableDigestEmails: false,
    digestFrequency: 'weekly'
  },
  systemSettings: {
    organizationName: 'NXTMinutes',
    organizationLogo: null,
    brandColors: DEFAULT_BRAND_COLORS,
    timezone: 'Europe/Berlin',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    enableAuditLog: true,
    autoLogout: { enabled: true, minutes: 480 },
    maxFileUploadSize: 10,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
    baseUrl: resolveDefaultBaseUrl()
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
          if ((settings.roles[role] as any).canViewAllDocuments === undefined) {
            (settings.roles[role] as any).canViewAllDocuments = role === 'admin';
          }
          if ((settings.roles[role] as any).canUploadDocuments === undefined) {
            (settings.roles[role] as any).canUploadDocuments = true;
          }
          if ((settings.roles[role] as any).canDeleteAllDocuments === undefined) {
            (settings.roles[role] as any).canDeleteAllDocuments = role === 'admin';
          }
          if ((settings.roles[role] as any).canManageGlobalTemplates === undefined) {
            (settings.roles[role] as any).canManageGlobalTemplates = role === 'admin';
          }
          if ((settings.roles[role] as any).canManageSeriesTemplates === undefined) {
            (settings.roles[role] as any).canManageSeriesTemplates = role !== 'user';
          }
          if ((settings.roles[role] as any).canUseTemplates === undefined) {
            (settings.roles[role] as any).canUseTemplates = role !== 'user';
          }
        }
      });
    }

    if (settings.memberSettings && settings.memberSettings.agendaItemLabelMode === undefined) {
      settings.memberSettings.agendaItemLabelMode = 'topic-alpha';
    }

    if (!settings.systemSettings) {
      (settings as any).systemSettings = { ...DEFAULT_SETTINGS.systemSettings };
    }
    (settings.systemSettings as any).brandColors = sanitizeBrandColors(
      (settings.systemSettings as any).brandColors
    );

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

    if (setData.systemSettings && typeof setData.systemSettings === 'object') {
      const incomingSystem = setData.systemSettings as Record<string, unknown>;
      const normalizedBaseUrl =
        typeof incomingSystem.baseUrl === 'string'
          ? normalizeUrlCandidate(incomingSystem.baseUrl)
          : incomingSystem.baseUrl;
      setData.systemSettings = {
        ...incomingSystem,
        baseUrl: normalizedBaseUrl,
        brandColors: sanitizeBrandColors(incomingSystem.brandColors),
      };
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
