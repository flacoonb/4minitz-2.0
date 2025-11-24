/**
 * Sample Data Generator
 * Creates sample meeting series and minutes for testing
 * 
 * Usage: npx tsx scripts/sample-data.ts
 */

import mongoose from 'mongoose';
import MeetingSeries from '../models/MeetingSeries';
import Minutes from '../models/Minutes';

const TARGET_DB = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz-next';

async function createSampleData() {
  console.log('\n🎨 Creating Sample Data');
  console.log('='.repeat(60));

  try {
    await mongoose.connect(TARGET_DB);
    console.log('✅ Connected to database\n');

    // Create sample meeting series
    const sampleSeries = [
      {
        project: 'Product Development',
        name: 'Weekly Team Sync',
        visibleFor: ['demo-user', 'alice@example.com', 'bob@example.com'],
        moderators: ['demo-user'],
        participants: ['alice@example.com', 'bob@example.com', 'charlie@example.com'],
        informedUsers: ['manager@example.com'],
        availableLabels: [
          { name: 'Important', color: '#FF0000', isDefaultLabel: true },
          { name: 'Decision', color: '#00FF00', isDefaultLabel: true },
          { name: 'TODO', color: '#0000FF', isDefaultLabel: true },
          { name: 'Bug', color: '#FFA500', isDefaultLabel: false },
        ],
      },
      {
        project: 'Marketing',
        name: 'Monthly Planning',
        visibleFor: ['demo-user', 'marketing@example.com'],
        moderators: ['demo-user', 'marketing@example.com'],
        participants: ['social@example.com', 'content@example.com'],
        availableLabels: [
          { name: 'Campaign', color: '#9C27B0', isDefaultLabel: false },
          { name: 'Budget', color: '#4CAF50', isDefaultLabel: false },
        ],
      },
      {
        project: 'Engineering',
        name: 'Sprint Retrospective',
        visibleFor: ['demo-user', 'dev-team@example.com'],
        moderators: ['demo-user'],
        participants: ['dev1@example.com', 'dev2@example.com', 'dev3@example.com'],
        informedUsers: ['cto@example.com'],
        availableLabels: [
          { name: 'Action Item', color: '#FF5722', isDefaultLabel: true },
          { name: 'Improvement', color: '#2196F3', isDefaultLabel: false },
        ],
      },
    ];

    console.log('📋 Creating meeting series...');
    const createdSeries = [];
    
    for (const seriesData of sampleSeries) {
      const series = await MeetingSeries.create(seriesData);
      createdSeries.push(series);
      console.log(`   ✅ Created: ${series.project} - ${series.name}`);
    }

    // Create sample minutes for first series
    console.log('\n📝 Creating sample minutes...');
    const firstSeries = createdSeries[0] as any;

    const sampleMinutes = [
      {
        meetingSeries_id: firstSeries._id.toString(),
        date: new Date('2024-11-03'),
        isFinalized: true,
        finalizedAt: new Date('2024-11-03T16:00:00Z'),
        finalizedBy: 'demo-user',
        visibleFor: firstSeries.visibleFor,
        participants: ['alice@example.com', 'bob@example.com'],
        topics: [
          {
            subject: 'Sprint Review',
            responsibles: ['alice@example.com'],
            isOpen: false,
            isRecurring: true,
            infoItems: [
              {
                subject: 'Complete user authentication feature',
                isOpen: false,
                itemType: 'actionItem' as const,
                priority: 'high',
                responsibles: ['alice@example.com'],
              },
              {
                subject: 'Deploy to staging environment',
                isOpen: false,
                itemType: 'actionItem' as const,
                responsibles: ['bob@example.com'],
              },
            ],
          },
          {
            subject: 'Next Sprint Planning',
            responsibles: ['demo-user'],
            isOpen: true,
            isNew: true,
            infoItems: [
              {
                subject: 'Implement dashboard redesign',
                isOpen: true,
                itemType: 'actionItem' as const,
                priority: 'medium',
                duedate: new Date('2024-11-10'),
                responsibles: ['alice@example.com', 'bob@example.com'],
              },
            ],
          },
        ],
        globalNote: 'Great progress this week! Team is on track.',
        agendaSentAt: new Date('2024-11-02T09:00:00Z'),
      },
      {
        meetingSeries_id: firstSeries._id.toString(),
        date: new Date('2024-11-10'),
        isFinalized: false,
        visibleFor: firstSeries.visibleFor,
        participants: ['alice@example.com', 'bob@example.com', 'charlie@example.com'],
        topics: [
          {
            subject: 'Sprint Review',
            responsibles: ['alice@example.com'],
            isOpen: true,
            isRecurring: true,
            infoItems: [
              {
                subject: 'Complete API integration',
                isOpen: true,
                itemType: 'actionItem' as const,
                priority: 'high',
                duedate: new Date('2024-11-12'),
                responsibles: ['charlie@example.com'],
              },
            ],
          },
          {
            subject: 'Bug Triage',
            responsibles: ['bob@example.com'],
            isOpen: true,
            isNew: true,
            infoItems: [
              {
                subject: 'Fix login redirect issue',
                isOpen: true,
                itemType: 'actionItem' as const,
                priority: 'high',
                responsibles: ['alice@example.com'],
              },
              {
                subject: 'Update documentation',
                isOpen: true,
                itemType: 'actionItem' as const,
                priority: 'low',
                responsibles: ['bob@example.com'],
              },
            ],
          },
        ],
        globalNote: 'Draft meeting - still in progress',
      },
    ];

    for (const minuteData of sampleMinutes) {
      const minute = await Minutes.create(minuteData);
      const status = minute.isFinalized ? 'Finalized' : 'Draft';
      console.log(`   ✅ Created minute: ${minute.date.toLocaleDateString()} (${status})`);
    }

    // Update the first series with last minutes info
    await MeetingSeries.findByIdAndUpdate(firstSeries._id, {
      lastMinutesDate: new Date(),
      lastMinutesId: ((await Minutes.findOne({ 
        meetingSeries_id: firstSeries._id.toString() 
      }).sort({ date: -1 })) as any)?._id.toString(),
      lastMinutesFinalized: true,
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ SAMPLE DATA CREATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`\n📋 Created ${createdSeries.length} meeting series`);
    console.log(`📝 Created ${sampleMinutes.length} minutes`);
    console.log('\n💡 You can now test the application at http://localhost:3000\n');

  } catch (error) {
    console.error('\n❌ Error creating sample data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database\n');
  }
}

if (require.main === module) {
  createSampleData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { createSampleData };
