'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { withAdminAuth } from '@/contexts/AuthContext';
import ConfirmationModal from '@/components/ConfirmationModal';
import { 
  Settings, 
  Users, 
  Bell, 
  Server,
  Save, 
  RotateCcw,
  Download,
  Upload,
  Database,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Crown,
  UserCog,
  User,
  Lock,
  Unlock,
  Shield,
} from 'lucide-react';

interface RolePermissions {
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

interface SystemSettings {
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
      pageFrom: string;
      pageTo: string;
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
}

type DataResetTarget = 'users' | 'minutes' | 'meeting-series' | 'all';

const AdminSettings = () => {
  const t = useTranslations('admin.settings');
  const tCommon = useTranslations('common');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'roles' | 'members' | 'language' | 'notifications' | 'system'>('roles');
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDataResetConfirm, setShowDataResetConfirm] = useState(false);
  const [pendingDataResetTarget, setPendingDataResetTarget] = useState<DataResetTarget | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const router = useRouter();

  // Available timezones
  const availableTimezones = [
    'Europe/Berlin',
    'Europe/Zurich',
    'Europe/Vienna',
    'Europe/Amsterdam',
    'Europe/Brussels',
    'Europe/London', 
    'Europe/Paris',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Prague',
    'Europe/Warsaw',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney'
  ];

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings', { credentials: 'include' });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Fehler beim Laden der Einstellungen');
      }

      const data = await response.json();
      setSettings(data.data);
      setOriginalSettings(JSON.parse(JSON.stringify(data.data)));
      setError('');
    } catch (err: any) {
      setError(err.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Check for changes (memoized to avoid re-serializing on every render)
  const settingsJson = useMemo(() => JSON.stringify(settings), [settings]);
  const originalSettingsJson = useMemo(() => JSON.stringify(originalSettings), [originalSettings]);
  useEffect(() => {
    if (settings && originalSettings) {
      setHasChanges(settingsJson !== originalSettingsJson);
    }
  }, [settingsJson, originalSettingsJson, settings, originalSettings]);

  // Initial load
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings
  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Speichern der Einstellungen');
      }

      const data = await response.json();
      setSettings(data.data);
      setOriginalSettings(JSON.parse(JSON.stringify(data.data)));
      setSuccess(t('saveSuccess'));
      setHasChanges(false);
      
      // Trigger settings update event for other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('settingsUpdated'));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const executeReset = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'reset-to-defaults' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('resetError'));
      }

      const data = await response.json();
      setSettings(data.data);
      setOriginalSettings(JSON.parse(JSON.stringify(data.data)));
      setSuccess(t('resetSuccess'));
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const downloadJsonFile = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportSettings = () => {
    if (!settings) return;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        roles: settings.roles,
        memberSettings: settings.memberSettings,
        notificationSettings: settings.notificationSettings,
        systemSettings: settings.systemSettings,
      },
    };
    downloadJsonFile(`4minitz-settings-${new Date().toISOString().slice(0, 10)}.json`, payload);
    setSuccess(t('system.exportSuccess'));
  };

  const handleImportSettingsClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportSettingsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError('');

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const imported = parsed?.settings ?? parsed;

      const requiredSections: Array<keyof Pick<SystemSettings, 'roles' | 'memberSettings' | 'notificationSettings' | 'systemSettings'>> = [
        'roles',
        'memberSettings',
        'notificationSettings',
        'systemSettings',
      ];

      const isValid = requiredSections.every((section) => imported?.[section] !== undefined);
      if (!isValid) {
        throw new Error(t('system.importInvalid'));
      }

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roles: imported.roles,
          memberSettings: imported.memberSettings,
          notificationSettings: imported.notificationSettings,
          systemSettings: imported.systemSettings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('system.importError'));
      }

      const data = await response.json();
      setSettings(data.data);
      setOriginalSettings(JSON.parse(JSON.stringify(data.data)));
      setHasChanges(false);
      setSuccess(t('system.importSuccess'));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('settingsUpdated'));
      }
    } catch (err: any) {
      setError(err.message || t('system.importError'));
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  };

  const handleDownloadBackup = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/system/backup', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t('system.backupError'));
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const fileMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const filename = fileMatch?.[1] || `4minitz-backup-${new Date().toISOString()}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setSuccess(t('system.backupSuccess'));
    } catch (err: any) {
      setError(err.message || t('system.backupError'));
    } finally {
      setSaving(false);
    }
  };

  const requestDataReset = (target: DataResetTarget) => {
    setPendingDataResetTarget(target);
    setShowDataResetConfirm(true);
  };

  const executeDataReset = async () => {
    if (!pendingDataResetTarget) return;
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/admin/system/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ target: pendingDataResetTarget }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('system.dataResetError'));
      }

      setSuccess(t(`system.dataResetSuccess.${pendingDataResetTarget}`));
    } catch (err: any) {
      setError(err.message || t('system.dataResetError'));
    } finally {
      setSaving(false);
      setShowDataResetConfirm(false);
      setPendingDataResetTarget(null);
    }
  };

  // Update role permission
  const updateRolePermission = (role: 'admin' | 'moderator' | 'user', permission: keyof RolePermissions, value: boolean) => {
    if (!settings) return;

    setSettings({
      ...settings,
      roles: {
        ...settings.roles,
        [role]: {
          ...settings.roles[role],
          [permission]: value
        }
      }
    });
  };

  // Update member settings
  const updateMemberSettings = (key: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      memberSettings: {
        ...settings.memberSettings,
        [key]: value
      }
    });
  };

  // Update notification settings
  const updateNotificationSettings = (key: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      notificationSettings: {
        ...settings.notificationSettings,
        [key]: value
      }
    });
  };

  // Update system settings
  const updateSystemSettings = (key: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      systemSettings: {
        ...settings.systemSettings,
        [key]: value
      }
    });
  };

  const updateBrandColor = (
    key: 'primary' | 'primaryDark' | 'secondary' | 'pageFrom' | 'pageTo',
    value: string
  ) => {
    if (!settings) return;
    const normalized = value.trim();
    setSettings({
      ...settings,
      systemSettings: {
        ...settings.systemSettings,
        brandColors: {
          primary: settings.systemSettings.brandColors?.primary || '#6366F1',
          primaryDark: settings.systemSettings.brandColors?.primaryDark || '#4F46E5',
          secondary: settings.systemSettings.brandColors?.secondary || '#8B5CF6',
          pageFrom: settings.systemSettings.brandColors?.pageFrom || '#F8FAFC',
          pageTo: settings.systemSettings.brandColors?.pageTo || '#F1F5F9',
          [key]: normalized,
        },
      },
    });
  };

  // Get role icon and color
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 'moderator':
        return <UserCog className="w-5 h-5 text-[var(--brand-primary)]" />;
      default:
        return <User className="w-5 h-5 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'moderator':
        return 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] border-[var(--brand-primary-border)]';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDataResetModalTitle = () => {
    if (!pendingDataResetTarget) return t('system.resetAllData');
    return t(`system.dataResetConfirmTitle.${pendingDataResetTarget}`);
  };

  const getDataResetModalMessage = () => {
    if (!pendingDataResetTarget) return t('system.dataResetConfirm');
    return t(`system.dataResetConfirmMessage.${pendingDataResetTarget}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen brand-page-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)] mb-4"></div>
          <p className="text-slate-600">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen brand-page-gradient">
        <div className="text-center">
          <p className="text-slate-600">{tCommon('error')}</p>
        </div>
      </div>
    );
  }

  const brandColors = settings.systemSettings.brandColors || {
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    secondary: '#8B5CF6',
    pageFrom: '#F8FAFC',
    pageTo: '#F1F5F9',
  };

  return (
    <div className="min-h-screen brand-page-gradient">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 brand-gradient-bg rounded-xl text-white shadow-lg">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">{t('title')}</h1>
                <p className="text-slate-600">{t('subtitle')}</p>
              </div>
            </div>
            
            <div className="hidden sm:flex sticky top-2 z-40 flex-col sm:flex-row sm:items-center gap-3 bg-white/80 backdrop-blur-sm p-2 rounded-xl border border-white/60 shadow-sm">
              {hasChanges && (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                  {t('unsavedChanges')}
                </span>
              )}
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2 min-h-11 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title={t('reset')}
              >
                <RotateCcw className="w-4 h-4" />
                {t('reset')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center justify-center gap-2 px-6 py-3 min-h-11 brand-button-primary rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {tCommon('saving')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile sticky save button */}
        <div className="sm:hidden sticky top-28 z-40 mb-4">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 min-h-11 brand-button-primary rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {tCommon('saving')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('save')}
              </>
            )}
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-wrap items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 min-w-0 flex-1 break-words">{error}</span>
            <button onClick={() => setError('')} className="ml-auto shrink-0 text-red-500 hover:text-red-700 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex flex-wrap items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-green-700 min-w-0 flex-1 break-words">{success}</span>
            <button onClick={() => setSuccess('')} className="ml-auto shrink-0 text-green-500 hover:text-green-700 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-slate-200">
            <nav className="grid grid-cols-2 sm:flex sm:overflow-x-auto">
              {[
                { key: 'roles', label: t('tabs.roles'), icon: Shield },
                { key: 'members', label: t('tabs.members'), icon: Users },
                { key: 'notifications', label: t('tabs.notifications'), icon: Bell },
                { key: 'system', label: t('tabs.system'), icon: Server }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-6 py-3 sm:py-4 min-h-11 text-xs sm:text-sm font-medium border-b-2 transition-colors leading-tight text-center sm:whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50/50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Roles & Permissions Tab */}
            {activeTab === 'roles' && (
              <div className="space-y-5 sm:space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2 sm:mb-4">{t('roles.title')}</h3>
                  <p className="text-slate-600 mb-4 sm:mb-6">
                    {t('roles.description')}
                  </p>
                </div>

                {Object.entries(settings.roles).map(([role, permissions]) => (
                  <div key={role} className="bg-slate-50 rounded-xl p-4 sm:p-6 border border-slate-200">
                    <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                      {getRoleIcon(role)}
                      <div className={`px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border ${getRoleBadgeColor(role)}`}>
                        {role === 'admin' ? t('roles.admin') : 
                         role === 'moderator' ? t('roles.moderator') : t('roles.user')}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 min-[500px]:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
                      {Object.entries(permissions).map(([permission, value]) => (
                        <label key={permission} className="flex items-start gap-2.5 p-2.5 sm:p-3 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => updateRolePermission(role as any, permission as keyof RolePermissions, e.target.checked)}
                            className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                          />
                          <div className="flex items-start gap-1.5 sm:gap-2 min-w-0">
                            {value ? 
                              <Lock className="w-4 h-4 text-green-500" /> : 
                              <Unlock className="w-4 h-4 text-slate-400" />
                            }
                            <span className="text-xs sm:text-sm font-medium text-slate-700 leading-tight break-words">
                              {t(`roles.permissions.${permission}`)}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('members.title')}</h3>
                  <p className="text-slate-600 mb-6">
                    {t('members.description')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Email Verification */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.memberSettings.requireEmailVerification}
                        onChange={(e) => updateMemberSettings('requireEmailVerification', e.target.checked)}
                        className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{t('members.requireEmailVerification')}</span>
                        <p className="text-xs text-slate-500">{t('members.requireEmailVerificationDesc')}</p>
                      </div>
                    </label>
                  </div>

                  {/* Admin Approval */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.memberSettings.requireAdminApproval}
                        onChange={(e) => updateMemberSettings('requireAdminApproval', e.target.checked)}
                        className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{t('members.requireAdminApproval')}</span>
                        <p className="text-xs text-slate-500">{t('members.requireAdminApprovalDesc')}</p>
                      </div>
                    </label>
                  </div>

                  {/* Self Registration */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.memberSettings.allowSelfRegistration}
                        onChange={(e) => updateMemberSettings('allowSelfRegistration', e.target.checked)}
                        className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{t('members.allowSelfRegistration')}</span>
                        <p className="text-xs text-slate-500">{t('members.allowSelfRegistrationDesc')}</p>
                      </div>
                    </label>
                  </div>

                  {/* Guest Access, Default Role, Max Members, Guest Link Expiry removed — not yet implemented */}
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('notifications.title')}</h3>
                  <p className="text-slate-600 mb-6">
                    {t('notifications.description')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Email Notifications */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        checked={settings.notificationSettings.enableEmailNotifications}
                        onChange={(e) => updateNotificationSettings('enableEmailNotifications', e.target.checked)}
                        className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{t('notifications.enableEmailNotifications')}</span>
                        <p className="text-xs text-slate-500">{t('notifications.enableEmailNotificationsDesc')}</p>
                      </div>
                    </label>

                    {settings.notificationSettings.enableEmailNotifications && (
                      <div className="space-y-3 ml-7">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={settings.notificationSettings.enableDigestEmails}
                            onChange={(e) => updateNotificationSettings('enableDigestEmails', e.target.checked)}
                            className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                          />
                          <span className="text-sm text-slate-700">{t('notifications.enableDigestEmails')}</span>
                        </label>

                        {settings.notificationSettings.enableDigestEmails && (
                          <select
                            value={settings.notificationSettings.digestFrequency}
                            onChange={(e) => updateNotificationSettings('digestFrequency', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                          >
                            <option value="daily">{tCommon('daily')}</option>
                            <option value="weekly">{tCommon('weekly')}</option>
                            <option value="monthly">{tCommon('monthly')}</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Push Notifications and Meeting Reminders removed — not yet implemented */}
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('system.title')}</h3>
                  <p className="text-slate-600 mb-6">
                    {t('system.description')}
                  </p>
                  <Link
                    href="/admin/templates"
                    className="inline-flex items-center gap-2 px-4 py-2 mb-4 brand-button-solid rounded-lg transition-colors"
                  >
                    {t('system.manageTemplates')}
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Organization */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('system.organizationName')}</label>
                    <input
                      type="text"
                      value={settings.systemSettings.organizationName}
                      onChange={(e) => updateSystemSettings('organizationName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                      placeholder="Name der Organisation"
                    />
                  </div>

                  {/* Base URL */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('system.baseUrl')}</label>
                    <input
                      type="text"
                      value={settings.systemSettings.baseUrl || ''}
                      onChange={(e) => updateSystemSettings('baseUrl', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                      placeholder="http://localhost:3000"
                    />
                    <p className="text-xs text-slate-500 mt-1">{t('system.baseUrlDesc')}</p>
                  </div>

                  {/* Brand Colors */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 md:col-span-2">
                    <h4 className="text-sm font-semibold text-slate-800 mb-1">{t('system.brandColorsTitle')}</h4>
                    <p className="text-xs text-slate-500 mb-4">{t('system.brandColorsDesc')}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('system.brandPrimary')}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brandColors.primary}
                            onChange={(e) => updateBrandColor('primary', e.target.value)}
                            className="h-10 w-12 rounded border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={brandColors.primary}
                            onChange={(e) => updateBrandColor('primary', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                            placeholder="#6366F1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('system.brandPrimaryDark')}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brandColors.primaryDark}
                            onChange={(e) => updateBrandColor('primaryDark', e.target.value)}
                            className="h-10 w-12 rounded border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={brandColors.primaryDark}
                            onChange={(e) => updateBrandColor('primaryDark', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                            placeholder="#4F46E5"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('system.brandSecondary')}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brandColors.secondary}
                            onChange={(e) => updateBrandColor('secondary', e.target.value)}
                            className="h-10 w-12 rounded border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={brandColors.secondary}
                            onChange={(e) => updateBrandColor('secondary', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                            placeholder="#8B5CF6"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('system.brandPageFrom')}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brandColors.pageFrom}
                            onChange={(e) => updateBrandColor('pageFrom', e.target.value)}
                            className="h-10 w-12 rounded border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={brandColors.pageFrom}
                            onChange={(e) => updateBrandColor('pageFrom', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                            placeholder="#F8FAFC"
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('system.brandPageTo')}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brandColors.pageTo}
                            onChange={(e) => updateBrandColor('pageTo', e.target.value)}
                            className="h-10 w-12 rounded border border-slate-300 bg-white p-1"
                          />
                          <input
                            type="text"
                            value={brandColors.pageTo}
                            onChange={(e) => updateBrandColor('pageTo', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                            placeholder="#F1F5F9"
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className="mt-4 p-3 rounded-lg border border-slate-200"
                      style={{ background: `linear-gradient(135deg, ${brandColors.pageFrom} 0%, #ffffff 45%, ${brandColors.pageTo} 100%)` }}
                    >
                      <div className="text-xs text-slate-600 mb-2">{t('system.brandPreview')}</div>
                      <div
                        className="h-9 rounded-md"
                        style={{ background: `linear-gradient(90deg, ${brandColors.primary} 0%, ${brandColors.secondary} 100%)` }}
                      />
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('system.timezone')}</label>
                    <select
                      value={settings.systemSettings.timezone}
                      onChange={(e) => updateSystemSettings('timezone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    >
                      {availableTimezones.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date Format */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('system.dateFormat')}</label>
                    <select
                      value={settings.systemSettings.dateFormat}
                      onChange={(e) => updateSystemSettings('dateFormat', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    >
                      <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  {/* Time Format */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('system.timeFormat')}</label>
                    <select
                      value={settings.systemSettings.timeFormat}
                      onChange={(e) => updateSystemSettings('timeFormat', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    >
                      <option value="24h">24 Stunden</option>
                      <option value="12h">12 Stunden (AM/PM)</option>
                    </select>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('members.agendaItemLabelMode')}</label>
                    <select
                      value={settings.memberSettings.agendaItemLabelMode || 'topic-alpha'}
                      onChange={(e) => updateMemberSettings('agendaItemLabelMode', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    >
                      <option value="topic-alpha">{t('members.agendaItemLabelModeTopicAlpha')}</option>
                      <option value="manual">{t('members.agendaItemLabelModeManual')}</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">{t('members.agendaItemLabelModeDesc')}</p>
                  </div>

                  {/* Auto Logout */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        checked={settings.systemSettings.autoLogout?.enabled ?? true}
                        onChange={(e) => updateSystemSettings('autoLogout', { 
                          enabled: e.target.checked, 
                          minutes: settings.systemSettings.autoLogout?.minutes ?? 480 
                        })}
                        className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{t('system.autoLogout')}</span>
                        <p className="text-xs text-slate-500">{t('system.autoLogoutDesc')}</p>
                      </div>
                    </label>

                    {(settings.systemSettings.autoLogout?.enabled ?? true) && (
                      <div className="ml-7">
                        <label className="block text-xs text-slate-600 mb-1">{t('system.autoLogoutMinutes')}</label>
                        <input
                          type="number"
                          min="5"
                          max="10080"
                          value={settings.systemSettings.autoLogout?.minutes ?? 480}
                          onChange={(e) => updateSystemSettings('autoLogout', { 
                            enabled: true, 
                            minutes: parseInt(e.target.value) 
                          })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>

                  {/* Max Upload Size */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('system.maxFileUploadSize')}</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.systemSettings.maxFileUploadSize}
                      onChange={(e) => updateSystemSettings('maxFileUploadSize', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    />
                  </div>

                  {/* Audit Log */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.systemSettings.enableAuditLog}
                        onChange={(e) => updateSystemSettings('enableAuditLog', e.target.checked)}
                        className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 rounded focus:ring-[var(--brand-primary)]"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{t('system.enableAuditLog')}</span>
                        <p className="text-xs text-slate-500">{t('system.enableAuditLogDesc')}</p>
                      </div>
                    </label>
                  </div>

                  {/* Allowed File Types */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('system.allowedFileTypes')}</label>
                    <input
                      type="text"
                      value={settings.systemSettings.allowedFileTypes.join(', ')}
                      onChange={(e) => updateSystemSettings('allowedFileTypes', e.target.value.split(',').map(s => s.trim()))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                      placeholder="pdf, doc, docx, jpg, jpeg, png"
                    />
                    <p className="text-xs text-slate-500 mt-1">{t('system.allowedFileTypesDesc')}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 md:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="w-4 h-4 text-[var(--brand-primary)]" />
                      <h4 className="text-sm font-semibold text-slate-800">{t('system.dataManagementTitle')}</h4>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">{t('system.dataManagementDesc')}</p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={handleImportSettingsFile}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <button
                        type="button"
                        onClick={handleExportSettings}
                        className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        {t('system.exportSettings')}
                      </button>
                      <button
                        type="button"
                        onClick={handleImportSettingsClick}
                        className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        {t('system.importSettings')}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadBackup}
                        className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Database className="w-4 h-4" />
                        {t('system.downloadBackup')}
                      </button>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-xs text-red-600 font-semibold mb-3">{t('system.dangerZone')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => requestDataReset('users')}
                          className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('system.resetUsers')}
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDataReset('minutes')}
                          className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('system.resetMinutes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDataReset('meeting-series')}
                          className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('system.resetMeetingSeries')}
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDataReset('all')}
                          className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 border border-red-600 rounded-lg text-white hover:bg-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('system.resetAllData')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Categories Tab removed */}
          </div>
        </div>

        <ConfirmationModal
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={() => {
            setShowResetConfirm(false);
            executeReset();
          }}
          title={t('reset')}
          message={t('resetConfirm')}
          confirmText={t('reset')}
          cancelText={tCommon('cancel')}
          isProcessing={saving}
          type="warning"
        />

        <ConfirmationModal
          isOpen={showDataResetConfirm}
          onClose={() => {
            setShowDataResetConfirm(false);
            setPendingDataResetTarget(null);
          }}
          onConfirm={executeDataReset}
          title={getDataResetModalTitle()}
          message={getDataResetModalMessage()}
          confirmText={t('system.resetNow')}
          cancelText={tCommon('cancel')}
          isProcessing={saving}
          type="danger"
        />
      </div>
    </div>
  );
};

export default withAdminAuth(AdminSettings);
