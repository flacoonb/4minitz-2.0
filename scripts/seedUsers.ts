import mongoose from 'mongoose';
import User from '../models/User';
import Settings from '../models/Settings';
// import bcrypt from 'bcryptjs';

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz');
    
    console.log('🔗 MongoDB verbunden');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@4minitz.de' });
    
    if (existingAdmin) {
      console.log('👤 Admin-Benutzer existiert bereits');
    } else {
      // Create admin user
      const adminUser = new User({
        email: 'admin@4minitz.de',
        username: 'admin',
        password: 'admin123!',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
        preferences: {
          language: 'de',
          timezone: 'Europe/Berlin',
          notifications: {
            email: true,
            inApp: true,
            reminders: true
          },
          theme: 'auto'
        }
      });
      
      await adminUser.save();
      console.log('👤 Admin-Benutzer erstellt: admin@4minitz.de / admin123!');
    }

    // Check if moderator user exists
    const existingModerator = await User.findOne({ email: 'moderator@4minitz.de' });
    
    if (!existingModerator) {
      const moderatorUser = new User({
        email: 'moderator@4minitz.de',
        username: 'moderator',
        password: 'moderator123!',
        firstName: 'Test',
        lastName: 'Moderator',
        role: 'moderator',
        isActive: true,
        isEmailVerified: true,
        preferences: {
          language: 'de',
          timezone: 'Europe/Berlin',
          notifications: {
            email: true,
            inApp: true,
            reminders: true
          },
          theme: 'auto'
        }
      });
      
      await moderatorUser.save();
      console.log('👤 Moderator-Benutzer erstellt: moderator@4minitz.de / moderator123!');
    }

    // Check if regular user exists
    const existingUser = await User.findOne({ email: 'user@4minitz.de' });
    
    if (!existingUser) {
      const regularUser = new User({
        email: 'user@4minitz.de',
        username: 'user',
        password: 'user123!',
        firstName: 'Test',
        lastName: 'Benutzer',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        preferences: {
          language: 'de',
          timezone: 'Europe/Berlin',
          notifications: {
            email: true,
            inApp: true,
            reminders: true
          },
          theme: 'auto'
        }
      });
      
      await regularUser.save();
      console.log('👤 Benutzer erstellt: user@4minitz.de / user123!');
    }

    // Check if system settings exist
    const existingSettings = await Settings.findOne({});
    
    if (!existingSettings) {
      const adminUser = await User.findOne({ role: 'admin' });
      
      const defaultSettings = new Settings({
        lastModifiedBy: adminUser?._id || new mongoose.Types.ObjectId()
      });
      
      await defaultSettings.save();
      console.log('⚙️ Standard-Systemeinstellungen erstellt');
    } else {
      console.log('⚙️ Systemeinstellungen existieren bereits');
    }

    console.log('\n✅ Database seeding erfolgreich abgeschlossen!');
    console.log('\n📋 Test-Benutzer:');
    console.log('🔐 Admin: admin@4minitz.de / admin123!');
    console.log('🔐 Moderator: moderator@4minitz.de / moderator123!');
    console.log('🔐 Benutzer: user@4minitz.de / user123!');

  } catch (error) {
    console.error('❌ Fehler beim Seeding:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB-Verbindung geschlossen');
    process.exit(0);
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;