"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
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

interface PdfTemplateOption {
  _id: string;
  name: string;
  isActive?: boolean;
}

export default function NewMeetingSeriesPage() {
  const t = useTranslations('meetingSeriesNew');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    project: '',
    name: '',
    description: '',
    defaultTemplateId: '',
    defaultPdfTemplateId: '',
    participants: [] as string[],
    informedUsers: [] as string[],
    members: [] as Member[],
  });

  // Users list
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [clubFunctions, setClubFunctions] = useState<ClubFunctionEntry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Existing session names for autocomplete
  const [existingProjectNames, setExistingProjectNames] = useState<string[]>([]);

  // Existing series for task import
  const [existingSeries, setExistingSeries] = useState<{ _id: string; project: string; name?: string }[]>([]);
  const [templateOptions, setTemplateOptions] = useState<MinutesTemplateOption[]>([]);
  const [pdfTemplateOptions, setPdfTemplateOptions] = useState<PdfTemplateOption[]>([]);
  const [sourceSeriesId, setSourceSeriesId] = useState<string>('');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Input states for adding participants/informed users (kept for backward compatibility)
  const [newParticipant, setNewParticipant] = useState('');
  const [newInformedUser, setNewInformedUser] = useState('');

  // Check permissions
  useEffect(() => {
    if (!authLoading && (!user || user.role === 'user')) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role !== 'user') {
      fetchUsers();
      fetchClubFunctions();
      fetchExistingNames();
      fetchTemplateOptions();
      fetchPdfTemplateOptions();
    }
  }, [user]);

  const fetchExistingNames = async () => {
    try {
      const response = await fetch('/api/meeting-series', { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        const series = (result.data || []) as { _id: string; project: string; name?: string }[];
        const names = [...new Set(series.map((s) => s.project).filter(Boolean))] as string[];
        setExistingProjectNames(names);
        setExistingSeries(series);
      }
    } catch {
      // ignore
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users?limit=1000', {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setAllUsers(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchTemplateOptions = async () => {
    try {
      const response = await fetch('/api/minutes-templates?scope=global', {
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
  };

  const fetchPdfTemplateOptions = async () => {
    try {
      const response = await fetch('/api/pdf-templates', {
        credentials: 'include',
      });

      if (!response.ok) {
        setPdfTemplateOptions([]);
        return;
      }

      const result = await response.json();
      setPdfTemplateOptions(Array.isArray(result.data) ? result.data : []);
    } catch {
      setPdfTemplateOptions([]);
    }
  };

  const fetchClubFunctions = async () => {
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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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

  const addMember = () => {
    if (selectedUserId && !formData.members.some(m => m.userId === selectedUserId)) {
      setFormData(prev => ({
        ...prev,
        members: [...prev.members, { userId: selectedUserId }]
      }));
      setSelectedUserId('');
    }
  };

  const removeMember = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter(m => m.userId !== userId),
    }));
  };

  const addParticipant = () => {
    if (newParticipant.trim() && !formData.participants.includes(newParticipant.trim())) {
      setFormData(prev => ({
        ...prev,
        participants: [...prev.participants, newParticipant.trim()]
      }));
      setNewParticipant('');
    }
  };

  const removeParticipant = (participant: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participant)
    }));
  };

  const addInformedUser = () => {
    if (newInformedUser.trim() && !formData.informedUsers.includes(newInformedUser.trim())) {
      setFormData(prev => ({
        ...prev,
        informedUsers: [...prev.informedUsers, newInformedUser.trim()]
      }));
      setNewInformedUser('');
    }
  };

  const removeInformedUser = (user: string) => {
    setFormData(prev => ({
      ...prev,
      informedUsers: prev.informedUsers.filter(u => u !== user)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/meeting-series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          defaultTemplateId: formData.defaultTemplateId,
          defaultPdfTemplateId: formData.defaultPdfTemplateId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create meeting series');
      }

      const result = await response.json();
      const newSeriesId = result.data._id;

      // Import tasks from source series if selected
      if (sourceSeriesId) {
        try {
          const importRes = await fetch(`/api/meeting-series/${newSeriesId}/import-tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sourceSeriesId }),
          });
          if (importRes.ok) {
            const importResult = await importRes.json();
            if (importResult.imported > 0) {
              setImportMessage(t('tasksImported', { count: importResult.imported }));
            }
          }
        } catch {
          // Non-critical: series was created, task import failed silently
        }
      }

      router.push(`/meeting-series/${newSeriesId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  // Redirect will happen in useEffect if user is not authorized
  if (!user || user.role === 'user') {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/meeting-series"
          className="inline-flex items-center text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] text-sm font-medium mb-6 hover:scale-105 transition-all"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('backToSeries')}
        </Link>

        <div className="bg-[var(--brand-primary-soft)] rounded-2xl p-5 sm:p-8 border border-[var(--brand-primary-border)]">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent break-words">
                {t('title')}
              </h1>
              <p className="text-base sm:text-lg text-[var(--brand-primary-strong)] font-medium mt-1">
                {t('subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">{t('errorCreating')}</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {importMessage && (
        <div className="bg-[var(--brand-primary-soft)] border border-[var(--brand-primary-border)] text-[var(--brand-primary-strong)] px-4 py-3 rounded-lg">
          <p className="text-sm font-medium">{importMessage}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 sm:p-8 border border-gray-100 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
                {t('sessionName')}
              </label>
              <input
                type="text"
                id="project"
                name="project"
                list="existing-session-names"
                value={formData.project}
                onChange={handleInputChange}
                required
                autoComplete="off"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all"
                placeholder={t('sessionNamePlaceholder')}
              />
              <datalist id="existing-session-names">
                {existingProjectNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                {t('year')}
              </label>
              <select
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all bg-white"
              >
                <option value="">{t('noYear')}</option>
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="defaultTemplateId" className="block text-sm font-medium text-gray-700 mb-2">
              {t('defaultTemplateLabel')}
            </label>
            <select
              id="defaultTemplateId"
              name="defaultTemplateId"
              value={formData.defaultTemplateId}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all bg-white"
            >
              <option value="">{t('noDefaultTemplate')}</option>
              {templateOptions.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name} ({template.scope === 'global' ? t('templateGlobal') : t('templateSeries')})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('defaultTemplateHint')}</p>
          </div>

          <div>
            <label htmlFor="defaultPdfTemplateId" className="block text-sm font-medium text-gray-700 mb-2">
              {t('defaultPdfTemplateLabel')}
            </label>
            <select
              id="defaultPdfTemplateId"
              name="defaultPdfTemplateId"
              value={formData.defaultPdfTemplateId}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all bg-white"
            >
              <option value="">{t('noDefaultPdfTemplate')}</option>
              {pdfTemplateOptions.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name}{template.isActive ? ` (${t('templateActive')})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('defaultPdfTemplateHint')}</p>
          </div>

          {/* Import Tasks from existing Series */}
          {existingSeries.length > 0 && (
            <div>
              <label htmlFor="sourceSeriesId" className="block text-sm font-medium text-gray-700 mb-2">
                {t('importTasksFrom')}
              </label>
              <select
                id="sourceSeriesId"
                value={sourceSeriesId}
                onChange={(e) => setSourceSeriesId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all bg-white"
              >
                <option value="">{t('noImport')}</option>
                {existingSeries.map(s => (
                  <option key={s._id} value={s._id}>
                    {s.project}{s.name ? ` – ${s.name}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t('importHint')}
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              {t('description')}
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all resize-none"
              placeholder={t('descriptionPlaceholder')}
            />
          </div>

          {/* Members - New Selection from Registered Users */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('members')}
            </label>
            <div className="space-y-3">
              <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full flex-1 min-w-0 px-4 py-3 min-h-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all"
                >
                  <option value="">{t('selectUser')}</option>
                  {allUsers
                    .filter(user => !formData.members.some(m => m.userId === user._id))
                    .map(user => (
                      <option key={user._id} value={user._id}>
                        {getUserDisplayName(user)}
                      </option>
                    ))
                  }
                </select>
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!selectedUserId}
                  className="w-full min-[420px]:w-auto px-3 sm:px-4 py-3 min-h-11 min-w-11 bg-[var(--brand-primary)] text-white rounded-xl hover:bg-[var(--brand-primary-strong)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>

              {formData.members.length > 0 && (
                <div className="space-y-2">
                  {formData.members.map((member) => {
                    const user = getUserById(member.userId);
                    return (
                      <div
                        key={member.userId}
                        className="flex items-start justify-between gap-3 p-3 bg-[var(--brand-primary-soft)] rounded-lg border border-[var(--brand-primary-border)]"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 brand-gradient-bg rounded-full flex items-center justify-center text-white font-bold">
                            {user ? user.firstName.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 break-words">
                              {user ? getUserDisplayName(user) : member.userId}
                            </p>
                            {user && (
                              <p className="text-sm text-gray-600 break-all">{user.email}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(member.userId)}
                          className="text-red-600 hover:bg-red-100 rounded-full p-2 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('participants')}
            </label>
            <p className="text-xs text-gray-500 mb-2">{t('participantsHint')}</p>
            <div className="space-y-3">
              <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2">
                <input
                  type="text"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addParticipant())}
                  className="w-full flex-1 min-w-0 px-4 py-3 min-h-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all"
                  placeholder={t('participantPlaceholder')}
                />
                <button
                  type="button"
                  onClick={addParticipant}
                  className="w-full min-[420px]:w-auto px-3 sm:px-4 py-3 min-h-11 min-w-11 bg-[var(--brand-primary)] text-white rounded-xl hover:bg-[var(--brand-primary-strong)] transition-colors inline-flex items-center justify-center shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>

              {formData.participants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.participants.map((participant, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] px-3 py-1 rounded-full text-sm"
                    >
                      <span>{participant}</span>
                      <button
                        type="button"
                        onClick={() => removeParticipant(participant)}
                        className="hover:bg-[var(--brand-primary-soft)] rounded-full p-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Informed Users */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('informedUsers')}
            </label>
            <p className="text-xs text-gray-500 mb-2">{t('informedUsersHint')}</p>
            <div className="space-y-3">
              <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2">
                <input
                  type="text"
                  value={newInformedUser}
                  onChange={(e) => setNewInformedUser(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInformedUser())}
                  className="w-full flex-1 min-w-0 px-4 py-3 min-h-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-all"
                  placeholder={t('informedUserPlaceholder')}
                />
                <button
                  type="button"
                  onClick={addInformedUser}
                  className="w-full min-[420px]:w-auto px-3 sm:px-4 py-3 min-h-11 min-w-11 bg-[var(--brand-primary)] text-white rounded-xl hover:bg-[var(--brand-primary-strong)] transition-colors inline-flex items-center justify-center shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>

              {formData.informedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.informedUsers.map((user, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{user}</span>
                      <button
                        type="button"
                        onClick={() => removeInformedUser(user)}
                        className="hover:bg-green-200 rounded-full p-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 border-t">
            <button
              type="submit"
              disabled={loading || !formData.project}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 min-h-11 brand-button-primary rounded-xl shadow-lg hover:shadow-xl sm:hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('creatingSeries')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('createSeries')}</span>
                </div>
              )}
            </button>

            <Link
              href="/meeting-series"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 min-h-11 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors inline-flex items-center justify-center"
            >
              {t('cancel')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
