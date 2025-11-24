
import connectDB from '../lib/mongodb';
import User from '../models/User';
import Settings from '../models/Settings';

async function resetSetup() {
    try {
        console.log('Connecting to database...');
        await connectDB();

        console.log('Clearing users...');
        const userResult = await User.deleteMany({});
        console.log(`Deleted ${userResult.deletedCount} users.`);

        console.log('Clearing settings...');
        const settingsResult = await Settings.deleteMany({});
        console.log(`Deleted ${settingsResult.deletedCount} settings.`);

        console.log('Setup reset complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting setup:', error);
        process.exit(1);
    }
}

resetSetup();
