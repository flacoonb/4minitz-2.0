/**
 * Data Migration Script
 * Migrates data from old 4minitz Meteor database to new Next.js structure
 * 
 * Usage: npx tsx scripts/migrate-data.ts
 */

import mongoose from 'mongoose';
import MeetingSeries from '../models/MeetingSeries';
import Minutes from '../models/Minutes';

// Source and Target Database URIs
const SOURCE_DB = process.env.SOURCE_MONGODB_URI || 'mongodb://localhost:27017/4minitz';
const TARGET_DB = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz-next';

interface MigrationStats {
  meetingSeries: { total: number; migrated: number; failed: number };
  minutes: { total: number; migrated: number; failed: number };
  errors: string[];
}

const stats: MigrationStats = {
  meetingSeries: { total: 0, migrated: 0, failed: 0 },
  minutes: { total: 0, migrated: 0, failed: 0 },
  errors: [],
};

async function connectToSource() {
  console.log('📡 Connecting to source database...');
  const sourceConnection = await mongoose.createConnection(SOURCE_DB).asPromise();
  console.log('✅ Connected to source database');
  return sourceConnection;
}

async function connectToTarget() {
  console.log('📡 Connecting to target database...');
  await mongoose.connect(TARGET_DB);
  console.log('✅ Connected to target database');
}

async function migrateMeetingSeries(sourceConnection: mongoose.Connection) {
  console.log('\n📋 Migrating Meeting Series...');
  
  const SourceMeetingSeries = sourceConnection.model(
    'MeetingSeries',
    new mongoose.Schema({}, { strict: false }),
    'meetingSeries'
  );

  try {
    const sourceSeries = await SourceMeetingSeries.find({}).lean() as any[];
    stats.meetingSeries.total = sourceSeries.length;
    
    console.log(`Found ${sourceSeries.length} meeting series to migrate`);

    for (const series of sourceSeries) {
      try {
        // Check if already exists
        const existing = await MeetingSeries.findById(series._id);
        if (existing) {
          console.log(`⏭️  Skipping existing series: ${series.name}`);
          continue;
        }

        // Map old structure to new structure
        const newSeries = new MeetingSeries({
          _id: series._id,
          project: series.project || 'Unknown',
          name: series.name || 'Unnamed Series',
          visibleFor: Array.isArray(series.visibleFor) ? series.visibleFor : [],
          informedUsers: Array.isArray(series.informedUsers) ? series.informedUsers : [],
          moderators: Array.isArray(series.moderators) ? series.moderators : [],
          participants: Array.isArray(series.participants) ? series.participants : [],
          additionalResponsibles: Array.isArray(series.additionalResponsibles) 
            ? series.additionalResponsibles 
            : [],
          lastMinutesDate: series.lastMinutesDate,
          lastMinutesFinalized: series.lastMinutesFinalized || false,
          lastMinutesId: series.lastMinutesId,
          availableLabels: Array.isArray(series.availableLabels) 
            ? series.availableLabels 
            : [],
          minutes: Array.isArray(series.minutes) ? series.minutes : [],
          createdAt: series.createdAt || new Date(),
          updatedAt: series.updatedAt || new Date(),
        });

        await newSeries.save();
        stats.meetingSeries.migrated++;
        console.log(`✅ Migrated: ${series.name}`);
      } catch (error) {
        stats.meetingSeries.failed++;
        const errorMsg = `Failed to migrate series ${series._id}: ${error}`;
        stats.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching meeting series:', error);
    throw error;
  }
}

async function migrateMinutes(sourceConnection: mongoose.Connection) {
  console.log('\n📝 Migrating Minutes...');
  
  const SourceMinutes = sourceConnection.model(
    'Minutes',
    new mongoose.Schema({}, { strict: false }),
    'minutes'
  );

  try {
    const sourceMinutes = await SourceMinutes.find({}).lean() as any[];
    stats.minutes.total = sourceMinutes.length;
    
    console.log(`Found ${sourceMinutes.length} minutes to migrate`);

    for (const minute of sourceMinutes) {
      try {
        // Check if already exists
        const existing = await Minutes.findById(minute._id);
        if (existing) {
          console.log(`⏭️  Skipping existing minute: ${minute._id}`);
          continue;
        }

        // Map old structure to new structure
        const newMinute = new Minutes({
          _id: minute._id,
          meetingSeries_id: minute.meetingSeries_id,
          date: minute.date || new Date(),
          isFinalized: minute.isFinalized || false,
          finalizedAt: minute.finalizedAt,
          finalizedBy: minute.finalizedBy,
          visibleFor: Array.isArray(minute.visibleFor) ? minute.visibleFor : [],
          informedUsers: Array.isArray(minute.informedUsers) ? minute.informedUsers : [],
          participants: Array.isArray(minute.participants) ? minute.participants : [],
          participantsAdditional: minute.participantsAdditional,
          topics: Array.isArray(minute.topics) ? minute.topics : [],
          globalNote: minute.globalNote,
          agendaSentAt: minute.agendaSentAt,
          createdAt: minute.createdAt || new Date(),
          updatedAt: minute.updatedAt || new Date(),
        });

        await newMinute.save();
        stats.minutes.migrated++;
        console.log(`✅ Migrated minute: ${minute._id} (${minute.date})`);
      } catch (error) {
        stats.minutes.failed++;
        const errorMsg = `Failed to migrate minute ${minute._id}: ${error}`;
        stats.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching minutes:', error);
    throw error;
  }
}

async function printStats() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION STATISTICS');
  console.log('='.repeat(60));
  
  console.log('\n📋 Meeting Series:');
  console.log(`   Total:    ${stats.meetingSeries.total}`);
  console.log(`   Migrated: ${stats.meetingSeries.migrated} ✅`);
  console.log(`   Failed:   ${stats.meetingSeries.failed} ❌`);
  
  console.log('\n📝 Minutes:');
  console.log(`   Total:    ${stats.minutes.total}`);
  console.log(`   Migrated: ${stats.minutes.migrated} ✅`);
  console.log(`   Failed:   ${stats.minutes.failed} ❌`);
  
  if (stats.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    stats.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  const totalMigrated = stats.meetingSeries.migrated + stats.minutes.migrated;
  const totalFailed = stats.meetingSeries.failed + stats.minutes.failed;
  
  if (totalFailed === 0) {
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
  } else {
    console.log(`⚠️  MIGRATION COMPLETED WITH ${totalFailed} ERRORS`);
  }
  console.log('='.repeat(60) + '\n');
}

async function main() {
  console.log('\n🚀 Starting 4minitz Data Migration');
  console.log('='.repeat(60));
  console.log(`Source: ${SOURCE_DB}`);
  console.log(`Target: ${TARGET_DB}`);
  console.log('='.repeat(60) + '\n');

  let sourceConnection: mongoose.Connection | null = null;

  try {
    // Connect to both databases
    sourceConnection = await connectToSource();
    await connectToTarget();

    // Perform migrations
    await migrateMeetingSeries(sourceConnection);
    await migrateMinutes(sourceConnection);

    // Print statistics
    await printStats();

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup connections
    if (sourceConnection) {
      await sourceConnection.close();
      console.log('🔌 Closed source database connection');
    }
    await mongoose.disconnect();
    console.log('🔌 Closed target database connection');
  }
}

// Run migration if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { main as migrateData };
