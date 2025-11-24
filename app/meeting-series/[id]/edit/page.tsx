"use client";

import React, { useState, useEffect } from 'react';
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

interface MeetingSeries {
  _id: string;
  project: string;
  name: string;
  members: Member[];
  moderators: string[];
  participants: string[];
}

interface FormData {
  project: string;
  name: string;
  members: Member[];
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
  });
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setSeriesId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  useEffect(() => {
    if (seriesId) {
      fetchSeries();
      fetchUsers();
    }
  }, [seriesId]);

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
      console.error('Fehler beim Laden der Benutzer:', err);
    }
  };

  const fetchSeries = async () => {
    if (!seriesId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/meeting-series/${seriesId}`, { credentials: 'include' });

      if (!response.ok) {
        throw new Error('Sitzungsserie nicht gefunden');
      }

      const result = await response.json();
      const seriesData = result.data;
      setSeries(seriesData);
      
      setFormData({
        project: seriesData.project || '',
        name: seriesData.name || '',
        members: seriesData.members || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesId) return;

    console.log('Saving formData:', formData); // Debug log

    setSaving(true);
    try {
      const response = await fetch(`/api/meeting-series/${seriesId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Speichern');
      }

      const result = await response.json();
      console.log('Save result:', result); // Debug log

      router.push(`/meeting-series/${seriesId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      console.error('Save error:', err); // Debug log
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
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  const getUserById = (userId: string): User | undefined => {
    return allUsers.find(u => u._id === userId);
  };

  const getAvailableUsers = (): User[] => {
    const memberUserIds = formData.members.map(m => m.userId);
    return allUsers.filter(u => !memberUserIds.includes(u._id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error && !series) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Fehler</h1>
          <p className="text-gray-600">{error}</p>
          <Link href="/meeting-series" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <Link href={`/meeting-series/${seriesId}`} className="text-blue-600 hover:text-blue-800 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{t('editSeries')}</h1>
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
        <div className="fixed top-6 right-6 z-50">
          <button
            type="submit"
            form="edit-form"
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-white"
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

        <form id="edit-form" onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('basicInfo')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('projectRequired')}</label>
                <input
                  type="text"
                  value={formData.project}
                  onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                  placeholder={t('projectPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('nameRequired')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('namePlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Members Management */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('members')}</h2>
            </div>

            {/* Add New Member */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('addNewMember')}</h3>
              <div className="flex gap-3">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">{t('selectUser')}</option>
                  {getAvailableUsers().map(user => (
                    <option key={user._id} value={user._id}>
                      {user.firstName} {user.lastName} ({user.email}) - {user.role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!selectedUserId}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {user ? user.firstName.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="flex-1">
                        {user ? (
                          <div>
                            <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-gray-600">{user.email}</p>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                              user.role === 'admin' ? 'bg-red-100 text-red-800' :
                              user.role === 'moderator' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
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
