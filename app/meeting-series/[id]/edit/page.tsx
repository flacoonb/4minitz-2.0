"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface Member {
  userId: string;
}

interface User {
  _id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
}

interface ClubFunctionEntry {
  _id: string;
  name: string;
  assignedUserId?: string;
}

interface MinutesTemplateOption {
  _id: string;
  name: string;
  scope: 'global' | 'series';
}

interface MeetingSeries {
  _id: string;
  project: string;
  name: string;
  members: Member[];
  moderators: string[];
  participants: string[];
  defaultTemplateId?: string;
}

interface FormData {
  project: string;
  name: string;
  members: Member[];
  defaultTemplateId: string;
}

export default function EditMeetingSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const t = useTranslations('meetingSeries');
  const tCommon = useTranslations('common');
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [series, setSeries] = useState<MeetingSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    project: '',
    name: '',
    members: [],
    defaultTemplateId: '',
  });

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [clubFunctions, setClubFunctions] = useState<ClubFunctionEntry[]>([]);
  const [templateOptions, setTemplateOptions] = useState<MinutesTemplateOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [existingProjectNames, setExistingProjectNames] = useState<string[]>([]);

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setSeriesId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users?limit=1000', {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setAllUsers(result.data || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer:', err);
    }
  }, []);

  const fetchClubFunctions = useCallback(async () => {
    try {
      const response = await fetch('/api/club-functions?includeInactive=true', {
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        setClubFunctions(result.data || []);
      }
    } catch {
      setClubFunctions([]);
    }
  }, []);

  const fetchSeries = useCallback(async () => {
    if (!seriesId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/meeting-series/${seriesId}`, { credentials: 'include' });

      if (!response.ok) {
        throw new Error(t('seriesNotFoundError'));
      }

      const result = await response.json();
      const seriesData = result.data;
      setSeries(seriesData);

      setFormData({
        project: seriesData.project || '',
        name: seriesData.name || '',
        members: seriesData.members || [],
        defaultTemplateId: seriesData.defaultTemplateId ? String(seriesData.defaultTemplateId) : '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadingError'));
    } finally {
      setLoading(false);
    }
  }, [seriesId, t]);

  const fetchTemplateOptions = useCallback(async () => {
    if (!seriesId) return;
    try {
      const response = await fetch(`/api/minutes-templates?meetingSeriesId=${seriesId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        setTemplateOptions([]);
        return;
      }
      const result = await response.json();
      setTemplateOptions(Array.isArray(result.data) ? result.data : []);
    } catch {
      setTemplateOptions([]);
    }
  }, [seriesId]);

  const fetchExistingNames = useCallback(async () => {
    try {
      const response = await fetch('/api/meeting-series', { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        const names = [...new Set((result.data || []).map((s: { project: string }) => s.project).filter(Boolean))] as string[];
        setExistingProjectNames(names);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (seriesId) {
      fetchSeries();
      fetchUsers();
      fetchClubFunctions();
      fetchExistingNames();
      fetchTemplateOptions();
    }
  }, [seriesId, fetchSeries, fetchUsers, fetchClubFunctions, fetchExistingNames, fetchTemplateOptions]);

  useEffect(() => {
    if (!formData.defaultTemplateId) return;
    const exists = templateOptions.some((template) => template._id === formData.defaultTemplateId);
    if (!exists) {
      setFormData((prev) => ({ ...prev, defaultTemplateId: '' }));
    }
  }, [templateOptions, formData.defaultTemplateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/meeting-series/${seriesId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          defaultTemplateId: formData.defaultTemplateId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('saveError'));
      }

      await response.json();

      router.push(`/meeting-series/${seriesId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const addMember = () => {
    if (selectedUserId && !formData.members.some(m => m.userId === selectedUserId)) {
      setFormData(prev => ({
        ...prev,
        members: [...prev.members, { userId: selectedUserId }]
      }));
      setSelectedUserId('');
    }
  };

  const removeMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
  };

  const getUserById = (userId: string): User | undefined => {
    return allUsers.find(u => u._id === userId);
  };

  const getUserFunctionLabel = (userId: string): string => {
    const names = clubFunctions
      .filter((entry) => String(entry.assignedUserId || '') === userId)
      .map((entry) => String(entry.name || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names)).join(', ');
  };

  const getUserDisplayName = (entry: User): string => {
    const fullName = `${entry.firstName} ${entry.lastName}`.trim();
    const fn = getUserFunctionLabel(entry._id);
    return fn ? `${fullName} (${fn})` : fullName;
  };

  const getAvailableUsers = (): User[] => {
    const memberUserIds = formData.members.map(m => m.userId);
    return allUsers.filter(u => !memberUserIds.includes(u._id));
  };

  if (loading) {
    return (
      <div className="min-h-screen brand-page-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (error && !series) {
    return (
      <div className="min-h-screen brand-page-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{t('errorTitle')}</h1>
          <p className="text-gray-600">{error}</p>
          <Link href="/meeting-series" className="text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] mt-4 inline-block">
            {t('backToSeries')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen brand-page-gradient py-6 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-5 sm:p-8 border border-gray-100">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Link href={`/meeting-series/${seriesId}`} className="text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{t('editSeries')}</h1>
            </div>
            <Link
              href={`/meeting-series/${seriesId}/templates`}
              className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-strong)] transition-colors text-sm font-medium"
            >
              {t('manageSeriesTemplates')}
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">{tCommon('error')}</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Sticky Save Button */}
        <div className="hidden sm:block fixed bottom-6 right-6 z-40">
          <button
            type="submit"
            form="edit-form"
            disabled={saving}
            className="px-6 py-3 brand-button-primary rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-white"
          >
            <div className="flex items-center gap-2">
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="hidden sm:inline">{saving ? t('saving') : tCommon('save')}</span>
            </div>
          </button>
        </div>

        {/* Mobile Save Button */}
        <div className="sm:hidden fixed bottom-3 inset-x-3 z-40 pb-[env(safe-area-inset-bottom)]">
          <button
            type="submit"
            form="edit-form"
            disabled={saving}
            className="w-full px-6 py-3 min-h-11 brand-button-primary rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border border-white/60"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {saving ? t('saving') : tCommon('save')}
            </span>
          </button>
        </div>

        <form id="edit-form" onSubmit={handleSubmit} className="space-y-8 pb-28 sm:pb-8">
          {/* Basic Information */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('basicInfo')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('projectRequired')}</label>
                <input
                  type="text"
                  list="existing-session-names"
                  value={formData.project}
                  onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                  placeholder={t('projectPlaceholder')}
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                  required
                />
                <datalist id="existing-session-names">
                  {existingProjectNames.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('yearOptional')}</label>
                <select
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent bg-white"
                >
                  <option value="">{t('noYear')}</option>
                  {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={String(year)}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('defaultTemplateLabel')}
                </label>
                <select
                  value={formData.defaultTemplateId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, defaultTemplateId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent bg-white"
                >
                  <option value="">{t('noDefaultTemplate')}</option>
                  {templateOptions.map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name} ({template.scope === 'global' ? t('templateGlobal') : t('templateSeries')})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{t('defaultTemplateHint')}</p>
              </div>
            </div>
          </div>

          {/* Members Management */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 brand-gradient-bg rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('members')}</h2>
            </div>

            {/* Add New Member */}
            <div className="bg-[var(--brand-primary-soft)] p-4 rounded-xl border border-[var(--brand-primary-border)] mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('addNewMember')}</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 w-full px-4 py-2 min-h-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] text-sm bg-white"
                >
                  <option value="">{t('selectUser')}</option>
                  {getAvailableUsers().map(user => (
                    <option key={user._id} value={user._id}>
                      {getUserDisplayName(user)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!selectedUserId}
                  className="w-full sm:w-auto px-6 py-2 min-h-11 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-strong)] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {t('add')}
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="space-y-3">
              {formData.members.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="font-medium">{t('noMembers')}</p>
                  <p className="text-sm mt-1">{t('noMembersHint')}</p>
                </div>
              ) : (
                formData.members.map((member, index) => {
                  const user = getUserById(member.userId);
                  return (
                    <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                      <div className="w-10 h-10 brand-gradient-bg rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {user ? user.firstName.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="flex-1">
                        {user ? (
                          <div>
                            <p className="font-semibold text-gray-900">{getUserDisplayName(user)}</p>
                            <p className="text-sm text-gray-600">{user.email}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">{t('userNotFound')} (ID: {member.userId})</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title={t('removeMember')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
