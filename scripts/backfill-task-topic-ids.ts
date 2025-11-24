import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Minutes from '../models/Minutes';
import Task from '../models/Task';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz';

async function backfillTaskTopicIds() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    console.log('Fetching all minutes...');
    const minutes = await Minutes.find({});
    console.log(`Found ${minutes.length} minutes.`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const minute of minutes) {
      if (!minute.topics) continue;

      for (const topic of minute.topics) {
        if (!topic.infoItems) continue;

        // Ensure topic has an ID (it should in DB, but just in case)
        const topicId = topic._id ? topic._id.toString() : null;
        if (!topicId) {
            console.warn(`Topic in minute ${minute._id} has no ID. Skipping items.`);
            continue;
        }

        for (const item of topic.infoItems) {
          if (item.itemType === 'actionItem' && item.externalTaskId) {
            try {
              const result = await Task.updateOne(
                { _id: item.externalTaskId },
                { $set: { topicId: topicId } }
              );
              
              if (result.modifiedCount > 0) {
                updatedCount++;
                // console.log(`Updated task ${item.externalTaskId} with topicId ${topicId}`);
              }
            } catch (err) {
              console.error(`Error updating task ${item.externalTaskId}:`, err);
              errorCount++;
            }
          }
        }
      }
    }

    console.log(`Backfill complete.`);
    console.log(`Updated tasks: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (error) {
    console.error('Fatal Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

backfillTaskTopicIds();
