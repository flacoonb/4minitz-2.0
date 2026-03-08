import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import connectDB from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';
import { safePath } from '@/lib/file-security';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * GET /api/attachments/[id]/download
 * Download attachment file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const { id } = await params;
    const attachment = await Attachment.findById(id);
    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Verify user has access to the minute's meeting series
    const minute = await Minutes.findById(attachment.minuteId).populate('meetingSeries_id');
    if (!minute) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const username = authResult.user.username;
    const series = minute.meetingSeries_id as any;
    const hasAccess = series?.visibleFor?.includes(username) ||
                      series?.moderators?.includes(username) ||
                      series?.participants?.includes(username) ||
                      authResult.user.role === 'admin';

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Path traversal protection
    const filePath = safePath(UPLOAD_DIR, attachment.fileName);
    if (!filePath) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
        'Content-Length': attachment.size.toString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to download attachment' },
      { status: 500 }
    );
  }
}
