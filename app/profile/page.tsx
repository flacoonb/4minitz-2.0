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
  Settings
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

const ProfilePage = () => {
  const t = useTranslations('profile');
  const tRoles = useTranslations('admin.users.roles');
  const { updateUser } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');
  const [editMode, setEditMode] = useState(false);
  const router = useRouter();
  const preferencesDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
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

  // Helper to reset profileData from user object
  const resetProfileData = useCallback((u: UserProfile) => {
    setProfileData({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      username: u.username || '',
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
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error(t('messages.loadError'));
        }

        const userData = await response.json();
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
      setSuccess(t('messages.updateSuccess'));
      setEditMode(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
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
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg">
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-green-700">{success}</span>
            <button onClick={() => setSuccess('')} className="ml-auto text-green-500 hover:text-green-700">
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
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                      {user.firstName[0]?.toUpperCase() || user.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  {user.firstName} {user.lastName}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-3">@{user.username}</p>

                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getRoleColor(user.role)}`}>
                  <Shield className="w-4 h-4" />
                  {getRoleText(user.role)}
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Mail className="w-4 h-4" />
                    <span className={user.isEmailVerified ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                      {user.isEmailVerified ? t('profileTab.emailVerified') : t('profileTab.emailUnverified')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>{t('profileTab.memberSince', { date: new Date(user.createdAt).toLocaleDateString('de-DE') })}</span>
                  </div>
                  {user.lastLogin && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>{t('profileTab.lastLogin', { date: new Date(user.lastLogin).toLocaleDateString('de-DE') })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border border-white/50 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex">
                  {[
                    { key: 'profile', label: t('tabs.profile'), icon: User },
                    { key: 'security', label: t('tabs.security'), icon: Lock },
                    { key: 'preferences', label: t('tabs.preferences'), icon: Settings }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => handleTabSwitch(tab.key as any)}
                      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                        }`}
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
                          className="flex items-center gap-2 px-4 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
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
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500"
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
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="profile-username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profileTab.username')}</label>
                        <input
                          id="profile-username"
                          type="text"
                          value={profileData.username}
                          onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                          disabled={!editMode}
                          autoComplete="username"
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500"
                        />
                      </div>

                      <div>
                        <label htmlFor="profile-avatar" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profileTab.avatar')}</label>
                        <input
                          id="profile-avatar"
                          type="url"
                          value={profileData.avatar}
                          onChange={(e) => setProfileData({ ...profileData, avatar: e.target.value })}
                          disabled={!editMode}
                          placeholder="https://..."
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500"
                        />
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
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500"
                        />
                      </div>

                      {editMode && (
                        <div className="flex gap-3 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (user) resetProfileData(user);
                              setEditMode(false);
                            }}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                          >
                            {t('profileTab.cancel')}
                          </button>
                          <button
                            type="submit"
                            disabled={savingProfile}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
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
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('securityTab.title')}</h3>
                      <p className="text-slate-600 dark:text-slate-400">{t('securityTab.description')}</p>
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
                            className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
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
                            className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                            minLength={8}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
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
                            className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
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
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                          <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
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
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                            className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-600 rounded focus:ring-indigo-500 dark:bg-slate-800"
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
                            onChange={(e) => {
                              const newPrefs = {
                                ...preferencesData,
                                notifications: {
                                  ...preferencesData.notifications,
                                  inApp: e.target.checked
                                }
                              };
                              setPreferencesData(newPrefs);
                              updatePreferences(newPrefs);
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-600 rounded focus:ring-indigo-500 dark:bg-slate-800"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('preferencesTab.pushNotifications')}</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('preferencesTab.pushNotificationsDesc')}</p>
                          </div>
                        </label>
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