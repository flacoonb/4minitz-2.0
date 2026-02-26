import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import PdfSettings from '@/models/PdfSettings';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    let settings = await PdfSettings.findOne({ isActive: true });

    // Create default settings if none exist
    if (!settings) {
      settings = await PdfSettings.create({
        companyName: '4Minitz 2.0',
        headerText: 'Meeting Protokoll',
        footerText: 'Vertraulich',
        isActive: true
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching PDF settings:', error);
    return NextResponse.json(
      { success: false, error: 'Fehler beim Laden der Einstellungen' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!['admin', 'moderator'].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await request.json();

    // Find active settings or create new
    let settings = await PdfSettings.findOne({ isActive: true });

    if (settings) {
      // Update existing
      Object.assign(settings, body);
      await settings.save();
    } else {
      // Create new
      settings = await PdfSettings.create({ ...body, isActive: true });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating PDF settings:', error);
    return NextResponse.json(
      { success: false, error: 'Fehler beim Speichern der Einstellungen' },
      { status: 500 }
    );
  }
}
