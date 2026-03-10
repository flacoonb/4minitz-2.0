import PdfSettings from '@/models/PdfSettings';
import PdfLayoutSettings from '@/models/PdfLayoutSettings';
import PdfTemplate from '@/models/PdfTemplate';
import {
  createDefaultPdfContentSettings,
  createDefaultPdfLayoutSettings,
  normalizeTemplateName,
  sanitizePdfContentSettings,
  sanitizePdfLayoutSettings,
} from '@/lib/pdf-template-defaults';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function createTemplateFromLegacySettings() {
  const [legacyContent, legacyLayout] = await Promise.all([
    PdfSettings.findOne({ isActive: true }).lean(),
    PdfLayoutSettings.findOne().sort({ updatedAt: -1 }).lean(),
  ]);

  const contentSettings = sanitizePdfContentSettings(legacyContent || createDefaultPdfContentSettings());
  const layoutSettings = sanitizePdfLayoutSettings(legacyLayout || createDefaultPdfLayoutSettings());

  return PdfTemplate.create({
    name: 'Standard',
    description: 'Automatisch aus bestehender PDF-Konfiguration erstellt',
    isActive: true,
    contentSettings,
    layoutSettings,
  });
}

export async function ensurePdfTemplatesInitialized() {
  const templateCount = await PdfTemplate.countDocuments();
  if (templateCount > 0) return;
  await createTemplateFromLegacySettings();
}

export async function getActivePdfTemplate() {
  await ensurePdfTemplatesInitialized();
  let activeTemplate = await PdfTemplate.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!activeTemplate) {
    const mostRecentTemplate = await PdfTemplate.findOne().sort({ updatedAt: -1 });
    if (!mostRecentTemplate) {
      return createTemplateFromLegacySettings();
    }
    await PdfTemplate.updateMany({}, { $set: { isActive: false } });
    mostRecentTemplate.isActive = true;
    await mostRecentTemplate.save();
    activeTemplate = mostRecentTemplate;
  }
  return activeTemplate;
}

export async function activatePdfTemplate(templateId: string) {
  await ensurePdfTemplatesInitialized();
  const template = await PdfTemplate.findById(templateId);
  if (!template) return null;
  await PdfTemplate.updateMany({}, { $set: { isActive: false } });
  template.isActive = true;
  await template.save();
  return template;
}

export async function clonePdfTemplateData(sourceTemplate?: {
  contentSettings?: unknown;
  layoutSettings?: unknown;
}) {
  return {
    contentSettings: sanitizePdfContentSettings(deepClone(sourceTemplate?.contentSettings || createDefaultPdfContentSettings())),
    layoutSettings: sanitizePdfLayoutSettings(deepClone(sourceTemplate?.layoutSettings || createDefaultPdfLayoutSettings())),
  };
}

export function normalizePdfTemplateName(name: unknown, fallback?: string) {
  return normalizeTemplateName(name, fallback || 'Neue PDF-Vorlage');
}
