import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Attachment from '../models/Attachment';
import Minutes from '../models/Minutes';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nxtminutes';
const APPLY = process.argv.includes('--apply');
const SHOW_HELP = process.argv.includes('--help') || process.argv.includes('-h');

interface MinuteContext {
  minuteTag: string;
  seriesName: string;
  topicById: Map<string, string>;
  infoItemById: Map<string, string>;
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

  if (project && name) return `${project} - ${name}`;
  if (project) return project;
  if (name) return name;
  return 'Protokoll';
}

function formatMinuteTag(minute: any): string {
  const title = String(minute?.title || '').trim();
  if (title) return normalizeTag(title);

  const seriesName = formatSeriesName(minute?.meetingSeries_id);
  const date = minute?.date ? new Date(minute.date).toLocaleDateString('de-CH') : '';
  return normalizeTag(date ? `${seriesName} ${date}` : seriesName);
}

async function loadMinuteContext(
  minuteId: string,
  cache: Map<string, MinuteContext | null>
): Promise<MinuteContext | null> {
  if (cache.has(minuteId)) {
    return cache.get(minuteId) || null;
  }

  const minute = await Minutes.findById(minuteId)
    .populate('meetingSeries_id', 'project name')
    .select('title date topics._id topics.subject topics.infoItems._id topics.infoItems.subject meetingSeries_id')
    .lean();

  if (!minute) {
    cache.set(minuteId, null);
    return null;
  }

  const topicById = new Map<string, string>();
  const infoItemById = new Map<string, string>();
  for (const topic of Array.isArray((minute as any).topics) ? (minute as any).topics : []) {
    const topicId = String(topic?._id || '').trim();
    if (!topicId) continue;
    topicById.set(topicId, normalizeTag(String(topic?.subject || '')));

    const infoItems = Array.isArray(topic?.infoItems) ? topic.infoItems : [];
    for (const infoItem of infoItems) {
      const infoItemId = String(infoItem?._id || '').trim();
      if (!infoItemId) continue;
      infoItemById.set(infoItemId, normalizeTag(String(infoItem?.subject || '')));
    }
  }

  const context: MinuteContext = {
    minuteTag: formatMinuteTag(minute),
    seriesName: normalizeTag(formatSeriesName((minute as any).meetingSeries_id)),
    topicById,
    infoItemById,
  };

  cache.set(minuteId, context);
  return context;
}

async function runBackfill() {
  if (SHOW_HELP) {
    console.log('Backfill attachment tags and snapshots from minutes/topic data.');
    console.log('');
    console.log('Usage:');
    console.log('  npx tsx scripts/backfill-attachment-tags.ts           # dry-run');
    console.log('  npx tsx scripts/backfill-attachment-tags.ts --apply   # write changes');
    process.exit(0);
  }

  const minuteCache = new Map<string, MinuteContext | null>();
  let scanned = 0;
  let upToDate = 0;
  let needsUpdate = 0;
  let updated = 0;
  let missingMinute = 0;
  let skippedNoMinuteId = 0;
  let errors = 0;

  try {
    console.log(`Connecting to MongoDB (${MONGODB_URI}) ...`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');
    console.log(APPLY ? 'Mode: APPLY (writing changes)' : 'Mode: DRY-RUN (no changes written)');

    const cursor = Attachment.find({}).cursor();

    for await (const attachmentDoc of cursor) {
      scanned += 1;

      try {
        const attachment: any = attachmentDoc;
        const minuteId = String(attachment.minuteId || '').trim();

        if (!minuteId) {
          skippedNoMinuteId += 1;
          continue;
        }

        const minuteContext = await loadMinuteContext(minuteId, minuteCache);
        if (!minuteContext) {
          missingMinute += 1;
          continue;
        }

        const existingTags = Array.isArray(attachment.tags)
          ? attachment.tags.map((tag: any) => normalizeTag(String(tag || ''))).filter(Boolean)
          : [];
        const topicId = String(attachment.topicId || '').trim();
        const topicSubject = topicId ? normalizeTag(minuteContext.topicById.get(topicId) || '') : '';
        const infoItemId = String(attachment.infoItemId || '').trim();
        const infoItemSubject = infoItemId ? normalizeTag(minuteContext.infoItemById.get(infoItemId) || '') : '';
        const mergedTags = uniqueTags([...existingTags, minuteContext.minuteTag, topicSubject, infoItemSubject]);

        const updates: Record<string, unknown> = {};
        const tagsChanged =
          mergedTags.length !== existingTags.length ||
          mergedTags.some((tag, index) => tag !== existingTags[index]);
        if (tagsChanged) {
          updates.tags = mergedTags;
        }

        const minuteTitleSnapshot = normalizeTag(String(attachment.minuteTitleSnapshot || ''));
        if (!minuteTitleSnapshot) {
          updates.minuteTitleSnapshot = minuteContext.minuteTag;
        }

        const meetingSeriesNameSnapshot = normalizeTag(String(attachment.meetingSeriesNameSnapshot || ''));
        if (!meetingSeriesNameSnapshot && minuteContext.seriesName) {
          updates.meetingSeriesNameSnapshot = minuteContext.seriesName;
        }

        const topicSubjectSnapshot = normalizeTag(String(attachment.topicSubjectSnapshot || ''));
        if (topicSubject && !topicSubjectSnapshot) {
          updates.topicSubjectSnapshot = topicSubject;
        }

        const infoItemSubjectSnapshot = normalizeTag(String(attachment.infoItemSubjectSnapshot || ''));
        if (infoItemSubject && !infoItemSubjectSnapshot) {
          updates.infoItemSubjectSnapshot = infoItemSubject;
        }

        if (Object.keys(updates).length === 0) {
          upToDate += 1;
          continue;
        }

        needsUpdate += 1;
        if (!APPLY) {
          continue;
        }

        const result = await Attachment.updateOne({ _id: attachment._id }, { $set: updates });
        if (result.modifiedCount > 0) {
          updated += 1;
        }
      } catch (error) {
        errors += 1;
        console.error('Error processing attachment:', error);
      }
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }

  console.log('');
  console.log('Backfill summary:');
  console.log(`- scanned: ${scanned}`);
  console.log(`- already up-to-date: ${upToDate}`);
  console.log(`- needs update: ${needsUpdate}`);
  console.log(`- updated: ${updated}`);
  console.log(`- missing minute: ${missingMinute}`);
  console.log(`- skipped (no minuteId): ${skippedNoMinuteId}`);
  console.log(`- errors: ${errors}`);

  if (!APPLY) {
    console.log('');
    console.log('Dry-run complete. Re-run with --apply to persist changes.');
  }
}

runBackfill().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
