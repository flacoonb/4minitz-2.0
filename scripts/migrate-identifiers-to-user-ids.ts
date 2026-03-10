import mongoose from 'mongoose';
import User from '../models/User';
import MeetingSeries from '../models/MeetingSeries';
import Minutes from '../models/Minutes';
import Task from '../models/Task';

const TARGET_DB = process.env.MONGODB_URI || 'mongodb://localhost:27017/nxtminutes';
const APPLY_CHANGES = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

type Stats = {
  scanned: number;
  updated: number;
};

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function shouldKeepRawIdentifier(value: string): boolean {
  return value.startsWith('guest:') || value === 'migration';
}

function mapIdentifier(value: unknown, lookup: Map<string, string>): string {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;
  if (shouldKeepRawIdentifier(raw)) return raw;
  return lookup.get(normalizeIdentifier(raw)) || raw;
}

function mapArray(values: unknown, lookup: Map<string, string>): string[] {
  const input = Array.isArray(values) ? values : [];
  const output: string[] = [];
  const seen = new Set<string>();

  for (const value of input) {
    const mapped = mapIdentifier(value, lookup);
    if (!mapped) continue;
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    output.push(mapped);
  }

  return output;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function buildIdentifierLookup(): Promise<Map<string, string>> {
  const users = await User.find({}).select('_id username email').lean();
  const lookup = new Map<string, string>();

  for (const user of users as any[]) {
    const userId = String(user._id);
    lookup.set(normalizeIdentifier(userId), userId);
    if (user.username) lookup.set(normalizeIdentifier(String(user.username)), userId);
    if (user.email) lookup.set(normalizeIdentifier(String(user.email)), userId);
  }

  return lookup;
}

async function migrateTasks(lookup: Map<string, string>): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0 };

  for await (const task of Task.find({}).cursor()) {
    stats.scanned += 1;
    let changed = false;

    const oldResponsibles = Array.isArray((task as any).responsibles) ? (task as any).responsibles.map(String) : [];
    const newResponsibles = mapArray((task as any).responsibles, lookup);
    if (!arraysEqual(oldResponsibles, newResponsibles)) {
      (task as any).responsibles = newResponsibles;
      changed = true;
    }

    if ((task as any).createdBy) {
      const oldCreatedBy = String((task as any).createdBy);
      const newCreatedBy = mapIdentifier((task as any).createdBy, lookup);
      if (oldCreatedBy !== newCreatedBy) {
        (task as any).createdBy = newCreatedBy;
        changed = true;
      }
    }

    if (changed) {
      stats.updated += 1;
      if (VERBOSE) {
        console.log(`task updated: ${String((task as any)._id)}`);
      }
      if (APPLY_CHANGES) {
        await task.save();
      }
    }
  }

  return stats;
}

async function migrateMeetingSeries(lookup: Map<string, string>): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0 };

  for await (const series of MeetingSeries.find({}).cursor()) {
    stats.scanned += 1;
    let changed = false;

    const arrayFields: Array<keyof any> = [
      'visibleFor',
      'moderators',
      'participants',
      'informedUsers',
      'additionalResponsibles',
    ];

    for (const field of arrayFields) {
      const oldValues = Array.isArray((series as any)[field]) ? (series as any)[field].map(String) : [];
      const newValues = mapArray((series as any)[field], lookup);
      if (!arraysEqual(oldValues, newValues)) {
        (series as any)[field] = newValues;
        changed = true;
      }
    }

    if (Array.isArray((series as any).members)) {
      const updatedMembers = (series as any).members.map((member: any) => {
        const mappedUserId = mapIdentifier(member?.userId, lookup);
        if (mappedUserId !== String(member?.userId || '')) changed = true;
        return { ...member, userId: mappedUserId };
      });
      (series as any).members = updatedMembers;
    }

    if (changed) {
      stats.updated += 1;
      if (VERBOSE) {
        console.log(`meetingSeries updated: ${String((series as any)._id)}`);
      }
      if (APPLY_CHANGES) {
        series.markModified('members');
        await series.save();
      }
    }
  }

  return stats;
}

async function migrateMinutes(lookup: Map<string, string>): Promise<Stats> {
  const stats: Stats = { scanned: 0, updated: 0 };

  for await (const minute of Minutes.find({}).cursor()) {
    stats.scanned += 1;
    let changed = false;

    const topLevelArrays: Array<keyof any> = ['visibleFor', 'participants', 'informedUsers'];
    for (const field of topLevelArrays) {
      const oldValues = Array.isArray((minute as any)[field]) ? (minute as any)[field].map(String) : [];
      const newValues = mapArray((minute as any)[field], lookup);
      if (!arraysEqual(oldValues, newValues)) {
        (minute as any)[field] = newValues;
        changed = true;
      }
    }

    if (Array.isArray((minute as any).participantsWithStatus)) {
      (minute as any).participantsWithStatus = (minute as any).participantsWithStatus.map((participant: any) => {
        const mappedUserId = mapIdentifier(participant?.userId, lookup);
        if (mappedUserId !== String(participant?.userId || '')) changed = true;
        return { ...participant, userId: mappedUserId };
      });
    }

    if ((minute as any).finalizedBy) {
      const oldFinalizedBy = String((minute as any).finalizedBy);
      const newFinalizedBy = mapIdentifier((minute as any).finalizedBy, lookup);
      if (oldFinalizedBy !== newFinalizedBy) {
        (minute as any).finalizedBy = newFinalizedBy;
        changed = true;
      }
    }

    if (Array.isArray((minute as any).reopeningHistory)) {
      (minute as any).reopeningHistory = (minute as any).reopeningHistory.map((entry: any) => {
        const mappedReopenedBy = mapIdentifier(entry?.reopenedBy, lookup);
        if (mappedReopenedBy !== String(entry?.reopenedBy || '')) changed = true;
        return { ...entry, reopenedBy: mappedReopenedBy };
      });
    }

    if (Array.isArray((minute as any).topics)) {
      (minute as any).topics = (minute as any).topics.map((topic: any) => {
        const oldTopicResponsibles = Array.isArray(topic?.responsibles) ? topic.responsibles.map(String) : [];
        const newTopicResponsibles = mapArray(topic?.responsibles, lookup);
        if (!arraysEqual(oldTopicResponsibles, newTopicResponsibles)) changed = true;

        const infoItems = Array.isArray(topic?.infoItems)
          ? topic.infoItems.map((item: any) => {
              const oldItemResponsibles = Array.isArray(item?.responsibles) ? item.responsibles.map(String) : [];
              const newItemResponsibles = mapArray(item?.responsibles, lookup);
              if (!arraysEqual(oldItemResponsibles, newItemResponsibles)) changed = true;

              let completedBy = item?.completedBy;
              if (completedBy) {
                const mappedCompletedBy = mapIdentifier(completedBy, lookup);
                if (mappedCompletedBy !== String(completedBy)) {
                  completedBy = mappedCompletedBy;
                  changed = true;
                }
              }

              return {
                ...item,
                responsibles: newItemResponsibles,
                completedBy,
              };
            })
          : topic?.infoItems;

        return {
          ...topic,
          responsibles: newTopicResponsibles,
          infoItems,
        };
      });
    }

    if (changed) {
      stats.updated += 1;
      if (VERBOSE) {
        console.log(`minutes updated: ${String((minute as any)._id)}`);
      }
      if (APPLY_CHANGES) {
        minute.markModified('participantsWithStatus');
        minute.markModified('reopeningHistory');
        minute.markModified('topics');
        await minute.save();
      }
    }
  }

  return stats;
}

async function runMigration() {
  console.log('Identifier migration started');
  console.log(`Mode: ${APPLY_CHANGES ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Database: ${TARGET_DB}`);

  await mongoose.connect(TARGET_DB);
  console.log('Connected');

  try {
    const lookup = await buildIdentifierLookup();
    console.log(`Lookup entries: ${lookup.size}`);

    const taskStats = await migrateTasks(lookup);
    const seriesStats = await migrateMeetingSeries(lookup);
    const minuteStats = await migrateMinutes(lookup);

    console.log('Migration summary');
    console.log(`Tasks scanned=${taskStats.scanned} updated=${taskStats.updated}`);
    console.log(`MeetingSeries scanned=${seriesStats.scanned} updated=${seriesStats.updated}`);
    console.log(`Minutes scanned=${minuteStats.scanned} updated=${minuteStats.updated}`);
    if (!APPLY_CHANGES) {
      console.log('Dry-run complete. Re-run with --apply to persist changes.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

if (require.main === module) {
  runMigration().catch((error) => {
    console.error('Migration failed', error);
    process.exit(1);
  });
}

export { runMigration };
