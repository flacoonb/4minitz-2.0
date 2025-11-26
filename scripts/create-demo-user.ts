import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz-next';

async function createDemoUser() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Check if demo user exists
    const existingUser = await User.findOne({ email: 'demo@example.com' });
    
    if (existingUser) {
      console.log('ℹ️  Demo user already exists');
      console.log('Email: demo@example.com');
      console.log('Password: demo123');
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('demo123', 10);

    // Create demo user
    await User.create({
      email: 'demo@example.com',
      password: hashedPassword,
      name: 'Demo User',
      role: 'admin',
    });

    console.log('✅ Demo user created successfully!\n');
    console.log('============================================================');
    console.log('📧 Email:    demo@example.com');
    console.log('🔒 Password: demo123');
    console.log('👤 Name:     Demo User');
    console.log('🎭 Role:     admin');
    console.log('============================================================\n');
    console.log('You can now login at: http://localhost:3000/auth/signin');

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  } catch (error) {
    console.error('❌ Error creating demo user:', error);
    process.exit(1);
  }
}

createDemoUser();
