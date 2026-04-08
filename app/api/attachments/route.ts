import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import connectDB from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import Minutes from '@/models/Minutes';
import MeetingSeries from '@/models/MeetingSeries';
import Settings from '@/models/Settings';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { safePath } from '@/lib/file-security';

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTag(raw: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function uniqueTags(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeTag).filter(Boolean)));
}

function formatSeriesName(series: any): string {
  const project = String(series?.project || '').trim();
  const name = String(series?.name || '').trim();
  if (project && name) return `${project} – ${name}`;
  if (project) return project;
  if (name) return name;
  return 'Protokoll';
}

function formatMinuteTag(minute: any): string {
  const title = String(minute?.title || '').trim();
  if (title) return title;

  const seriesName = formatSeriesName(minute?.meetingSeries_id);
  const date = minute?.date ? new Date(minute.date).toLocaleDateString('de-CH') : '';
  return date ? `${seriesName} ${date}` : seriesName;
}

function resolveTopicAndInfoItem(minute: any, topicId: string, infoItemId: string): {
  topic: any | null;
  infoItem: any | null;
  error?: string;
} {
  const topics = Array.isArray(minute?.topics) ? minute.topics : [];
  let topic: any | null = null;
  let infoItem: any | null = null;

  if (topicId) {
    topic = topics.find((entry: any) => String(entry?._id || '') === topicId) || null;
    if (!topic) {
      return { topic: null, infoItem: null, error: 'Invalid topicId for this minute' };
    }
  }

  if (infoItemId) {
    if (topic) {
      const infoItems = Array.isArray(topic.infoItems) ? topic.infoItems : [];
      infoItem = infoItems.find((entry: any) => String(entry?._id || '') === infoItemId) || null;
    } else {
      for (const topicEntry of topics) {
        const infoItems = Array.isArray(topicEntry?.infoItems) ? topicEntry.infoItems : [];
        const found = infoItems.find((entry: any) => String(entry?._id || '') === infoItemId);
        if (found) {
          topic = topicEntry;
          infoItem = found;
          break;
        }
      }
    }

    if (!infoItem) {
      return { topic: null, infoItem: null, error: 'Invalid infoItemId for this minute' };
    }
  }

  return { topic, infoItem };
}

function attachmentToApiShape(item: any) {
  const id = String(item?._id || '');
  return {
    ...item,
    _id: id,
    minuteId: item?.minuteId ? String(item.minuteId) : undefined,
    topicId: item?.topicId ? String(item.topicId) : undefined,
    infoItemId: item?.infoItemId ? String(item.infoItemId) : undefined,
    url: `/api/attachments/${id}/download`,
  };
}

function sanitizeAttachmentDisplayName(raw: string): string {
  const sanitized = String(raw || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized.slice(0, 180).trim();
}

function normalizeExtension(fileName: string): string {
  return path.extname(String(fileName || '')).toLowerCase();
}

async function findAccessibleMinuteIds(user: any): Promise<string[]> {
  const username = String(user?.username || '').trim();
  const userId = user?._id?.toString?.() || '';

  const modSeries = await MeetingSeries.find({
    $or: [{ moderators: username }, { moderators: userId }],
  })
    .select('_id')
    .lean();
  const modSeriesIds = modSeries.map((series) => series._id);

  const participantSeries = await MeetingSeries.find({
    $or: [
      { visibleFor: username },
      { visibleFor: userId },
      { participants: username },
      { participants: userId },
      { 'members.userId': userId },
    ],
    _id: { $nin: modSeriesIds },
  })
    .select('_id')
    .lean();
  const participantSeriesIds = participantSeries.map((series) => series._id);

  const minuteIds = await Minutes.find({
    $or: [
      { visibleFor: username },
      { visibleFor: userId },
      { participants: username },
      { participants: userId },
      { moderators: username },
      { moderators: userId },
      { meetingSeries_id: { $in: modSeriesIds } },
      { meetingSeries_id: { $in: participantSeriesIds } },
    ],
  }).distinct('_id');

  return minuteIds.map((id) => id.toString());
}

async function getMinuteAccessContext(user: any, minute: any) {
  const username = String(user?.username || '').trim();
  const userId = user?._id?.toString?.() || '';
  const series = minute?.meetingSeries_id as any;

  const canViewAllMinutes = await hasPermission(user, 'canViewAllMinutes');
  const canViewAllDocuments = await hasPermission(user, 'canViewAllDocuments');
  const canDeleteAllDocuments = await hasPermission(user, 'canDeleteAllDocuments');

  const seriesVisibleFor = Array.isArray(series?.visibleFor) ? series.visibleFor : [];
  const seriesModerators = Array.isArray(series?.moderators) ? series.moderators : [];
  const seriesParticipants = Array.isArray(series?.participants) ? series.participants : [];
  const seriesMembers = Array.isArray(series?.members) ? series.members : [];
  const minuteVisibleFor = Array.isArray(minute?.visibleFor) ? minute.visibleFor : [];
  const minuteParticipants = Array.isArray(minute?.participants) ? minute.participants : [];

  const isSeriesModerator =
    seriesModerators.includes(username) || (userId ? seriesModerators.includes(userId) : false);
  const isSeriesMember = !!userId && seriesMembers.some((member: any) => member?.userId === userId);
  const isSeriesParticipant =
    seriesVisibleFor.includes(username) ||
    seriesVisibleFor.includes(userId) ||
    seriesParticipants.includes(username) ||
    seriesParticipants.includes(userId) ||
    isSeriesMember;
  const isMinuteDirectlyVisible =
    minuteVisibleFor.includes(username) ||
    minuteVisibleFor.includes(userId) ||
    minuteParticipants.includes(username) ||
    minuteParticipants.includes(userId);

  const canAccessMinute =
    user?.role === 'admin' ||
    canViewAllDocuments ||
    canViewAllMinutes ||
    isSeriesModerator ||
    isSeriesParticipant ||
    isMinuteDirectlyVisible;

  return {
    canAccessMinute,
    canDeleteAllDocuments,
    isSeriesModerator,
  };
}

function buildSearchQuery(search: string): Record<string, unknown> {
  const normalized = String(search || '').trim();
  if (!normalized) return {};

  const regex = new RegExp(escapeRegex(normalized), 'i');
  return {
    $or: [
      { originalName: regex },
      { tags: regex },
      { minuteTitleSnapshot: regex },
      { topicSubjectSnapshot: regex },
      { infoItemSubjectSnapshot: regex },
      { meetingSeriesNameSnapshot: regex },
    ],
  };
}

/**
 * GET /api/attachments
 * - With minuteId: list documents in one protocol (optionally filtered by topicId)
 * - Without minuteId: central document list with user-scoped access filtering
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const minuteId = String(searchParams.get('minuteId') || '').trim();
    const topicId = String(searchParams.get('topicId') || '').trim();
    const infoItemId = String(searchParams.get('infoItemId') || '').trim();
    const search = String(searchParams.get('search') || '').trim();
    const limitRaw = Number(searchParams.get('limit') || '200');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

    if (minuteId && !mongoose.isValidObjectId(minuteId)) {
      return NextResponse.json({ error: 'Invalid minuteId' }, { status: 400 });
    }
    if (topicId && !mongoose.isValidObjectId(topicId)) {
      return NextResponse.json({ error: 'Invalid topicId' }, { status: 400 });
    }
    if (infoItemId && !mongoose.isValidObjectId(infoItemId)) {
      return NextResponse.json({ error: 'Invalid infoItemId' }, { status: 400 });
    }

    const canViewAllDocuments = await hasPermission(authResult.user, 'canViewAllDocuments');
    const canViewAllMinutes = await hasPermission(authResult.user, 'canViewAllMinutes');
    const searchQuery = buildSearchQuery(search);

    if (minuteId) {
      const minute = await Minutes.findById(minuteId).populate('meetingSeries_id');
      if (!minute) {
        return NextResponse.json({ error: 'Minute not found' }, { status: 404 });
      }

      const access = await getMinuteAccessContext(authResult.user, minute);
      if (!access.canAccessMinute) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const relation = resolveTopicAndInfoItem(minute, topicId, infoItemId);
      if (relation.error) {
        return NextResponse.json({ error: relation.error }, { status: 400 });
      }
      const resolvedTopicId = relation.topic ? String(relation.topic?._id || '') : topicId;

      const baseQuery: Record<string, unknown> = {
        minuteId,
        ...(resolvedTopicId ? { topicId: resolvedTopicId } : {}),
        ...(infoItemId ? { infoItemId } : {}),
        ...searchQuery,
      };
      let attachments = await Attachment.find(baseQuery).sort({ uploadedAt: -1 }).limit(limit).lean();

      // Self-healing fallback for older data where infoItem IDs changed after minute saves:
      // if no direct hit exists, try to resolve via unique item subject snapshot in the topic.
      if (attachments.length === 0 && infoItemId && relation.infoItem && relation.topic) {
        const currentItemSubject = normalizeTag(String(relation.infoItem?.subject || ''));
        const topicItems = Array.isArray(relation.topic?.infoItems) ? relation.topic.infoItems : [];
        const sameSubjectCount = topicItems.filter(
          (entry: any) => normalizeTag(String(entry?.subject || '')) === currentItemSubject
        ).length;

        if (currentItemSubject && sameSubjectCount === 1) {
          const fallbackQuery: Record<string, unknown> = {
            minuteId,
            ...(resolvedTopicId ? { topicId: resolvedTopicId } : {}),
            infoItemSubjectSnapshot: currentItemSubject,
            ...searchQuery,
          };
          const fallbackAttachments = await Attachment.find(fallbackQuery)
            .sort({ uploadedAt: -1 })
            .limit(limit)
            .lean();

          if (fallbackAttachments.length > 0) {
            const attachmentIds = fallbackAttachments.map((entry: any) => entry?._id).filter(Boolean);
            if (attachmentIds.length > 0) {
              await Attachment.updateMany(
                { _id: { $in: attachmentIds } },
                {
                  $set: {
                    infoItemId,
                    topicId: resolvedTopicId || undefined,
                    topicSubjectSnapshot: normalizeTag(String(relation.topic?.subject || '')),
                    infoItemSubjectSnapshot: currentItemSubject,
                  },
                }
              );
            }

            attachments = fallbackAttachments.map((entry: any) => ({
              ...entry,
              infoItemId,
              topicId: resolvedTopicId || undefined,
              topicSubjectSnapshot: normalizeTag(String(relation.topic?.subject || '')),
              infoItemSubjectSnapshot: currentItemSubject,
            }));
          }
        }
      }

      return NextResponse.json({
        success: true,
        count: attachments.length,
        data: attachments.map(attachmentToApiShape),
      });
    }

    const baseQuery: Record<string, unknown> = {
      ...(topicId ? { topicId } : {}),
      ...(infoItemId ? { infoItemId } : {}),
      ...searchQuery,
    };

    if (!canViewAllDocuments && !canViewAllMinutes) {
      const minuteIds = await findAccessibleMinuteIds(authResult.user);
      if (minuteIds.length === 0) {
        return NextResponse.json({ success: true, count: 0, data: [] });
      }
      baseQuery.minuteId = { $in: minuteIds };
    }

    const attachments = await Attachment.find(baseQuery).sort({ uploadedAt: -1 }).limit(limit).lean();
    return NextResponse.json({
      success: true,
      count: attachments.length,
      data: attachments.map(attachmentToApiShape),
    });
  } catch (error) {
    console.error('GET /api/attachments failed:', error);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}

/**
 * POST /api/attachments
 * Upload attachment
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const canUploadDocuments = await hasPermission(authResult.user, 'canUploadDocuments');
    if (!canUploadDocuments) {
      return NextResponse.json({ error: 'Fehlende Berechtigung zum Hochladen von Dokumenten' }, { status: 403 });
    }

    const userId = authResult.user._id.toString();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const minuteId = String(formData.get('minuteId') || '').trim();
    const topicId = String(formData.get('topicId') || '').trim();
    const infoItemId = String(formData.get('infoItemId') || '').trim();

    if (!file || !minuteId) {
      return NextResponse.json({ error: 'file and minuteId are required' }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(minuteId)) {
      return NextResponse.json({ error: 'Invalid minuteId' }, { status: 400 });
    }
    if (topicId && !mongoose.isValidObjectId(topicId)) {
      return NextResponse.json({ error: 'Invalid topicId' }, { status: 400 });
    }
    if (infoItemId && !mongoose.isValidObjectId(infoItemId)) {
      return NextResponse.json({ error: 'Invalid infoItemId' }, { status: 400 });
    }

    await connectDB();

    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    const maxFileSizeMB = settings?.systemSettings?.maxFileUploadSize || 10;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json({ error: `File size exceeds maximum of ${maxFileSizeMB}MB` }, { status: 400 });
    }

    if (settings?.systemSettings?.allowedFileTypes && settings.systemSettings.allowedFileTypes.length > 0) {
      const extension = String(file.name.split('.').pop() || '').toLowerCase();
      const allowedExtensions = settings.systemSettings.allowedFileTypes.map((item: string) => item.toLowerCase().replace('.', ''));
      if (extension && !allowedExtensions.includes(extension)) {
        return NextResponse.json({ error: `Dateityp .${extension} ist nicht erlaubt.` }, { status: 400 });
      }
    } else if (!DEFAULT_ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const minute = await Minutes.findById(minuteId).populate('meetingSeries_id');
    if (!minute) {
      return NextResponse.json({ error: 'Minute not found' }, { status: 404 });
    }

    const access = await getMinuteAccessContext(authResult.user, minute);
    if (!access.canAccessMinute) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const relation = resolveTopicAndInfoItem(minute, topicId, infoItemId);
    if (relation.error) {
      return NextResponse.json({ error: relation.error }, { status: 400 });
    }
    const resolvedTopicId = relation.topic ? String(relation.topic?._id || '') : topicId;
    const topicSubjectSnapshot = normalizeTag(String(relation.topic?.subject || ''));
    const infoItemSubjectSnapshot = normalizeTag(String(relation.infoItem?.subject || ''));

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, '');
    const baseName = path.basename(file.name, path.extname(file.name)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${timestamp}-${baseName}${ext}`;

    const filePath = safePath(UPLOAD_DIR, fileName);
    if (!filePath) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const minuteTag = formatMinuteTag(minute);
    const seriesName = formatSeriesName(minute.meetingSeries_id);
    const tags = uniqueTags([minuteTag, topicSubjectSnapshot, infoItemSubjectSnapshot]);

    const attachment = await Attachment.create({
      fileName,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedBy: userId,
      minuteId,
      topicId: resolvedTopicId || undefined,
      infoItemId: infoItemId || undefined,
      tags,
      minuteTitleSnapshot: minuteTag,
      topicSubjectSnapshot,
      infoItemSubjectSnapshot,
      meetingSeriesNameSnapshot: seriesName,
    });

    return NextResponse.json({ success: true, data: attachmentToApiShape(attachment.toObject()) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/attachments failed:', error);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}

/**
 * DELETE /api/attachments
 * Delete attachment
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user._id.toString();
    const username = String(authResult.user.username || '').trim();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await connectDB();

    const attachment = await Attachment.findById(id);
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const minute = await Minutes.findById(attachment.minuteId).populate('meetingSeries_id');
    if (!minute) {
      return NextResponse.json({ error: 'Associated minute not found' }, { status: 404 });
    }

    const access = await getMinuteAccessContext(authResult.user, minute);
    const isUploader = attachment.uploadedBy === userId || attachment.uploadedBy === username;
    const canDelete =
      access.canDeleteAllDocuments ||
      (access.canAccessMinute && (access.isSeriesModerator || isUploader));

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own attachments or need broader permissions' },
        { status: 403 }
      );
    }

    const filePath = safePath(UPLOAD_DIR, attachment.fileName);
    if (filePath) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(filePath);
      } catch {
        // Keep deleting DB metadata even when filesystem cleanup fails.
      }
    }

    await Attachment.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/attachments failed:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}

/**
 * PATCH /api/attachments
 * Rename attachment display name (originalName)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = authResult.user._id.toString();
    const username = String(authResult.user.username || '').trim();
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const requestedName = sanitizeAttachmentDisplayName(String(body?.name || ''));

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid attachment id' }, { status: 400 });
    }
    if (!requestedName) {
      return NextResponse.json({ error: 'Neuer Dateiname darf nicht leer sein' }, { status: 400 });
    }

    await connectDB();

    const attachment = await Attachment.findById(id);
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const minute = await Minutes.findById(attachment.minuteId).populate('meetingSeries_id');
    if (!minute) {
      return NextResponse.json({ error: 'Associated minute not found' }, { status: 404 });
    }

    const access = await getMinuteAccessContext(authResult.user, minute);
    const isUploader = attachment.uploadedBy === userId || attachment.uploadedBy === username;
    const canRename =
      access.canDeleteAllDocuments ||
      (access.canAccessMinute && (access.isSeriesModerator || isUploader));

    if (!canRename) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentName = String(attachment.originalName || '').trim();
    const currentExt = normalizeExtension(currentName);
    const requestedExt = normalizeExtension(requestedName);
    let finalName = requestedName;

    if (currentExt) {
      if (requestedExt && requestedExt !== currentExt) {
        return NextResponse.json(
          { error: 'Die Dateiendung kann nicht geändert werden.' },
          { status: 400 }
        );
      }

      if (!requestedExt) {
        const baseName = requestedName.replace(/\.+$/, '').trim();
        if (!baseName) {
          return NextResponse.json({ error: 'Neuer Dateiname ist ungültig' }, { status: 400 });
        }
        finalName = `${baseName}${currentExt}`;
      }
    }

    if (finalName === currentName) {
      return NextResponse.json({ success: true, data: attachmentToApiShape(attachment.toObject()) });
    }

    attachment.originalName = finalName;
    await attachment.save();

    return NextResponse.json({ success: true, data: attachmentToApiShape(attachment.toObject()) });
  } catch (error) {
    console.error('PATCH /api/attachments failed:', error);
    return NextResponse.json({ error: 'Failed to rename attachment' }, { status: 500 });
  }
}
