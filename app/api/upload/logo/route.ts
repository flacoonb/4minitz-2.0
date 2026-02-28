import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { verifyToken } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { safePath } from '@/lib/file-security';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    await connectDB();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    // Get settings for validation
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    
    // Validate file size
    const maxFileSizeMB = settings?.systemSettings?.maxFileUploadSize || 10; // Default 10MB
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json({ 
        error: `Datei ist zu groß. Maximale Größe ist ${maxFileSizeMB} MB.` 
      }, { status: 400 });
    }

    // Validate file type (raster images only, no SVG for XSS prevention)
    const allowedLogoTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedLogoTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Nur Bilddateien (JPG, PNG, GIF, WebP) sind erlaubt' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Sanitize filename (strip everything except alphanumeric, hyphen, single dot for extension)
    const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '');
    const filename = `logo-${Date.now()}${ext}`;

    // Ensure directory exists
    const uploadDir = path.join(process.cwd(), 'uploads', 'logos');
    await mkdir(uploadDir, { recursive: true });

    // Path traversal protection
    const filePath = safePath(uploadDir, filename);
    if (!filePath) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    await writeFile(filePath, buffer);

    // Return URL to the API route that serves the file
    const fileUrl = `/api/uploads/logos/${filename}`;

    return NextResponse.json({ success: true, url: fileUrl });
  } catch {
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 });
  }
}
