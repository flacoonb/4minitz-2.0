import mongoose, { Schema, Document } from 'mongoose';

export interface RolePermissions {
  canCreateMeetings: boolean;
  canModerateAllMeetings: boolean;
  canViewAllMeetings: boolean;
  canViewAllMinutes: boolean;
  canEditAllMinutes: boolean;
  canDeleteMinutes: boolean;
  canManageUsers: boolean;
  canAssignModerators: boolean;
  canExportData: boolean;
  canAccessReports: boolean;
}

export interface ISettings extends Document {
  roles: {
    admin: RolePermissions;
    moderator: RolePermissions;
    user: RolePermissions;
  };
  memberSettings: {
    requireEmailVerification: boolean;
    allowSelfRegistration: boolean;
    defaultRole: 'user' | 'moderator';
    maxMembersPerMeeting: number;
    enableGuestAccess: boolean;
    guestLinkExpiryDays: number;
  };
  languageSettings: {
    defaultLanguage: string;
    availableLanguages: string[];
    enforceLanguage: boolean;
    enableRTL: boolean;
  };
  notificationSettings: {
    enableEmailNotifications: boolean;
    enablePushNotifications: boolean;
    sendMeetingReminders: boolean;
    reminderHoursBefore: number;
    enableDigestEmails: boolean;
    digestFrequency: 'daily' | 'weekly' | 'monthly';
  };
  systemSettings: {
    organizationName: string;
    organizationLogo?: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    enableAuditLog: boolean;
    autoLogout: {
      enabled: boolean;
      minutes: number;
    };
    maxFileUploadSize: number;
    allowedFileTypes: string[];
    baseUrl?: string;
  };
  smtpSettings?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string; // encrypted
    };
    from: string;
  };
  updatedAt: Date;
  updatedBy: string;
}

const RolePermissionsSchema = new Schema({
  canCreateMeetings: { type: Boolean, default: false },
  canModerateAllMeetings: { type: Boolean, default: false },
  canViewAllMeetings: { type: Boolean, default: false },
  canViewAllMinutes: { type: Boolean, default: false },
  canEditAllMinutes: { type: Boolean, default: false },
  canDeleteMinutes: { type: Boolean, default: false },
  canManageUsers: { type: Boolean, default: false },
  canAssignModerators: { type: Boolean, default: false },
  canExportData: { type: Boolean, default: false },
  canAccessReports: { type: Boolean, default: false }
}, { _id: false });

const SettingsSchema = new Schema<ISettings>({
  roles: {
    admin: { type: RolePermissionsSchema, required: true },
    moderator: { type: RolePermissionsSchema, required: true },
    user: { type: RolePermissionsSchema, required: true }
  },
  memberSettings: {
    requireEmailVerification: { type: Boolean, default: true },
    allowSelfRegistration: { type: Boolean, default: false },
    defaultRole: { type: String, enum: ['user', 'moderator'], default: 'user' },
    maxMembersPerMeeting: { type: Number, default: 50 },
    enableGuestAccess: { type: Boolean, default: true },
    guestLinkExpiryDays: { type: Number, default: 7 }
  },
  languageSettings: {
    defaultLanguage: { type: String, default: 'de' },
    availableLanguages: { type: [String], default: ['de', 'en'] },
    enforceLanguage: { type: Boolean, default: false },
    enableRTL: { type: Boolean, default: false }
  },
  notificationSettings: {
    enableEmailNotifications: { type: Boolean, default: true },
    enablePushNotifications: { type: Boolean, default: false },
    sendMeetingReminders: { type: Boolean, default: true },
    reminderHoursBefore: { type: Number, default: 24 },
    enableDigestEmails: { type: Boolean, default: false },
    digestFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' }
  },
  systemSettings: {
    organizationName: { type: String, default: '4Minitz' },
    organizationLogo: { type: String },
    timezone: { type: String, default: 'Europe/Berlin' },
    dateFormat: { type: String, default: 'DD.MM.YYYY' },
    timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
    enableAuditLog: { type: Boolean, default: true },
    autoLogout: {
      enabled: { type: Boolean, default: true },
      minutes: { type: Number, default: 480 }
    },
    maxFileUploadSize: { type: Number, default: 10 },
    allowedFileTypes: { type: [String], default: ['pdf', 'doc', 'docx', 'jpg', 'png'] },
    baseUrl: { type: String }
  },
  smtpSettings: {
    host: { type: String },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    auth: {
      user: { type: String },
      pass: { type: String }, // encrypted via lib/crypto
    },
    from: { type: String },
  },
  updatedBy: { type: String }
}, {
  timestamps: true
});

// Prevent model recompilation error in development
export default mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);
