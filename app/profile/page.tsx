'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Clock,
  Edit3,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Settings,
  Copy,
  RefreshCw,
  Link2,
  Unlink,
  Upload
} from 'lucide-react';

// Demo fallback removed; use cookie/JWT auth via credentials

import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  lastLogin?: string;
  preferences: {
    language: string;
    theme: string;
    notifications: {
      email: boolean;
      inApp: boolean;
      reminders: boolean;
    };
  };
}

interface ClubFunctionEntry {
  _id: string;
  name: string;
  isActive: boolean;
  assignedUserId?: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function isLikelyChromiumPushBackendIssue(message: string): boolean {
  if (!/push service error/i.test(message)) return false;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /\bChromium\//i.test(ua) && /\bLinux\b/i.test(ua);
}

const ProfilePage = () => {
  const t = useTranslations('profile');
  const tRoles = useTranslations('admin.users.roles');
  const { updateUser } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [configuringPush, setConfiguringPush] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');
  const [editMode, setEditMode] = useState(false);
  const router = useRouter();
  const preferencesDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const calendarInlineMessageRef = useRef<HTMLDivElement | null>(null);

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    avatar: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [preferencesData, setPreferencesData] = useState({
    language: 'de',
    theme: 'light',
    notifications: {
      email: true,
      inApp: true
    }
  });
  const [calendarSubscribeUrl, setCalendarSubscribeUrl] = useState('');
  const [loadingCalendarLink, setLoadingCalendarLink] = useState(false);
  const [regeneratingCalendarLink, setRegeneratingCalendarLink] = useState(false);
  const [revokingCalendarLink, setRevokingCalendarLink] = useState(false);
  const [calendarInlineMessage, setCalendarInlineMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assignedFunctionNames, setAssignedFunctionNames] = useState<string[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper to reset profileData from user object
  const resetProfileData = useCallback((u: UserProfile) => {
    setProfileData({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      avatar: u.avatar || ''
    });
  }, []);

  // Load user data from AuthContext or fetch
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(t('messages.loadError'));
        }

        const userData = await response.json();
        if (!userData?.data) {
          router.push('/auth/login');
          return;
        }

        setUser(userData.data);
        resetProfileData(userData.data);

        if (userData.data.preferences) {
          setPreferencesData({
            language: userData.data.preferences.language || 'de',
            theme: userData.data.preferences.theme || 'light',
            notifications: {
              email: userData.data.preferences.notifications?.email ?? true,
              inApp: userData.data.preferences.notifications?.inApp ?? true
            }
          });
        }
      } catch (err: any) {
        setError(err.message || t('messages.loadError'));
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router, t, resetProfileData]);

  useEffect(() => {
    const loadAssignedFunctions = async () => {
      if (!user?._id) {
        setAssignedFunctionNames([]);
        return;
      }

      try {
        const response = await fetch('/api/club-functions?includeInactive=true', {
          credentials: 'include',
        });
        if (!response.ok) {
          setAssignedFunctionNames([]);
          return;
        }
        const payload = await response.json().catch(() => ({}));
        const entries: ClubFunctionEntry[] = Array.isArray(payload?.data) ? payload.data : [];
        const matches = entries.filter((entry) => String(entry.assignedUserId || '') === user._id);
        const activeNames = matches
          .filter((entry) => entry.isActive)
          .map((entry) => String(entry.name || '').trim())
          .filter(Boolean);
        const fallbackNames = matches
          .map((entry) => String(entry.name || '').trim())
          .filter(Boolean);
        const names = activeNames.length > 0 ? activeNames : fallbackNames;
        setAssignedFunctionNames(Array.from(new Set(names)));
      } catch {
        setAssignedFunctionNames([]);
      }
    };

    loadAssignedFunctions();
  }, [user?._id]);

  // Clear error/success when switching tabs
  const handleTabSwitch = useCallback((tab: 'profile' | 'security' | 'preferences') => {
    setError('');
    setSuccess('');
    setActiveTab(tab);
  }, []);

  // Update profile
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setError('');
    setSuccess('');

    try {
      // Send avatar as null if empty string
      const payload = {
        ...profileData,
        avatar: profileData.avatar || null
      };

      const response = await fetch(`/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('messages.updateError'));
      }

      const updatedUser = await response.json();
      setUser(updatedUser.data);
      updateUser(updatedUser.data);
      setSuccess(updatedUser.message || t('messages.updateSuccess'));
      setEditMode(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarFileUpload = async (file: File) => {
    if (!editMode) return;
    setError('');
    setSuccess('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.url) {
        throw new Error(result?.error || t('messages.avatarUploadError'));
      }

      setProfileData((prev) => ({ ...prev, avatar: result.url }));
      setSuccess(t('messages.avatarUploaded'));
    } catch (err: any) {
      setError(err.message || t('messages.avatarUploadError'));
    } finally {
      setUploadingAvatar(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    }
  };

  // Update password
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('messages.passwordMismatch'));
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError(t('messages.passwordTooShort'));
      return;
    }

    setSavingPassword(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          password: passwordData.newPassword,
          currentPassword: passwordData.currentPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('messages.passwordError'));
      }

      setSuccess(t('messages.passwordSuccess'));
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  // Update preferences (debounced)
  const updatePreferences = useCallback((newPreferences: typeof preferencesData) => {
    if (!user) return;

    if (preferencesDebounceRef.current) {
      clearTimeout(preferencesDebounceRef.current);
    }

    preferencesDebounceRef.current = setTimeout(async () => {
      setSavingPreferences(true);
      setError('');
      setSuccess('');

      try {
        const response = await fetch(`/api/users/${user._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ preferences: newPreferences })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t('messages.preferencesError'));
        }

        const updatedUser = await response.json();
        setUser(updatedUser.data);
        updateUser(updatedUser.data);
        setSuccess(t('messages.preferencesSuccess'));

        // Update locale cookie and reload if language changed
        if (newPreferences.language !== user.preferences.language) {
          document.cookie = `NEXT_LOCALE=${newPreferences.language}; path=/; max-age=31536000; SameSite=Lax`;
          router.refresh();
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSavingPreferences(false);
      }
    }, 300);
  }, [user, t, router, updateUser]);

  const subscribePushNotifications = useCallback(async () => {
    if (typeof window === 'undefined') {
      throw new Error(t('messages.pushNotSupported'));
    }

    if (!window.isSecureContext) {
      throw new Error(t('messages.pushRequiresHttps'));
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error(t('messages.pushServiceWorkerMissing'));
    }

    if (!('PushManager' in window)) {
      throw new Error(t('messages.pushManagerMissing'));
    }

    if (!('Notification' in window)) {
      throw new Error(t('messages.pushNotificationApiMissing'));
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error(t('messages.pushPermissionDenied'));
    }

    const keyResponse = await fetch('/api/push/public-key', {
      credentials: 'include',
    });

    const keyData = await keyResponse.json().catch(() => ({}));
    if (!keyResponse.ok || typeof keyData?.publicKey !== 'string') {
      throw new Error(keyData?.error || t('messages.pushConfigError'));
    }

    await navigator.serviceWorker.register('/sw.js');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    const applicationServerKey = urlBase64ToUint8Array(String(keyData.publicKey).trim()) as unknown as BufferSource;

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } catch (_subscribeError: any) {
        // Retry once after removing a potentially stale browser subscription.
        const staleSubscription = await registration.pushManager.getSubscription().catch(() => null);
        if (staleSubscription) {
          await staleSubscription.unsubscribe().catch(() => {});
        }

        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        } catch (retryError: any) {
          const retryMessage = String(retryError?.message || '');
          console.error('Push subscription failed:', retryError);
          if (/push service error/i.test(retryMessage)) {
            if (isLikelyChromiumPushBackendIssue(retryMessage)) {
              throw new Error(t('messages.pushServiceUnavailableChromium'));
            }
            throw new Error(t('messages.pushServiceUnavailable'));
          }
          if (/InvalidAccessError|applicationServerKey/i.test(retryMessage)) {
            throw new Error(t('messages.pushInvalidVapid'));
          }
          throw retryError;
        }
      }
    }

    const saveResponse = await fetch('/api/push/subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });

    if (!saveResponse.ok) {
      const errorData = await saveResponse.json().catch(() => ({}));
      throw new Error(errorData?.error || t('messages.pushSubscribeError'));
    }
  }, [t]);

  const loadCalendarSubscriptionLink = useCallback(async () => {
    setLoadingCalendarLink(true);
    try {
      const response = await fetch('/api/users/me/calendar-subscription', {
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || t('messages.loadError'));
      }
      const subscribeUrl = String(payload?.data?.subscribeUrl || '');
      setCalendarSubscribeUrl(subscribeUrl);
    } catch (err: any) {
      setError(err?.message || t('messages.loadError'));
    } finally {
      setLoadingCalendarLink(false);
    }
  }, [t]);

  useEffect(() => {
    if (activeTab !== 'preferences') return;
    if (calendarSubscribeUrl || loadingCalendarLink) return;
    loadCalendarSubscriptionLink();
  }, [activeTab, calendarSubscribeUrl, loadingCalendarLink, loadCalendarSubscriptionLink]);

  const handleRegenerateCalendarLink = useCallback(async () => {
    setRegeneratingCalendarLink(true);
    setError('');
    setSuccess('');
    setCalendarInlineMessage(null);
    try {
      const response = await fetch('/api/users/me/calendar-subscription', {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || t('messages.updateError'));
      }
      const subscribeUrl = String(payload?.data?.subscribeUrl || '');
      setCalendarSubscribeUrl(subscribeUrl);
      setSuccess(t('preferencesTab.calendar.messages.regenerated'));
      setCalendarInlineMessage({ type: 'success', text: t('preferencesTab.calendar.messages.regenerated') });
    } catch (err: any) {
      setError(err?.message || t('messages.updateError'));
      setCalendarInlineMessage({ type: 'error', text: err?.message || t('messages.updateError') });
    } finally {
      setRegeneratingCalendarLink(false);
    }
  }, [t]);

  const handleCopyCalendarLink = useCallback(async () => {
    if (!calendarSubscribeUrl) return;
    try {
      await navigator.clipboard.writeText(calendarSubscribeUrl);
      setCalendarInlineMessage({ type: 'success', text: t('preferencesTab.calendar.messages.copied') });
    } catch {
      setError(t('preferencesTab.calendar.messages.copyError'));
      setCalendarInlineMessage({ type: 'error', text: t('preferencesTab.calendar.messages.copyError') });
    }
  }, [calendarSubscribeUrl, t]);

  useEffect(() => {
    if (!calendarInlineMessage || !calendarInlineMessageRef.current) return;
    calendarInlineMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [calendarInlineMessage]);

  const handleRevokeCalendarLink = useCallback(async () => {
    setRevokingCalendarLink(true);
    setError('');
    setSuccess('');
    setCalendarInlineMessage(null);
    try {
      const response = await fetch('/api/users/me/calendar-subscription', {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || t('messages.updateError'));
      }
      setCalendarSubscribeUrl('');
      setSuccess(t('preferencesTab.calendar.messages.revoked'));
      setCalendarInlineMessage({ type: 'success', text: t('preferencesTab.calendar.messages.revoked') });
    } catch (err: any) {
      setError(err?.message || t('messages.updateError'));
      setCalendarInlineMessage({ type: 'error', text: err?.message || t('messages.updateError') });
    } finally {
      setRevokingCalendarLink(false);
    }
  }, [t]);

  const unsubscribePushNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      await fetch('/api/push/subscription', {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
      return;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      await fetch('/api/push/subscription', {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
      return;
    }

    await fetch('/api/push/subscription', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});

    await subscription.unsubscribe().catch(() => {});
  }, []);

  const handlePushToggle = useCallback(async (enabled: boolean) => {
    if (!user) return;

    setError('');
    setSuccess('');
    setConfiguringPush(true);

    try {
      if (enabled) {
        await subscribePushNotifications();
      } else {
        await unsubscribePushNotifications();
      }

      const newPreferences = {
        ...preferencesData,
        notifications: {
          ...preferencesData.notifications,
          inApp: enabled,
        },
      };

      setPreferencesData(newPreferences);
      updatePreferences(newPreferences);
    } catch (err: any) {
      setError(err?.message || t('messages.pushToggleError'));
    } finally {
      setConfiguringPush(false);
    }
  }, [user, preferencesData, subscribePushNotifications, unsubscribePushNotifications, t, updatePreferences]);

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return tRoles('admin');
      case 'moderator':
        return tRoles('moderator');
      default:
        return tRoles('user');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-yellow-600 bg-yellow-100';
      case 'moderator':
        return 'text-[var(--brand-primary-strong)] bg-[var(--brand-primary-soft)]';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const functionDisplay = assignedFunctionNames.length > 0
    ? assignedFunctionNames.join(', ')
    : t('profileTab.noFunctionAssigned');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)] mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">{t('notFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 brand-gradient-bg rounded-xl text-white shadow-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{t('title')}</h1>
              <p className="text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
            </div>
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Profile Overview Card */}
          <div className="lg:col-span-1">
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-white/50 dark:border-slate-800 rounded-xl p-6 shadow-lg">
              <div className="text-center">
                {/* Avatar */}
                <div className="relative inline-block mb-4">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={`${user.firstName} ${user.lastName}`}
                      width={96}
                      height={96}
                      className="w-24 h-24 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-24 h-24 brand-gradient-bg rounded-full flex items-center justify-center text-white font-bold text-2xl">
                      {user.firstName[0]?.toUpperCase() || user.email[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--brand-text)' }}>
                  {user.firstName} {user.lastName}
                </h2>
                <p className="mb-3 app-text-muted">
                  {t('profileTab.function')}: {functionDisplay}
                </p>

                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getRoleColor(user.role)}`}>
                  <Shield className="w-4 h-4" />
                  {getRoleText(user.role)}
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center gap-2 app-text-muted">
                    <Mail className="w-4 h-4" />
                    <span className={user.isEmailVerified ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                      {user.isEmailVerified ? t('profileTab.emailVerified') : t('profileTab.emailUnverified')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 app-text-muted">
                    <Calendar className="w-4 h-4" />
                    <span>{t('profileTab.memberSince', { date: new Date(user.createdAt).toLocaleDateString() })}</span>
                  </div>
                  {user.lastLogin && (
                    <div className="flex items-center gap-2 app-text-muted">
                      <Clock className="w-4 h-4" />
                      <span>{t('profileTab.lastLogin', { date: new Date(user.lastLogin).toLocaleDateString() })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="app-card rounded-xl shadow-lg overflow-hidden">
              <div className="border-b" style={{ borderColor: 'var(--brand-card-border)' }}>
                <nav className="grid grid-cols-3 sm:flex sm:overflow-x-auto">
                  {[
                    { key: 'profile', label: t('tabs.profile'), icon: User },
                    { key: 'security', label: t('tabs.security'), icon: Lock },
                    { key: 'preferences', label: t('tabs.preferences'), icon: Settings }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => handleTabSwitch(tab.key as any)}
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-6 py-3 sm:py-4 min-h-11 text-xs sm:text-sm font-medium border-b-2 transition-colors leading-tight text-center sm:whitespace-nowrap ${activeTab === tab.key
                        ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] dark:text-[var(--brand-primary)] bg-[var(--brand-primary-soft)] dark:bg-[var(--brand-primary-soft)]'
                        : 'border-transparent hover:bg-[var(--brand-surface-soft)]'
                        }`}
                      style={activeTab !== tab.key ? { color: 'var(--brand-text-muted)' } : undefined}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t('profileTab.title')}</h3>
                      {!editMode && (
                        <button
                          onClick={() => setEditMode(true)}
                          className="flex items-center gap-2 px-4 py-2 min-h-11 text-[var(--brand-primary)] dark:text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] dark:hover:bg-[var(--brand-primary-soft)] rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                          {t('profileTab.edit')}
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="profile-firstName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profileTab.firstName')}</label>
                          <input
                            id="profile-firstName"
                            type="text"
                            value={profileData.firstName}
                            onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                            disabled={!editMode}
                            autoComplete="given-name"
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent disabled:opacity-70"
                            style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                          />
                        </div>
                        <div>
                          <label htmlFor="profile-lastName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profileTab.lastName')}</label>
                          <input
                            id="profile-lastName"
                            type="text"
                            value={profileData.lastName}
                            onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                            disabled={!editMode}
                            autoComplete="family-name"
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent disabled:opacity-70"
                            style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="profile-function" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profileTab.function')}</label>
                        <input
                          id="profile-function"
                          type="text"
                          value={functionDisplay}
                          readOnly
                          disabled
                          className="w-full px-4 py-3 border rounded-lg disabled:opacity-70"
                          style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-surface-soft)', color: 'var(--brand-text-muted)' }}
                        />
                      </div>

                      <div>
                        <label htmlFor="profile-avatar" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profileTab.avatar')}</label>
                        <div className="space-y-3">
                          <input
                            id="profile-avatar"
                            type="text"
                            value={profileData.avatar}
                            onChange={(e) => setProfileData({ ...profileData, avatar: e.target.value })}
                            disabled={!editMode}
                            placeholder="https://... oder /api/uploads/avatars/..."
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent disabled:opacity-70"
                            style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                          />
                          {editMode && (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <input
                                ref={avatarFileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/gif,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleAvatarFileUpload(file);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => avatarFileInputRef.current?.click()}
                                disabled={uploadingAvatar}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-11 rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] border border-[var(--brand-primary-border)] hover:brightness-95 transition-colors disabled:opacity-60"
                              >
                                {uploadingAvatar ? (
                                  <div className="w-4 h-4 border-2 border-[var(--brand-primary-border)] border-t-[var(--brand-primary)] rounded-full animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4" />
                                )}
                                {uploadingAvatar ? t('profileTab.avatarUploading') : t('profileTab.avatarUpload')}
                              </button>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t('profileTab.avatarUploadHint')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profileTab.email')}</label>
                        <input
                          id="profile-email"
                          type="email"
                          value={profileData.email}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          disabled={!editMode}
                          autoComplete="email"
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500"
                        />
                      </div>

                      {editMode && (
                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (user) resetProfileData(user);
                              setEditMode(false);
                            }}
                            className="px-4 py-2 min-h-11 rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--brand-surface-soft)', color: 'var(--brand-text)' }}
                          >
                            {t('profileTab.cancel')}
                          </button>
                          <button
                            type="submit"
                            disabled={savingProfile}
                            className="px-4 py-2 min-h-11 brand-button-primary text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {savingProfile ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                {t('profileTab.saving')}
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                {t('profileTab.save')}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </form>
                  </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>{t('securityTab.title')}</h3>
                      <p className="app-text-muted">{t('securityTab.description')}</p>
                    </div>

                    <form onSubmit={handlePasswordUpdate} className="space-y-6">
                      <div>
                        <label htmlFor="security-currentPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('securityTab.currentPassword')}</label>
                        <div className="relative">
                          <input
                            id="security-currentPassword"
                            type={showPasswords.current ? 'text' : 'password'}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            autoComplete="current-password"
                            className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg"
                          >
                            {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="security-newPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('securityTab.newPassword')}</label>
                        <div className="relative">
                          <input
                            id="security-newPassword"
                            type={showPasswords.new ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            autoComplete="new-password"
                            className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                            required
                            minLength={8}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg"
                          >
                            {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="security-confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('securityTab.confirmPassword')}</label>
                        <div className="relative">
                          <input
                            id="security-confirmPassword"
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            autoComplete="new-password"
                            className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg"
                          >
                            {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="px-6 py-3 min-h-11 brand-button-primary text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {savingPassword ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {t('securityTab.changingPassword')}
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            {t('securityTab.changePassword')}
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* Preferences Tab */}
                {activeTab === 'preferences' && (
                  <div>
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('preferencesTab.title')}</h3>
                        <p className="text-slate-600 dark:text-slate-400">{t('preferencesTab.description')}</p>
                      </div>
                      {savingPreferences && (
                        <div className="flex items-center gap-2 text-[var(--brand-primary)] dark:text-[var(--brand-primary)] text-sm font-medium">
                          <div className="w-4 h-4 border-2 border-[var(--brand-primary-border)] border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
                          {t('preferencesTab.saving')}
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('preferencesTab.language')}</label>
                          <select
                            value={preferencesData.language}
                            onChange={(e) => {
                              const newPrefs = { ...preferencesData, language: e.target.value };
                              setPreferencesData(newPrefs);
                              updatePreferences(newPrefs);
                            }}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                          >
                            <option value="de">Deutsch</option>
                            <option value="en">English</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('preferencesTab.theme')}</label>
                          <select
                            value={preferencesData.theme}
                            onChange={(e) => {
                              const newPrefs = { ...preferencesData, theme: e.target.value };
                              setPreferencesData(newPrefs);
                              updatePreferences(newPrefs);
                            }}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                          >
                            <option value="light">{t('preferencesTab.themes.light')}</option>
                            <option value="dark">{t('preferencesTab.themes.dark')}</option>
                            <option value="auto">{t('preferencesTab.themes.auto')}</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-md font-semibold text-slate-800 dark:text-slate-200">{t('preferencesTab.notifications')}</h4>

                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={preferencesData.notifications.email}
                            onChange={(e) => {
                              const newPrefs = {
                                ...preferencesData,
                                notifications: {
                                  ...preferencesData.notifications,
                                  email: e.target.checked
                                }
                              };
                              setPreferencesData(newPrefs);
                              updatePreferences(newPrefs);
                            }}
                            className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 dark:border-slate-600 rounded focus:ring-[var(--brand-primary)] dark:bg-slate-800"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('preferencesTab.emailNotifications')}</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('preferencesTab.emailNotificationsDesc')}</p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={preferencesData.notifications.inApp}
                            disabled={configuringPush || savingPreferences}
                            onChange={(e) => handlePushToggle(e.target.checked)}
                            className="w-4 h-4 text-[var(--brand-primary)] border-slate-300 dark:border-slate-600 rounded focus:ring-[var(--brand-primary)] dark:bg-slate-800"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('preferencesTab.pushNotifications')}</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('preferencesTab.pushNotificationsDesc')}</p>
                          </div>
                        </label>
                      </div>

                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-[var(--brand-primary-soft)] dark:bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] dark:text-[var(--brand-primary)]">
                            <Link2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-md font-semibold text-slate-800 dark:text-slate-200">
                              {t('preferencesTab.calendar.title')}
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {t('preferencesTab.calendar.description')}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('preferencesTab.calendar.linkLabel')}
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={calendarSubscribeUrl}
                            placeholder={loadingCalendarLink ? t('loading') : t('preferencesTab.calendar.noLinkYet')}
                            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={handleCopyCalendarLink}
                            disabled={!calendarSubscribeUrl}
                            className="px-4 py-2 min-h-11 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            {t('preferencesTab.calendar.copy')}
                          </button>
                          <button
                            type="button"
                            onClick={handleRegenerateCalendarLink}
                            disabled={regeneratingCalendarLink}
                            className="px-4 py-2 min-h-11 rounded-lg brand-button-primary text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
                          >
                            {regeneratingCalendarLink ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            {t('preferencesTab.calendar.regenerate')}
                          </button>
                          <button
                            type="button"
                            onClick={handleRevokeCalendarLink}
                            disabled={revokingCalendarLink || !calendarSubscribeUrl}
                            className="px-4 py-2 min-h-11 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                          >
                            {revokingCalendarLink ? (
                              <div className="w-4 h-4 border-2 border-red-300/40 border-t-red-500 rounded-full animate-spin"></div>
                            ) : (
                              <Unlink className="w-4 h-4" />
                            )}
                            {t('preferencesTab.calendar.revoke')}
                          </button>
                        </div>

                        {calendarInlineMessage && (
                          <div
                            ref={calendarInlineMessageRef}
                            className={`text-sm rounded-lg px-3 py-2 border ${
                              calendarInlineMessage.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}
                          >
                            {calendarInlineMessage.text}
                          </div>
                        )}

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t('preferencesTab.calendar.note')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
