import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { getActivePdfTemplate } from '@/lib/pdf-template-store';
import { createDefaultPdfLayoutSettings, sanitizePdfLayoutSettings } from '@/lib/pdf-template-defaults';

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
    const settings = sanitizePdfLayoutSettings(activeTemplate.layoutSettings);
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching PDF layout settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch PDF layout settings' },
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
    const activeTemplate = await getActivePdfTemplate();
    const mergedSettings = {
      ...(activeTemplate.layoutSettings || {}),
      ...(body && typeof body === 'object' ? body : {}),
    };

    activeTemplate.layoutSettings = sanitizePdfLayoutSettings(mergedSettings);
    await activeTemplate.save();

    return NextResponse.json({ success: true, data: activeTemplate.layoutSettings });
  } catch (error) {
    console.error('Error updating PDF layout settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update PDF layout settings' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin permissions required' },
        { status: 403 }
      );
    }

    await dbConnect();
    const activeTemplate = await getActivePdfTemplate();
    activeTemplate.layoutSettings = createDefaultPdfLayoutSettings();
    await activeTemplate.save();

    return NextResponse.json({
      success: true,
      message: 'PDF layout settings reset to defaults',
      data: activeTemplate.layoutSettings,
    });
  } catch (error) {
    console.error('Error resetting PDF layout settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset PDF layout settings' },
      { status: 500 }
    );
  }
}
