import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import PdfTemplate from '@/models/PdfTemplate';
import { activatePdfTemplate, ensurePdfTemplatesInitialized, normalizePdfTemplateName } from '@/lib/pdf-template-store';
import { sanitizePdfContentSettings, sanitizePdfLayoutSettings } from '@/lib/pdf-template-defaults';
import { serializePdfTemplateForApi } from '@/lib/pdf-template-serialize';

function canManageTemplates(role: string | undefined): boolean {
  return role === 'admin' || role === 'moderator';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    await ensurePdfTemplatesInitialized();
    const { id } = await params;
    const template = await PdfTemplate.findById(id).lean();

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: serializePdfTemplateForApi(template) });
  } catch (error) {
    console.error('Error loading PDF template:', error);
    return NextResponse.json({ success: false, error: 'Failed to load PDF template' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const body = await request.json();
    const template = await PdfTemplate.findById(id);

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    if (body?.name !== undefined) {
      template.name = normalizePdfTemplateName(body.name, template.name || 'PDF-Vorlage');
    }
    if (body?.description !== undefined) {
      template.description = typeof body.description === 'string' ? body.description.trim() : '';
    }
    if (body?.contentSettings !== undefined) {
      template.contentSettings = sanitizePdfContentSettings(body.contentSettings);
    }
    if (body?.layoutSettings !== undefined) {
      template.layoutSettings = sanitizePdfLayoutSettings(body.layoutSettings);
    }

    await template.save();

    if (body?.isActive === true || body?.makeActive === true) {
      const activeTemplate = await activatePdfTemplate(String(template._id));
      return NextResponse.json({ success: true, data: serializePdfTemplateForApi(activeTemplate) });
    }

    return NextResponse.json({ success: true, data: serializePdfTemplateForApi(template) });
  } catch (error) {
    console.error('Error updating PDF template:', error);
    return NextResponse.json({ success: false, error: 'Failed to update PDF template' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const template = await PdfTemplate.findById(id);

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const totalTemplates = await PdfTemplate.countDocuments();
    if (totalTemplates <= 1) {
      return NextResponse.json(
        { success: false, error: 'At least one template must remain' },
        { status: 400 }
      );
    }

    const wasActive = template.isActive;
    await template.deleteOne();

    if (wasActive) {
      const fallbackTemplate = await PdfTemplate.findOne().sort({ updatedAt: -1 });
      if (fallbackTemplate) {
        await activatePdfTemplate(String(fallbackTemplate._id));
      }
    }

    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting PDF template:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete PDF template' }, { status: 500 });
  }
}
