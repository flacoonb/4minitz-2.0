import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs';
import User from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nxtminutes';

async function createUser() {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.error('❌ Usage: npm run create-user -- <email> <password> <firstname> <lastname>');
    process.exit(1);
  }

  const [email, password, firstname, lastname] = args;
  const name = `${firstname} ${lastname}`;

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Check if user exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log(`ℹ️  User ${email} already exists.`);
      await mongoose.disconnect();
      return;
    }

    // Generate username from email (part before @)
    const username = email.split('@')[0];

    // Create user
    // Note: We do NOT hash the password here because the User model has a pre-save hook
    // that hashes the password automatically. If we hash it here, it will be hashed twice!
    await User.create({
      email,
      username,
      password: password, // Pass plain password, model will hash it
      firstName: firstname,
      lastName: lastname,
      role: 'admin', // Defaulting to admin for this script
      isEmailVerified: true,
      isActive: true
    });

    console.log('✅ User created successfully!\n');
    console.log('============================================================');
    console.log(`📧 Email:    ${email}`);
    console.log(`👤 Username: ${username}`);
    console.log(`🔒 Password: ${password}`);
    console.log(`👤 Name:     ${name}`);
    console.log('🎭 Role:     admin');
    console.log('============================================================\n');

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  } catch (error) {
    console.error('❌ Error creating user:', error);
    process.exit(1);
  }
}

createUser();
