import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { verifyToken } from '@/lib/auth';
import { safePath } from '@/lib/file-security';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { filename } = await params;

    // Try to find the file in the new location first
    const primaryDir = path.join(process.cwd(), 'uploads', 'logos');
    const fallbackDir = path.join(process.cwd(), 'public', 'uploads', 'logos');

    let filePath = safePath(primaryDir, filename);
    if (!filePath || !existsSync(filePath)) {
      // Fallback to the old location (public/uploads/logos)
      filePath = safePath(fallbackDir, filename);
    }

    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving logo:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
