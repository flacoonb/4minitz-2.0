import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import Settings from '@/models/Settings';
import User from '@/models/User';
import MeetingSeries from '@/models/MeetingSeries';
import Minutes from '@/models/Minutes';
import Task from '@/models/Task';
import Attachment from '@/models/Attachment';
import Label from '@/models/Label';
import PdfSettings from '@/models/PdfSettings';
import PdfLayoutSettings from '@/models/PdfLayoutSettings';
import PdfTemplate from '@/models/PdfTemplate';
import AuditLog from '@/models/AuditLog';
import PendingNotification from '@/models/PendingNotification';
import PushSubscription from '@/models/PushSubscription';

function sanitizeUsers(users: any[], includeSensitive: boolean) {
  if (includeSensitive) return users;
  return users.map((user) => {
    const {
      password,
      passwordResetTokenHash,
      passwordResetExpires,
      emailVerificationToken,
      emailVerificationExpires,
      ...safeUser
    } = user;
    void password;
    void passwordResetTokenHash;
    void passwordResetExpires;
    void emailVerificationToken;
    void emailVerificationExpires;
    return safeUser;
  });
}

function sanitizeSettings(settings: any[], includeSensitive: boolean) {
  if (includeSensitive) return settings;
  return settings.map((entry) => {
    if (!entry?.smtpSettings?.auth?.pass) return entry;
    return {
      ...entry,
      smtpSettings: {
        ...entry.smtpSettings,
        auth: {
          ...entry.smtpSettings.auth,
          pass: '__REDACTED__',
        },
      },
    };
  });
}

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
    const { searchParams } = new URL(request.url);
    const includeSensitive = searchParams.get('includeSensitive') === 'true';

    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const [
      settings,
      users,
      meetingSeries,
      minutes,
      tasks,
      attachments,
      labels,
      pdfSettings,
      pdfLayoutSettings,
      pdfTemplates,
      auditLogs,
      pendingNotifications,
      pushSubscriptions,
    ] = await Promise.all([
      Settings.find({}).lean(),
      User.find({}).lean(),
      MeetingSeries.find({}).lean(),
      Minutes.find({}).lean(),
      Task.find({}).lean(),
      Attachment.find({}).lean(),
      Label.find({}).lean(),
      PdfSettings.find({}).lean(),
      PdfLayoutSettings.find({}).lean(),
      PdfTemplate.find({}).lean(),
      AuditLog.find({}).lean(),
      PendingNotification.find({}).lean(),
      PushSubscription.find({}).lean(),
    ]);

    const exportedAt = new Date();
    const fileSafeTimestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
    const filename = `nxtminutes-backup-${fileSafeTimestamp}.json`;

    const safeSettings = sanitizeSettings(settings, includeSensitive);
    const safeUsers = sanitizeUsers(users, includeSensitive);

    const payload = {
      metadata: {
        app: 'nxtminutes',
        exportedAt: exportedAt.toISOString(),
        exportedBy: auth.user.username,
        formatVersion: 1,
        sensitiveDataIncluded: includeSensitive,
      },
      data: {
        settings: safeSettings,
        users: safeUsers,
        meetingSeries,
        minutes,
        tasks,
        attachments,
        labels,
        pdfSettings,
        pdfLayoutSettings,
        pdfTemplates,
        auditLogs,
        pendingNotifications,
        pushSubscriptions,
      },
    };

    await logAction({
      action: 'EXPORT_DB_BACKUP',
      details: 'Database backup exported',
      userId: auth.user._id.toString(),
      username: auth.user.username,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      resourceType: 'System',
      resourceId: 'backup',
      metadata: {
        filename,
        counts: {
          settings: settings.length,
          users: users.length,
          meetingSeries: meetingSeries.length,
          minutes: minutes.length,
          tasks: tasks.length,
          attachments: attachments.length,
          labels: labels.length,
          pdfSettings: pdfSettings.length,
          pdfLayoutSettings: pdfLayoutSettings.length,
          pdfTemplates: pdfTemplates.length,
          auditLogs: auditLogs.length,
          pendingNotifications: pendingNotifications.length,
          pushSubscriptions: pushSubscriptions.length,
        },
      },
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Backup-Sensitive': includeSensitive ? 'true' : 'false',
      },
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
