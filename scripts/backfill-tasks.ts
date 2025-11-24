import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Minutes from '../models/Minutes';
import Task from '../models/Task';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz';

async function backfill() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    // 1. Fetch all minutes with action items, sorted by date (oldest first)
    const minutes = await Minutes.find({
      'topics.infoItems.itemType': 'actionItem',
    }).sort({ date: 1 });

    console.log(`Found ${minutes.length} minutes to process.`);

    let updatedCount = 0;
    let errors = 0;

    // 2. Iterate and update tasks
    for (const minuteDoc of minutes) {
      const minute = minuteDoc as any;
      if (!minute.topics) continue;

      for (const topic of minute.topics) {
        if (!topic.infoItems) continue;

        for (const item of topic.infoItems) {
          if (item.itemType === 'actionItem' && item.externalTaskId) {
            try {
              // Update the task with the current minute ID
              await Task.findByIdAndUpdate(item.externalTaskId, {
                minutesId: minute._id.toString()
              });
              updatedCount++;
              process.stdout.write('.');
            } catch (err) {
              console.error(`\nError updating task ${item.externalTaskId}:`, err);
              errors++;
            }
          }
        }
      }
    }

    console.log('\nBackfill completed.');
    console.log(`Minutes processed: ${minutes.length}`);
    console.log(`Tasks updated: ${updatedCount}`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

backfill();
