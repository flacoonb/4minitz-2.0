import mongoose, { Document, Schema } from 'mongoose';

// Interface for role permissions
interface IRolePermissions {
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

// Interface for member settings
interface IMemberSettings {
  requireEmailVerification: boolean;
  allowSelfRegistration: boolean;
  defaultRole: 'user' | 'moderator';
  maxMembersPerMeeting: number;
  enableGuestAccess: boolean;
  guestLinkExpiryDays: number;
}

// Interface for language settings
interface ILanguageSettings {
  defaultLanguage: string;
  availableLanguages: string[];
  enforceLanguage: boolean;
  enableRTL: boolean;
}

// Interface for notification settings
interface INotificationSettings {
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  sendMeetingReminders: boolean;
  reminderHoursBefore: number;
  enableDigestEmails: boolean;
  digestFrequency: 'daily' | 'weekly' | 'monthly';
}

// Interface for system settings
interface ISystemSettings {
  organizationName: string;
  organizationLogo?: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  enableAuditLog: boolean;
  sessionTimeout: number; // in minutes
  maxFileUploadSize: number; // in MB
  allowedFileTypes: string[];
  baseUrl: string;
}

// Main settings interface
export interface ISettings extends Document {
  // Role definitions with permissions
  roles: {
    admin: IRolePermissions;
    moderator: IRolePermissions;
    user: IRolePermissions;
  };

  // Member management settings
  memberSettings: IMemberSettings;

  // Language and localization
  languageSettings: ILanguageSettings;

  // Notification settings
  notificationSettings: INotificationSettings;

  // System configuration
  systemSettings: ISystemSettings;

  // SMTP Configuration
  smtpSettings: ISMTPSettings;

  // Metadata
  lastModifiedBy: mongoose.Types.ObjectId;
  lastModified: Date;
  version: number;
}

// Default role permissions
const defaultRolePermissions = {
  admin: {
    canCreateMeetings: true,
    canModerateAllMeetings: true,
    canViewAllMeetings: true,
    canViewAllMinutes: true,
    canEditAllMinutes: true,
    canDeleteMinutes: true,
    canManageUsers: true,
    canAssignModerators: true,
    canExportData: true,
    canAccessReports: true
  },
  moderator: {
    canCreateMeetings: true,
    canModerateAllMeetings: false,
    canViewAllMeetings: true,
    canViewAllMinutes: false,
    canEditAllMinutes: false,
    canDeleteMinutes: false,
    canManageUsers: false,
    canAssignModerators: false,
    canExportData: true,
    canAccessReports: false
  },
  user: {
    canCreateMeetings: false,
    canModerateAllMeetings: false,
    canViewAllMeetings: false,
    canViewAllMinutes: false,
    canEditAllMinutes: false,
    canDeleteMinutes: false,
    canManageUsers: false,
    canAssignModerators: false,
    canExportData: false,
    canAccessReports: false
  }
};

// Permission schema
const PermissionSchema = new Schema<IRolePermissions>({
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

// Member settings schema
const MemberSettingsSchema = new Schema<IMemberSettings>({
  requireEmailVerification: { type: Boolean, default: true },
  allowSelfRegistration: { type: Boolean, default: true },
  defaultRole: { type: String, enum: ['user', 'moderator'], default: 'user' },
  maxMembersPerMeeting: { type: Number, default: 50 },
  enableGuestAccess: { type: Boolean, default: false },
  guestLinkExpiryDays: { type: Number, default: 7 }
}, { _id: false });

// Language settings schema
const LanguageSettingsSchema = new Schema<ILanguageSettings>({
  defaultLanguage: { type: String, default: 'de' },
  availableLanguages: { type: [String], default: ['de', 'en'] },
  enforceLanguage: { type: Boolean, default: false },
  enableRTL: { type: Boolean, default: false }
}, { _id: false });

// Notification settings schema
const NotificationSettingsSchema = new Schema<INotificationSettings>({
  enableEmailNotifications: { type: Boolean, default: true },
  enablePushNotifications: { type: Boolean, default: true },
  sendMeetingReminders: { type: Boolean, default: true },
  reminderHoursBefore: { type: Number, default: 24 },
  enableDigestEmails: { type: Boolean, default: false },
  digestFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' }
}, { _id: false });

// System settings schema
const SystemSettingsSchema = new Schema<ISystemSettings>({
  organizationName: { type: String, default: '4Minitz' },
  organizationLogo: { type: String },
  timezone: { type: String, default: 'Europe/Berlin' },
  dateFormat: { type: String, default: 'DD.MM.YYYY' },
  timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
  enableAuditLog: { type: Boolean, default: true },
  sessionTimeout: { type: Number, default: 480 }, // 8 hours
  maxFileUploadSize: { type: Number, default: 10 }, // 10MB
  allowedFileTypes: { type: [String], default: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] },
  baseUrl: { type: String, default: 'http://localhost:3000' }
}, { _id: false });

// Interface for SMTP settings
interface ISMTPSettings {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

// SMTP settings schema
const SMTPSettingsSchema = new Schema<ISMTPSettings>({
  host: { type: String, default: 'localhost' },
  port: { type: Number, default: 587 },
  secure: { type: Boolean, default: false },
  auth: {
    user: { type: String, default: '' },
    pass: { type: String, default: '' }
  },
  from: { type: String, default: 'noreply@4minitz.local' }
}, { _id: false });

// Main settings schema
const SettingsSchema = new Schema<ISettings>({
  roles: {
    admin: { type: PermissionSchema, default: defaultRolePermissions.admin },
    moderator: { type: PermissionSchema, default: defaultRolePermissions.moderator },
    user: { type: PermissionSchema, default: defaultRolePermissions.user }
  },
  memberSettings: { type: MemberSettingsSchema, default: {} },
  languageSettings: { type: LanguageSettingsSchema, default: {} },
  notificationSettings: { type: NotificationSettingsSchema, default: {} },
  systemSettings: { type: SystemSettingsSchema, default: {} },
  smtpSettings: { type: SMTPSettingsSchema, default: {} },
  lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastModified: { type: Date, default: Date.now },
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  collection: 'settings'
});

// Indexes
SettingsSchema.index({ lastModified: -1 });
SettingsSchema.index({ version: -1 });

// Pre-save middleware to update version and lastModified
SettingsSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
    this.lastModified = new Date();
  }
  next();
});

// Instance methods
SettingsSchema.methods.hasPermission = function (role: string, permission: string): boolean {
  const rolePermissions = this.roles[role as keyof typeof this.roles];
  return rolePermissions ? rolePermissions[permission as keyof IRolePermissions] : false;
};

SettingsSchema.methods.updateSettings = function (settingsData: Partial<ISettings>, userId: string) {
  Object.assign(this, settingsData);
  this.lastModifiedBy = userId;
  this.lastModified = new Date();
  return this.save();
};

// Static methods
SettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({}).sort({ version: -1 });

  if (!settings) {
    // Create default settings if none exist
    settings = new this({
      lastModifiedBy: new mongoose.Types.ObjectId(), // Will be replaced by actual admin user
      roles: defaultRolePermissions
    });
    await settings.save();
  }

  return settings;
};

SettingsSchema.statics.updateSystemSettings = async function (settingsData: Partial<ISettings>, userId: string) {
  const settings = await this.findOne({}).sort({ version: -1 });
  if (!settings) {
    throw new Error('Settings not found');
  }
  return settings.updateSettings(settingsData, userId);
};

// Create and export the model
const Settings = mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings;