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
import AuditLog from '@/models/AuditLog';
import PendingNotification from '@/models/PendingNotification';

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
      auditLogs,
      pendingNotifications,
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
      AuditLog.find({}).lean(),
      PendingNotification.find({}).lean(),
    ]);

    const exportedAt = new Date();
    const fileSafeTimestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
    const filename = `4minitz-backup-${fileSafeTimestamp}.json`;

    const payload = {
      metadata: {
        app: '4minitz-2.0',
        exportedAt: exportedAt.toISOString(),
        exportedBy: auth.user.username,
        formatVersion: 1,
      },
      data: {
        settings,
        users,
        meetingSeries,
        minutes,
        tasks,
        attachments,
        labels,
        pdfSettings,
        pdfLayoutSettings,
        auditLogs,
        pendingNotifications,
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
          auditLogs: auditLogs.length,
          pendingNotifications: pendingNotifications.length,
        },
      },
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

