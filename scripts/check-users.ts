
import connectDB from '../lib/mongodb';
import User from '../models/User';

async function checkUsers() {
    try {
        await connectDB();
        const count = await User.countDocuments({});
        console.log(`User count: ${count}`);
        if (count > 0) {
            const users = await User.find({}, 'email username role');
            console.log('Users found:', JSON.stringify(users, null, 2));
        }
        process.exit(0);
    } catch (error) {
        console.error('Error checking users:', error);
        process.exit(1);
    }
}

checkUsers();
