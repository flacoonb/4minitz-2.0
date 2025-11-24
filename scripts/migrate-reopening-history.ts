import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Minutes from '../models/Minutes';
import { IMinutes } from '../models/Minutes';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz';

async function migrateReopeningHistory() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const minutes = await Minutes.find({
      globalNote: { $regex: /📝/ }
    });

    console.log(`Found ${minutes.length} minutes with potential reopening notes.`);

    let updatedCount = 0;

    for (const minuteDoc of minutes) {
      const minute = minuteDoc as unknown as IMinutes;
      if (!minute.globalNote) continue;

      const notes = minute.globalNote.split('\n\n');
      const newNotes: string[] = [];
      const extractedHistory: any[] = [];
      let hasChanges = false;

      for (const note of notes) {
        if (note.trim().startsWith('📝')) {
          // Parse reopening note
          try {
            const lines = note.split('\n');
            const firstLine = lines[0]; // "📝 Protokoll wiedereröffnet am ..."
            const reasonLine = lines.slice(1).join('\n'); // "Grund: ..."
            
            // Extract date and user
            // Format: "📝 Protokoll wiedereröffnet am DD.MM.YYYY, HH:mm von Name"
            // Regex to capture date/time and user
            const match = firstLine.match(/am (.*?) von (.*)/);
            
            if (match) {
              const dateStr = match[1]; // "22.11.2025, 19:00"
              const userStr = match[2]; // "Max Muster" or "User ID"

              // Parse date (German format)
              const [d, t] = dateStr.split(', ');
              const [day, month, year] = d.split('.');
              const [hour, min] = t.split(':');
              
              const reopenedAt = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min));
              
              // Extract reason
              const reason = reasonLine.replace('Grund: ', '').trim();

              extractedHistory.push({
                reopenedAt,
                reopenedBy: userStr, // We might not have the ID, so we store the name/string
                reason
              });
              hasChanges = true;
              console.log(`Extracted history for minute ${minute._id}: ${dateStr} - ${reason}`);
            } else {
              console.warn(`Could not parse reopening note in minute ${minute._id}: ${firstLine}`);
              newNotes.push(note); // Keep it if we can't parse it
            }
          } catch (e) {
            console.error(`Error parsing note in minute ${minute._id}:`, e);
            newNotes.push(note);
          }
        } else {
          newNotes.push(note);
        }
      }

      if (hasChanges) {
        // Update minute
        minute.globalNote = newNotes.join('\n\n');
        
        // Merge with existing history
        const existingHistory = minute.reopeningHistory || [];
        
        // Avoid duplicates (simple check based on time and reason)
        for (const newEntry of extractedHistory) {
          const isDuplicate = existingHistory.some(existing => 
            Math.abs(new Date(existing.reopenedAt).getTime() - newEntry.reopenedAt.getTime()) < 60000 && // within 1 minute
            existing.reason === newEntry.reason
          );
          
          if (!isDuplicate) {
            existingHistory.push(newEntry);
          }
        }
        
        // Sort by date
        existingHistory.sort((a, b) => new Date(a.reopenedAt).getTime() - new Date(b.reopenedAt).getTime());
        
        minute.reopeningHistory = existingHistory;
        
        await minuteDoc.save();
        updatedCount++;
        process.stdout.write('.');
      }
    }

    console.log('\nMigration completed.');
    console.log(`Minutes updated: ${updatedCount}`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateReopeningHistory();
