/**
 * Migration Verification Script
 * Verifies that data was migrated correctly
 * 
 * Usage: npx tsx scripts/verify-migration.ts
 */

import mongoose from 'mongoose';
import MeetingSeries from '../models/MeetingSeries';
import Minutes from '../models/Minutes';

const TARGET_DB = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz-next';

interface VerificationResult {
  passed: boolean;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
  }[];
}

async function verifyMigration(): Promise<VerificationResult> {
  const result: VerificationResult = {
    passed: true,
    checks: [],
  };

  console.log('\n🔍 Starting Migration Verification');
  console.log('='.repeat(60));

  try {
    await mongoose.connect(TARGET_DB);
    console.log('✅ Connected to target database\n');

    // Check 1: Meeting Series Count
    const seriesCount = await MeetingSeries.countDocuments();
    result.checks.push({
      name: 'Meeting Series Count',
      status: seriesCount > 0 ? 'pass' : 'warning',
      message: `Found ${seriesCount} meeting series`,
    });
    console.log(`📋 Meeting Series: ${seriesCount}`);

    // Check 2: Minutes Count
    const minutesCount = await Minutes.countDocuments();
    result.checks.push({
      name: 'Minutes Count',
      status: minutesCount > 0 ? 'pass' : 'warning',
      message: `Found ${minutesCount} minutes`,
    });
    console.log(`📝 Minutes: ${minutesCount}`);

    // Check 3: Data Integrity - Meeting Series
    const seriesWithoutModerators = await MeetingSeries.countDocuments({
      $or: [
        { moderators: { $exists: false } },
        { moderators: { $size: 0 } },
      ],
    });
    result.checks.push({
      name: 'Meeting Series Data Integrity',
      status: seriesWithoutModerators === 0 ? 'pass' : 'warning',
      message: `${seriesWithoutModerators} series without moderators`,
    });
    console.log(`⚠️  Series without moderators: ${seriesWithoutModerators}`);

    // Check 4: Data Integrity - Minutes
    const minutesWithoutSeries = await Minutes.countDocuments({
      meetingSeries_id: { $exists: false },
    });
    result.checks.push({
      name: 'Minutes Data Integrity',
      status: minutesWithoutSeries === 0 ? 'pass' : 'fail',
      message: `${minutesWithoutSeries} minutes without series reference`,
    });
    console.log(`❌ Minutes without series: ${minutesWithoutSeries}`);

    if (minutesWithoutSeries > 0) {
      result.passed = false;
    }

    // Check 5: Sample Data Validation
    const sampleSeries = await MeetingSeries.findOne();
    if (sampleSeries) {
      const hasRequiredFields = 
        sampleSeries.project &&
        sampleSeries.name &&
        sampleSeries.visibleFor?.length > 0;
      
      result.checks.push({
        name: 'Sample Series Validation',
        status: hasRequiredFields ? 'pass' : 'fail',
        message: hasRequiredFields 
          ? 'Sample series has all required fields'
          : 'Sample series missing required fields',
      });
      
      if (!hasRequiredFields) {
        result.passed = false;
      }
    }

    // Check 6: Relationships
    const seriesWithMinutes = await MeetingSeries.aggregate([
      {
        $lookup: {
          from: 'minutes',
          localField: '_id',
          foreignField: 'meetingSeries_id',
          as: 'relatedMinutes',
        },
      },
      {
        $match: {
          'relatedMinutes.0': { $exists: true },
        },
      },
      {
        $count: 'count',
      },
    ]);

    const seriesWithMinutesCount = seriesWithMinutes[0]?.count || 0;
    result.checks.push({
      name: 'Series-Minutes Relationships',
      status: seriesWithMinutesCount > 0 ? 'pass' : 'warning',
      message: `${seriesWithMinutesCount} series have related minutes`,
    });
    console.log(`🔗 Series with minutes: ${seriesWithMinutesCount}`);

  } catch (error) {
    result.passed = false;
    result.checks.push({
      name: 'Verification Process',
      status: 'fail',
      message: `Error during verification: ${error}`,
    });
    console.error('❌ Verification error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }

  return result;
}

async function main() {
  const result = await verifyMigration();

  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(60) + '\n');

  result.checks.forEach((check, index) => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.message}\n`);
  });

  console.log('='.repeat(60));
  if (result.passed) {
    console.log('✅ VERIFICATION PASSED');
  } else {
    console.log('❌ VERIFICATION FAILED');
  }
  console.log('='.repeat(60) + '\n');

  process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
  main();
}

export { verifyMigration };
