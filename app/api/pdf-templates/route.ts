import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import PdfTemplate from '@/models/PdfTemplate';
import {
  clonePdfTemplateData,
  ensurePdfTemplatesInitialized,
  getActivePdfTemplate,
  normalizePdfTemplateName,
} from '@/lib/pdf-template-store';
import { ensureObjectIdString, sanitizePdfContentSettings, sanitizePdfLayoutSettings } from '@/lib/pdf-template-defaults';

function canManageTemplates(role: string | undefined): boolean {
  return role === 'admin' || role === 'moderator';
}

function serializeTemplate(template: any) {
  const source = template && typeof template.toObject === 'function' ? template.toObject() : template;
  if (!source) return null;
  return {
    ...source,
    _id: source._id ? String(source._id) : source._id,
    contentSettings: sanitizePdfContentSettings(source.contentSettings),
    layoutSettings: sanitizePdfLayoutSettings(source.layoutSettings),
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    await ensurePdfTemplatesInitialized();

    const templatesRaw = await PdfTemplate.find({}).sort({ updatedAt: -1 }).lean();
    const templates = templatesRaw
      .map((template) => serializeTemplate(template))
      .filter((template): template is NonNullable<ReturnType<typeof serializeTemplate>> => Boolean(template));
    const activeTemplate = templates.find((template) => template.isActive) || templates[0] || null;

    return NextResponse.json({
      success: true,
      data: templates,
      activeTemplateId: activeTemplate?._id ? String(activeTemplate._id) : null,
    });
  } catch (error) {
    console.error('Error fetching PDF templates:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch PDF templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const sourceTemplateId = ensureObjectIdString(body?.sourceTemplateId);
    const makeActive = body?.makeActive === true;
    const name = normalizePdfTemplateName(body?.name);
    const description = typeof body?.description === 'string' ? body.description.trim() : '';

    let sourceTemplate: any = null;
    if (sourceTemplateId) {
      sourceTemplate = await PdfTemplate.findById(sourceTemplateId).lean();
    }
    if (!sourceTemplate) {
      sourceTemplate = await getActivePdfTemplate();
    }

    const fallbackData = await clonePdfTemplateData(sourceTemplate || undefined);
    const contentSettings =
      body?.contentSettings !== undefined
        ? sanitizePdfContentSettings(body.contentSettings)
        : fallbackData.contentSettings;
    const layoutSettings =
      body?.layoutSettings !== undefined
        ? sanitizePdfLayoutSettings(body.layoutSettings)
        : fallbackData.layoutSettings;

    const createdTemplate = await PdfTemplate.create({
      name,
      description,
      isActive: false,
      contentSettings,
      layoutSettings,
    });

    if (makeActive) {
      await PdfTemplate.updateMany({}, { $set: { isActive: false } });
      createdTemplate.isActive = true;
      await createdTemplate.save();
    }

    return NextResponse.json({ success: true, data: serializeTemplate(createdTemplate) }, { status: 201 });
  } catch (error) {
    console.error('Error creating PDF template:', error);
    return NextResponse.json({ success: false, error: 'Failed to create PDF template' }, { status: 500 });
  }
}
