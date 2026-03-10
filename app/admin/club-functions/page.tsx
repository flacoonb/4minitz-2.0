'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { withAdminAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';

interface ClubFunctionEntry {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
  sortOrder?: number;
  token: string;
  assignedUserId?: string;
}

interface UserEntry {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
}

function AdminClubFunctionsPage() {
  const t = useTranslations('admin.clubFunctions');
  const tCommon = useTranslations('common');
  const [entries, setEntries] = useState<ClubFunctionEntry[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name, 'de');
      }),
    [entries]
  );

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/club-functions?includeInactive=true', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('loadError'));
      setEntries(data.data || []);
    } catch (err: any) {
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users?limit=1000', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setUsers(data.data || []);
      } catch {
        // ignore optional user list errors
      }
    };
    loadUsers();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/club-functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('createError'));
      setNewName('');
      setNewDescription('');
      await loadEntries();
    } catch (err: any) {
      setError(err.message || t('createError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (entry: ClubFunctionEntry) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/club-functions/${entry._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isActive: !entry.isActive,
          validTo: entry.isActive ? new Date().toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('updateError'));
      await loadEntries();
    } catch (err: any) {
      setError(err.message || t('updateError'));
    } finally {
      setSaving(false);
    }
  };

  const assignUser = async (entry: ClubFunctionEntry, assignedUserId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/club-functions/${entry._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('updateError'));
      await loadEntries();
    } catch (err: any) {
      setError(err.message || t('updateError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen brand-page-gradient brandize-admin py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white/90 rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
              <p className="text-sm text-gray-600 mt-1">{t('subtitle')}</p>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              {t('back')}
            </Link>
          </div>
        </div>

        <form onSubmit={handleCreate} className="bg-white/90 rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('createTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder={t('namePlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('descriptionField')}</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 brand-button-primary rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {saving ? tCommon('saving') : t('create')}
          </button>
        </form>

        <div className="bg-white/90 rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('listTitle')}</h2>
          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-sm text-gray-600">{t('loading')}</div>
          ) : sortedEntries.length === 0 ? (
            <div className="text-sm text-gray-600">{t('empty')}</div>
          ) : (
            <div className="space-y-3">
              {sortedEntries.map((entry) => (
                <div key={entry._id} className="border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{entry.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                        {entry.isActive ? t('active') : t('inactive')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{entry.token}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('assignedTo')}{' '}
                      {users.find((user) => user._id === entry.assignedUserId)
                        ? `${users.find((user) => user._id === entry.assignedUserId)?.firstName} ${users.find((user) => user._id === entry.assignedUserId)?.lastName}`
                        : t('noAssignment')}
                    </p>
                    {entry.description && <p className="text-sm text-gray-600 mt-1">{entry.description}</p>}
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      disabled={saving}
                      value={entry.assignedUserId || ''}
                      onChange={(e) => assignUser(entry, e.target.value)}
                      className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[220px]"
                    >
                      <option value="">{t('noAssignment')}</option>
                      {users.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.firstName} {user.lastName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleActive(entry)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border ${entry.isActive ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'} disabled:opacity-60`}
                    >
                      {entry.isActive ? t('deactivate') : t('reactivate')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withAdminAuth(AdminClubFunctionsPage);
