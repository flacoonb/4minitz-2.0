/**
 * Create Meeting Series Form Component
 */
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function CreateMeetingSeriesForm() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    project: '',
    name: '',
    participants: '',
    informedUsers: '',
  });

  const handleSubmit = async (e: FormEvent) => {
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
          project: formData.project,
          name: formData.name,
          participants: formData.participants
            .split(',')
            .map(p => p.trim())
            .filter(Boolean),
          informedUsers: formData.informedUsers
            .split(',')
            .map(u => u.trim())
            .filter(Boolean),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create meeting series');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
          {t('meetingSeriesForm.projectLabel')} *
        </label>
        <input
          type="text"
          id="project"
          required
          value={formData.project}
          onChange={(e) => setFormData({ ...formData, project: e.target.value })}
          placeholder={t('meetingSeriesForm.projectPlaceholder')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          {t('meetingSeriesForm.nameLabel')} *
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t('meetingSeriesForm.namePlaceholder')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="participants" className="block text-sm font-medium text-gray-700 mb-2">
          {t('meetingSeriesForm.participantsLabel')}
        </label>
        <input
          type="text"
          id="participants"
          value={formData.participants}
          onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
          placeholder={t('meetingSeriesForm.participantsPlaceholder')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-1 text-sm text-gray-500">
          {t('meetingSeriesForm.participantsPlaceholder')}
        </p>
      </div>

      <div>
        <label htmlFor="informedUsers" className="block text-sm font-medium text-gray-700 mb-2">
          {t('meetingSeriesForm.informedUsersLabel')}
        </label>
        <input
          type="text"
          id="informedUsers"
          value={formData.informedUsers}
          onChange={(e) => setFormData({ ...formData, informedUsers: e.target.value })}
          placeholder={t('meetingSeriesForm.informedUsersPlaceholder')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-1 text-sm text-gray-500">
          {t('meetingSeriesForm.informedUsersPlaceholder')}
        </p>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('meetingSeriesForm.creating') : t('meetingSeriesForm.submitCreate')}
        </button>
      </div>
    </form>
  );
}
