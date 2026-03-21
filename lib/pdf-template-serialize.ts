import { sanitizePdfContentSettings, sanitizePdfLayoutSettings } from '@/lib/pdf-template-defaults';

/**
 * PDF template API responses: explicit allowlist only (no `...mongooseDoc` spread).
 */
export function serializePdfTemplateForApi(template: unknown): Record<string, unknown> | null {
  if (!template) return null;

  const source =
    typeof template === 'object' &&
    template !== null &&
    'toObject' in template &&
    typeof (template as { toObject: () => unknown }).toObject === 'function'
      ? (template as { toObject: () => Record<string, unknown> }).toObject()
      : (template as Record<string, unknown>);

  if (!source || typeof source !== 'object') return null;

  const id = source._id;
  const out: Record<string, unknown> = {
    _id: id != null ? String(id) : '',
    name: typeof source.name === 'string' ? source.name : '',
    description: typeof source.description === 'string' ? source.description : '',
    isActive: Boolean(source.isActive),
    contentSettings: sanitizePdfContentSettings(source.contentSettings),
    layoutSettings: sanitizePdfLayoutSettings(source.layoutSettings),
  };

  if (source.createdAt != null) out.createdAt = source.createdAt;
  if (source.updatedAt != null) out.updatedAt = source.updatedAt;

  return out;
}
