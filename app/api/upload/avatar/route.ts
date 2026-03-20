import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { verifyToken } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { isAllowedImageSignature, safePath } from '@/lib/file-security';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    await connectDB();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Nur Bilddateien (JPG, PNG, GIF, WebP) sind erlaubt' }, { status: 400 });
    }

    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    const maxFileSizeMB = settings?.systemSettings?.maxFileUploadSize || 10;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json(
        { error: `Datei ist zu groß. Maximale Größe ist ${maxFileSizeMB} MB.` },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: 'Dateiendung nicht erlaubt' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isAllowedImageSignature(buffer)) {
      return NextResponse.json({ error: 'Dateiinhalt entspricht keinem erlaubten Bildformat' }, { status: 400 });
    }

    const filename = `avatar-${authResult.user._id}-${Date.now()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });

    const filePath = safePath(uploadDir, filename);
    if (!filePath) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      url: `/api/uploads/avatars/${filename}`,
    });
  } catch {
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 });
  }
}
