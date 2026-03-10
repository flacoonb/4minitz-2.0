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
  canManageGlobalTemplates: boolean;
  canManageSeriesTemplates: boolean;
  canUseTemplates: boolean;
}

export interface ISettings extends Document {
  roles: {
    admin: RolePermissions;
    moderator: RolePermissions;
    user: RolePermissions;
  };
  memberSettings: {
    requireEmailVerification: boolean;
    requireAdminApproval: boolean;
    allowSelfRegistration: boolean;
    agendaItemLabelMode: 'manual' | 'topic-alpha';
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
    brandColors?: {
      primary: string;
      primaryDark: string;
      secondary: string;
      accent: string;
      dashboardSeriesBadge: string;
      dashboardMinutesBadge: string;
      dashboardDraftsBadge: string;
      dashboardTasksBadge: string;
      dashboardOverdueBadge: string;
      dashboardUpcomingBadge: string;
      dashboardMinuteDraftBadge: string;
      dashboardMinuteFinalBadge: string;
      pageFrom: string;
      pageTo: string;
      surface: string;
      card: string;
      cardBorder: string;
      text: string;
      textMuted: string;
      success: string;
      warning: string;
      danger: string;
    };
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
  canAccessReports: { type: Boolean, default: false },
  canManageGlobalTemplates: { type: Boolean, default: false },
  canManageSeriesTemplates: { type: Boolean, default: false },
  canUseTemplates: { type: Boolean, default: false }
}, { _id: false });

const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{6})$/;

const SettingsSchema = new Schema<ISettings>({
  roles: {
    admin: { type: RolePermissionsSchema, required: true },
    moderator: { type: RolePermissionsSchema, required: true },
    user: { type: RolePermissionsSchema, required: true }
  },
  memberSettings: {
    requireEmailVerification: { type: Boolean, default: true },
    requireAdminApproval: { type: Boolean, default: true },
    allowSelfRegistration: { type: Boolean, default: false },
    agendaItemLabelMode: { type: String, enum: ['manual', 'topic-alpha'], default: 'topic-alpha' },
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
    organizationName: { type: String, default: 'NXTMinutes' },
    organizationLogo: { type: String },
    brandColors: {
      primary: { type: String, default: '#6366F1', match: HEX_COLOR_PATTERN },
      primaryDark: { type: String, default: '#4F46E5', match: HEX_COLOR_PATTERN },
      secondary: { type: String, default: '#8B5CF6', match: HEX_COLOR_PATTERN },
      accent: { type: String, default: '#06B6D4', match: HEX_COLOR_PATTERN },
      dashboardSeriesBadge: { type: String, default: '#06B6D4', match: HEX_COLOR_PATTERN },
      dashboardMinutesBadge: { type: String, default: '#0891B2', match: HEX_COLOR_PATTERN },
      dashboardDraftsBadge: { type: String, default: '#0E7490', match: HEX_COLOR_PATTERN },
      dashboardTasksBadge: { type: String, default: '#0F766E', match: HEX_COLOR_PATTERN },
      dashboardOverdueBadge: { type: String, default: '#0F766E', match: HEX_COLOR_PATTERN },
      dashboardUpcomingBadge: { type: String, default: '#0D9488', match: HEX_COLOR_PATTERN },
      dashboardMinuteDraftBadge: { type: String, default: '#0E7490', match: HEX_COLOR_PATTERN },
      dashboardMinuteFinalBadge: { type: String, default: '#0891B2', match: HEX_COLOR_PATTERN },
      pageFrom: { type: String, default: '#F8FAFC', match: HEX_COLOR_PATTERN },
      pageTo: { type: String, default: '#F1F5F9', match: HEX_COLOR_PATTERN },
      surface: { type: String, default: '#EEF2FF', match: HEX_COLOR_PATTERN },
      card: { type: String, default: '#FFFFFF', match: HEX_COLOR_PATTERN },
      cardBorder: { type: String, default: '#E2E8F0', match: HEX_COLOR_PATTERN },
      text: { type: String, default: '#0F172A', match: HEX_COLOR_PATTERN },
      textMuted: { type: String, default: '#64748B', match: HEX_COLOR_PATTERN },
      success: { type: String, default: '#16A34A', match: HEX_COLOR_PATTERN },
      warning: { type: String, default: '#D97706', match: HEX_COLOR_PATTERN },
      danger: { type: String, default: '#DC2626', match: HEX_COLOR_PATTERN },
    },
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
