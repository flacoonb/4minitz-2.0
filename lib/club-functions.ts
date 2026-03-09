import mongoose from 'mongoose';
import ClubFunction, { IClubFunction } from '@/models/ClubFunction';

export const CLUB_FUNCTION_PREFIX = 'function:';

export interface ResponsibleSnapshot {
  value: string;
  label: string;
  functionId?: string;
  isActive?: boolean;
  assignedUserId?: string;
  assignedUserLabel?: string;
}


export function normalizeFunctionName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function slugifyFunctionName(value: string): string {
  const normalized = normalizeFunctionName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 140);
}

export function createFunctionToken(slug: string): string {
  return `${CLUB_FUNCTION_PREFIX}${slug}`;
}

export function parseFunctionToken(value: string): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith(CLUB_FUNCTION_PREFIX)) return null;
  const slug = value.slice(CLUB_FUNCTION_PREFIX.length).trim().toLowerCase();
  return slug || null;
}

export function humanizeFunctionToken(value: string): string {
  const slug = parseFunctionToken(value);
  if (!slug) return value;
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function sanitizeResponsibles(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export function extractResponsibleValuesFromTopics(topics: any[]): string[] {
  const values = new Set<string>();
  for (const topic of topics || []) {
    for (const responsible of sanitizeResponsibles(topic?.responsibles)) {
      values.add(responsible);
    }
    const items = Array.isArray(topic?.infoItems) ? topic.infoItems : [];
    for (const item of items) {
      for (const responsible of sanitizeResponsibles(item?.responsibles)) {
        values.add(responsible);
      }
    }
  }
  return Array.from(values);
}

export async function getClubFunctionsBySlug(slugs: string[]): Promise<Map<string, IClubFunction>> {
  const unique = Array.from(
    new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))
  );
  if (unique.length === 0) return new Map();

  const docs = await ClubFunction.find({ slug: { $in: unique } }).lean();
  const map = new Map<string, IClubFunction>();
  for (const doc of docs) {
    map.set(doc.slug, doc as unknown as IClubFunction);
  }
  return map;
}

export async function validateFunctionResponsibles(
  responsibles: string[],
  options?: { allowInactiveIds?: string[] }
): Promise<{ valid: boolean; error?: string }> {
  const slugs = responsibles.map((value) => parseFunctionToken(value)).filter(Boolean) as string[];
  if (slugs.length === 0) return { valid: true };

  const functionsBySlug = await getClubFunctionsBySlug(slugs);
  const allowInactiveIds = new Set((options?.allowInactiveIds || []).map(String));

  for (const slug of slugs) {
    const fn = functionsBySlug.get(slug);
    if (!fn) {
      return { valid: false, error: `Unbekannte Vereinsfunktion: ${slug}` };
    }
    const fnId = (fn as any)._id ? String((fn as any)._id) : '';
    if (!fn.isActive && !allowInactiveIds.has(fnId)) {
      return { valid: false, error: `Inaktive Vereinsfunktion kann nicht neu gesetzt werden: ${fn.name}` };
    }
  }

  return { valid: true };
}

export async function buildResponsibleSnapshots(
  responsibles: string[],
  users?: Array<{ _id?: string; firstName?: string; lastName?: string; username?: string }>
): Promise<ResponsibleSnapshot[]> {
  const slugs = responsibles.map((value) => parseFunctionToken(value)).filter(Boolean) as string[];
  const functionsBySlug = await getClubFunctionsBySlug(slugs);
  const userMap = new Map<string, string>();
  (users || []).forEach((user) => {
    const id = String(user?._id || '').trim();
    if (!id) return;
    const fullName = `${String(user?.firstName || '').trim()} ${String(user?.lastName || '').trim()}`.trim();
    const label = fullName || String(user?.username || '').trim() || id;
    userMap.set(id, label);
  });

  return responsibles.map((value) => {
    const slug = parseFunctionToken(value);
    if (!slug) {
      return { value, label: value };
    }
    const fn = functionsBySlug.get(slug);
    if (!fn) {
      return { value, label: humanizeFunctionToken(value), isActive: false };
    }
    const assignedUserId = (fn as any).assignedUserId ? String((fn as any).assignedUserId) : undefined;
    const assignedUserLabel = assignedUserId ? userMap.get(assignedUserId) || assignedUserId : undefined;
    return {
      value,
      label: fn.name,
      functionId: String((fn as any)._id),
      isActive: fn.isActive,
      assignedUserId,
      assignedUserLabel,
    };
  });
}

export async function applyResponsibleSnapshotsToTopics(
  topics: any[],
  users?: Array<{ _id?: string; firstName?: string; lastName?: string; username?: string }>
): Promise<any[]> {
  const normalizedTopics = Array.isArray(topics) ? topics : [];
  const result: any[] = [];

  for (const topic of normalizedTopics) {
    const topicResponsibles = sanitizeResponsibles(topic?.responsibles);
    const topicSnapshots = await buildResponsibleSnapshots(topicResponsibles, users);
    const infoItems = Array.isArray(topic?.infoItems) ? topic.infoItems : [];

    const updatedItems = [];
    for (const item of infoItems) {
      const itemResponsibles = sanitizeResponsibles(item?.responsibles);
      const itemSnapshots = await buildResponsibleSnapshots(itemResponsibles, users);
      updatedItems.push({
        ...item,
        responsibles: itemResponsibles,
        responsibleSnapshots: itemSnapshots,
      });
    }

    result.push({
      ...topic,
      responsibles: topicResponsibles,
      responsibleSnapshots: topicSnapshots,
      infoItems: updatedItems,
    });
  }

  return result;
}

export function buildFunctionAssignmentMap(
  functions: Array<{ slug?: string; assignedUserId?: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const fn of functions || []) {
    const slug = String(fn?.slug || '').trim();
    const userId = String(fn?.assignedUserId || '').trim();
    if (!slug || !userId) continue;
    map.set(createFunctionToken(slug), userId);
  }
  return map;
}

export function validateAssignmentsForResponsibles(
  responsibles: string[],
  assignmentMap: Map<string, string>
): { valid: boolean; error?: string } {
  for (const value of responsibles) {
    if (!parseFunctionToken(value)) continue;
    if (!assignmentMap.has(value)) {
      return {
        valid: false,
        error: `Der Vereinsfunktion ${humanizeFunctionToken(value)} ist keine Person zugeordnet.`,
      };
    }
  }
  return { valid: true };
}

export function resolveResponsiblesForTasks(
  responsibles: string[],
  assignmentMap: Map<string, string>
): string[] {
  const resolved = responsibles.map((value) => assignmentMap.get(value) || value).filter(Boolean);
  return Array.from(new Set(resolved));
}

export function isValidObjectId(value: unknown): boolean {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}
