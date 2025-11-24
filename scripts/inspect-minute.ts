import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Minutes from '../models/Minutes';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz';

async function inspectMinute() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const id = '69208f33e1a91b03af635e06';
    const minute = await Minutes.findById(id);

    if (!minute) {
      console.log('Minute not found');
      return;
    }

    console.log('--- Global Note ---');
    console.log(JSON.stringify(minute.globalNote));
    console.log('--- Reopening History ---');
    console.log(JSON.stringify(minute.reopeningHistory, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

inspectMinute();
