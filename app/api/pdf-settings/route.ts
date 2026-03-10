import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { getActivePdfTemplate } from '@/lib/pdf-template-store';
import { sanitizePdfContentSettings } from '@/lib/pdf-template-defaults';

function canManageTemplates(role: string | undefined): boolean {
  return role === 'admin' || role === 'moderator';
}

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
    const activeTemplate = await getActivePdfTemplate();
    const settings = sanitizePdfContentSettings(activeTemplate.contentSettings);
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

    if (!canManageTemplates(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await request.json();

    // Strip dead fields that may still exist in client data
    delete body.includeTableOfContents;
    delete body.includeParticipants;
    delete body.dateFormat;

    const activeTemplate = await getActivePdfTemplate();
    const mergedSettings = {
      ...(activeTemplate.contentSettings || {}),
      ...body,
    };
    activeTemplate.contentSettings = sanitizePdfContentSettings(mergedSettings);
    await activeTemplate.save();

    return NextResponse.json({ success: true, data: activeTemplate.contentSettings });
  } catch (error) {
    console.error('Error updating PDF settings:', error);
    return NextResponse.json(
      { success: false, error: 'Fehler beim Speichern der Einstellungen' },
      { status: 500 }
    );
  }
}
