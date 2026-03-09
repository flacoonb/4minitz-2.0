import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Minutes from '@/models/Minutes';
import MinutesTemplate from '@/models/MinutesTemplate';
import MeetingSeries from '@/models/MeetingSeries';
import ClubFunction from '@/models/ClubFunction';
import {
  createFunctionToken,
  parseFunctionToken,
  sanitizeResponsibles,
  slugifyFunctionName,
} from '@/lib/club-functions';

type SourceEntry = { raw: string; normalizedName: string; slug: string };

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function shouldTreatAsUserIdentifier(value: string, knownUsernames: Set<string>, knownUserIds: Set<string>): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('guest:')) return true;
  if (knownUserIds.has(trimmed)) return true;
  if (knownUsernames.has(trimmed.toLowerCase())) return true;
  return false;
}

function collectFromTopics(topics: any[]): string[] {
  const values = new Set<string>();
  for (const topic of topics || []) {
    sanitizeResponsibles(topic?.responsibles).forEach((entry) => values.add(entry));
    for (const item of topic?.infoItems || []) {
      sanitizeResponsibles(item?.responsibles).forEach((entry) => values.add(entry));
    }
  }
  return Array.from(values);
}

async function main() {
  const rewrite = process.argv.includes('--rewrite');
  await connectDB();

  const users = await User.find({}).select('_id username').lean();
  const knownUserIds = new Set(users.map((user: any) => String(user._id)));
  const knownUsernames = new Set(users.map((user: any) => String(user.username || '').toLowerCase()).filter(Boolean));

  const values = new Set<string>();

  const minutes = await Minutes.find({}).select('topics').lean();
  minutes.forEach((minute: any) => collectFromTopics(minute.topics || []).forEach((value) => values.add(value)));

  const templates = await MinutesTemplate.find({}).select('content.topics').lean();
  templates.forEach((template: any) => collectFromTopics(template?.content?.topics || []).forEach((value) => values.add(value)));

  const seriesList = await MeetingSeries.find({}).select('clubFunctions additionalResponsibles').lean();
  seriesList.forEach((series: any) => {
    sanitizeResponsibles(series?.clubFunctions).forEach((value) => values.add(value));
    sanitizeResponsibles(series?.additionalResponsibles).forEach((value) => values.add(value));
  });

  const sourceEntries: SourceEntry[] = [];
  for (const rawValue of values) {
    const value = normalizeName(rawValue);
    if (!value) continue;
    const tokenSlug = parseFunctionToken(value);
    if (tokenSlug) {
      sourceEntries.push({ raw: value, normalizedName: normalizeName(tokenSlug.replace(/-/g, ' ')), slug: tokenSlug });
      continue;
    }
    if (shouldTreatAsUserIdentifier(value, knownUsernames, knownUserIds)) continue;
    const slug = slugifyFunctionName(value);
    if (!slug) continue;
    sourceEntries.push({ raw: value, normalizedName: value, slug });
  }

  const dedupBySlug = new Map<string, SourceEntry>();
  sourceEntries.forEach((entry) => {
    if (!dedupBySlug.has(entry.slug)) dedupBySlug.set(entry.slug, entry);
  });

  const created: string[] = [];
  for (const entry of dedupBySlug.values()) {
    const exists = await ClubFunction.findOne({ slug: entry.slug }).lean();
    if (exists) continue;
    await ClubFunction.create({
      name: entry.normalizedName,
      slug: entry.slug,
      isActive: true,
      createdBy: 'migration',
      updatedBy: 'migration',
    });
    created.push(entry.slug);
  }

  console.log(`[club-functions] created ${created.length} new functions`);
  if (created.length > 0) console.log(created.join(', '));

  if (!rewrite) {
    console.log('[club-functions] dry-run completed (no document rewrites). Use --rewrite to convert plain labels to function tokens.');
    process.exit(0);
  }

  const slugByName = new Map<string, string>();
  for (const entry of dedupBySlug.values()) slugByName.set(entry.normalizedName.toLowerCase(), entry.slug);

  const rewriteList = (list: unknown): string[] =>
    sanitizeResponsibles(list).map((entry) => {
      const tokenSlug = parseFunctionToken(entry);
      if (tokenSlug) return createFunctionToken(tokenSlug);
      const slug = slugByName.get(normalizeName(entry).toLowerCase());
      return slug ? createFunctionToken(slug) : entry;
    });

  let minutesUpdated = 0;
  for (const minute of await Minutes.find({})) {
    let changed = false;
    for (const topic of minute.topics || []) {
      const topicValues = rewriteList((topic as any).responsibles);
      if (JSON.stringify(topicValues) !== JSON.stringify((topic as any).responsibles || [])) {
        (topic as any).responsibles = topicValues;
        changed = true;
      }
      for (const item of (topic as any).infoItems || []) {
        const itemValues = rewriteList(item.responsibles);
        if (JSON.stringify(itemValues) !== JSON.stringify(item.responsibles || [])) {
          item.responsibles = itemValues;
          changed = true;
        }
      }
    }
    if (changed) {
      await minute.save();
      minutesUpdated += 1;
    }
  }

  let templatesUpdated = 0;
  for (const template of await MinutesTemplate.find({})) {
    let changed = false;
    const topics = template.content?.topics || [];
    for (const topic of topics as any[]) {
      const topicValues = rewriteList(topic.responsibles);
      if (JSON.stringify(topicValues) !== JSON.stringify(topic.responsibles || [])) {
        topic.responsibles = topicValues;
        changed = true;
      }
      for (const item of topic.infoItems || []) {
        const itemValues = rewriteList(item.responsibles);
        if (JSON.stringify(itemValues) !== JSON.stringify(item.responsibles || [])) {
          item.responsibles = itemValues;
          changed = true;
        }
      }
    }
    if (changed) {
      template.markModified('content');
      await template.save();
      templatesUpdated += 1;
    }
  }

  let seriesUpdated = 0;
  for (const series of await MeetingSeries.find({})) {
    const updatedClubFunctions = rewriteList((series as any).clubFunctions);
    if (JSON.stringify(updatedClubFunctions) !== JSON.stringify((series as any).clubFunctions || [])) {
      (series as any).clubFunctions = updatedClubFunctions;
      series.markModified('clubFunctions');
      await series.save();
      seriesUpdated += 1;
    }
  }

  console.log(`[club-functions] rewritten docs - minutes=${minutesUpdated}, templates=${templatesUpdated}, series=${seriesUpdated}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[club-functions] migration failed:', error);
  process.exit(1);
});
