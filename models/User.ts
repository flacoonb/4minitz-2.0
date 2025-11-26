import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface INotificationSettings {
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  sendMeetingReminders: boolean;
  reminderHoursBefore: number;
  enableDigestEmails: boolean;
  digestFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface IUser extends Document {
  _id: string;
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  lastLogin?: Date;
  notificationSettings?: INotificationSettings;
  preferences: {
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      inApp: boolean;
      reminders: boolean;
    };
    theme: 'light' | 'dark' | 'auto';
  };
  createdAt: Date;
  updatedAt: Date;

  // Methods
  comparePassword(password: string): Promise<boolean>;
  getFullName(): string;
  canManageUsers(): boolean;
  canModerateMeetings(): boolean;
}

const NotificationSettingsSchema = new Schema<INotificationSettings>({
  enableEmailNotifications: { type: Boolean, default: true },
  enablePushNotifications: { type: Boolean, default: true },
  sendMeetingReminders: { type: Boolean, default: true },
  reminderHoursBefore: { type: Number, default: 24 },
  enableDigestEmails: { type: Boolean, default: false },
  digestFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' }
}, { _id: false });

const UserSchema: Schema<IUser> = new Schema(
  {
    email: {
      type: String,
      required: [true, 'E-Mail ist erforderlich'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email: string) {
          // Allow longer TLDs (e.g. .info, .host, .local)
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(email);
        },
        message: 'Ungültige E-Mail-Adresse'
      }
    },

    username: {
      type: String,
      required: [true, 'Benutzername ist erforderlich'],
      unique: true,
      trim: true,
      minlength: [3, 'Benutzername muss mindestens 3 Zeichen lang sein'],
      maxlength: [30, 'Benutzername darf maximal 30 Zeichen lang sein'],
      validate: {
        validator: function (username: string) {
          return /^[a-zA-Z0-9._-]+$/.test(username);
        },
        message: 'Benutzername darf nur Buchstaben, Zahlen, Punkte, Unterstriche und Bindestriche enthalten'
      }
    },

    password: {
      type: String,
      required: [true, 'Passwort ist erforderlich'],
      minlength: [8, 'Passwort muss mindestens 8 Zeichen lang sein']
    },

    firstName: {
      type: String,
      required: [true, 'Vorname ist erforderlich'],
      trim: true,
      maxlength: [50, 'Vorname darf maximal 50 Zeichen lang sein']
    },

    lastName: {
      type: String,
      required: [true, 'Nachname ist erforderlich'],
      trim: true,
      maxlength: [50, 'Nachname darf maximal 50 Zeichen lang sein']
    },

    role: {
      type: String,
      enum: {
        values: ['admin', 'moderator', 'user'],
        message: 'Ungültige Rolle'
      },
      default: 'user',
      required: true
    },

    avatar: {
      type: String,
      default: null,
      validate: {
        validator: function (avatar: string) {
          if (!avatar) return true;
          return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(avatar);
        },
        message: 'Avatar muss eine gültige Bild-URL sein'
      }
    },

    isActive: {
      type: Boolean,
      default: true,
      required: true
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
      required: true
    },

    emailVerificationToken: {
      type: String,
      default: null
    },

    emailVerificationExpires: {
      type: Date,
      default: null
    },

    lastLogin: {
      type: Date,
      default: null
    },

    notificationSettings: { type: NotificationSettingsSchema, default: {} },

    preferences: {
      language: {
        type: String,
        enum: ['de', 'en'],
        default: 'de'
      },
      timezone: {
        type: String,
        default: 'Europe/Zurich'
      },
      notifications: {
        email: {
          type: Boolean,
          default: true
        },
        inApp: {
          type: Boolean,
          default: true
        },
        reminders: {
          type: Boolean,
          default: true
        }
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc: any, ret: any) {
        delete ret.password;
        return ret;
      }
    }
  }
);

// Indexes for performance (email and username already have unique indexes from schema)
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  const user = this as IUser;

  if (!user.isModified('password')) {
    return next();
  }

  try {
    const saltRounds = 12;
    user.password = await bcrypt.hash(user.password, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance Methods
UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

UserSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`.trim();
};

UserSchema.methods.canManageUsers = function (): boolean {
  return this.role === 'admin';
};

UserSchema.methods.canModerateMeetings = function (): boolean {
  return ['admin', 'moderator'].includes(this.role);
};

// Static Methods
UserSchema.statics.findActiveUsers = function () {
  return this.find({ isActive: true });
};

UserSchema.statics.findByRole = function (role: string) {
  return this.find({ role, isActive: true });
};

// Prevent model recompilation in development
const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
