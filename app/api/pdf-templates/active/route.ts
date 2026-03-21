import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { activatePdfTemplate, ensurePdfTemplatesInitialized, getActivePdfTemplate } from '@/lib/pdf-template-store';
import { serializePdfTemplateForApi } from '@/lib/pdf-template-serialize';

function canManageTemplates(role: string | undefined): boolean {
  return role === 'admin' || role === 'moderator';
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    await ensurePdfTemplatesInitialized();
    const activeTemplate = await getActivePdfTemplate();
    return NextResponse.json({ success: true, data: serializePdfTemplateForApi(activeTemplate) });
  } catch (error) {
    console.error('Error fetching active PDF template:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch active template' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    if (!canManageTemplates(authResult.user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    await connectDB();
    await ensurePdfTemplatesInitialized();
    const body = await request.json();
    const templateId = typeof body?.templateId === 'string' ? body.templateId : '';
    if (!templateId) {
      return NextResponse.json({ success: false, error: 'templateId is required' }, { status: 400 });
    }

    const activeTemplate = await activatePdfTemplate(templateId);
    if (!activeTemplate) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: serializePdfTemplateForApi(activeTemplate) });
  } catch (error) {
    console.error('Error setting active PDF template:', error);
    return NextResponse.json({ success: false, error: 'Failed to set active template' }, { status: 500 });
  }
}
