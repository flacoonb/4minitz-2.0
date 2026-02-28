import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import connectDB from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import Minutes from '@/models/Minutes';
import Settings from '@/models/Settings';
import { verifyToken } from '@/lib/auth';
import { safePath } from '@/lib/file-security';

// Default Maximum file size: 10MB
// const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// Default Allowed file types
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

// Upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * GET /api/attachments
 * List attachments for a minute
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const minuteId = searchParams.get('minuteId');

    if (!minuteId) {
      return NextResponse.json(
        { error: 'minuteId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify user has access to the minute's meeting series
    const minute = await Minutes.findById(minuteId).populate('meetingSeries_id');
    if (!minute) {
      return NextResponse.json({ error: 'Minute not found' }, { status: 404 });
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

    const attachments = await Attachment.find({ minuteId })
      .sort({ uploadedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      count: attachments.length,
      data: attachments,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attachments
 * Upload attachment
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const minuteId = formData.get('minuteId') as string | null;
    const topicId = formData.get('topicId') as string | null;
    const infoItemId = formData.get('infoItemId') as string | null;

    if (!file || !minuteId) {
      return NextResponse.json(
        { error: 'file and minuteId are required' },
        { status: 400 }
      );
    }

    // Get settings
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    
    // Determine max file size
    const maxFileSizeMB = settings?.systemSettings?.maxFileUploadSize || 10;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

    // Validate file size
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${maxFileSizeMB}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    // Note: allowedFileTypes in settings is usually extensions (e.g. .pdf, .jpg), 
    // but here we check MIME types. For now, we stick to the hardcoded MIME check 
    // or we could map extensions to MIME types if needed.
    // If settings has allowedFileTypes, we should try to respect it.
    
    if (settings?.systemSettings?.allowedFileTypes && settings.systemSettings.allowedFileTypes.length > 0) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = settings.systemSettings.allowedFileTypes.map((t: string) => t.toLowerCase().replace('.', ''));
      
      if (extension && !allowedExtensions.includes(extension)) {
         return NextResponse.json(
          { error: `Dateityp .${extension} ist nicht erlaubt.` },
          { status: 400 }
        );
      }
    } else {
      // Fallback to default MIME check if no specific extensions configured
      if (!DEFAULT_ALLOWED_MIME_TYPES.includes(file.type)) {
        // Allow if it's an image and not explicitly forbidden? 
        // For safety, stick to allowlist.
        // But let's be lenient if it's not in the default list but might be valid.
        // Actually, let's just use the default list if no settings.
         if (!DEFAULT_ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
              { error: 'File type not allowed' },
              { status: 400 }
            );
         }
      }
    }



    await connectDB();

    // Verify minute exists and user has access
    const minute = await Minutes.findById(minuteId).populate('meetingSeries_id');
    if (!minute) {
      return NextResponse.json(
        { error: 'Minute not found' },
        { status: 404 }
      );
    }

    // Check authorization
    const meetingSeries = minute.meetingSeries_id as any;
    const isModerator = meetingSeries.moderators?.includes(userId);
    const isParticipant = meetingSeries.participants?.includes(userId);
    
    if (!isModerator && !isParticipant) {
      return NextResponse.json(
        { error: 'Forbidden: You must be a moderator or participant' },
        { status: 403 }
      );
    }

    // Create upload directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename (strip dots except for extension to prevent traversal)
    const timestamp = Date.now();
    const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '');
    const baseName = path.basename(file.name, path.extname(file.name)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${timestamp}-${baseName}${ext}`;

    // Path traversal protection
    const filePath = safePath(UPLOAD_DIR, fileName);
    if (!filePath) {
      return NextResponse.json(
        { error: 'Invalid file name' },
        { status: 400 }
      );
    }

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save metadata to database
    const attachment = await Attachment.create({
      fileName,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedBy: userId,
      minuteId,
      topicId: topicId || undefined,
      infoItemId: infoItemId || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: attachment,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attachments
 * Delete attachment
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user.username;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const attachment = await Attachment.findById(id);
    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Verify user has permission to delete
    const minute = await Minutes.findById(attachment.minuteId).populate('meetingSeries_id');
    if (!minute) {
      return NextResponse.json(
        { error: 'Associated minute not found' },
        { status: 404 }
      );
    }

    const meetingSeries = minute.meetingSeries_id as any;
    const isModerator = meetingSeries.moderators?.includes(userId);
    const isUploader = attachment.uploadedBy === userId;

    if (!isModerator && !isUploader) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own attachments or must be a moderator' },
        { status: 403 }
      );
    }

    // Delete file from disk (with path traversal protection)
    const filePath = safePath(UPLOAD_DIR, attachment.fileName);
    if (filePath) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(filePath);
      } catch {
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await Attachment.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Attachment deleted successfully',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
