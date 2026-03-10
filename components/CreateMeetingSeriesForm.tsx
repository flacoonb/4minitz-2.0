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
        <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: 'var(--brand-danger-soft)', borderColor: 'var(--brand-danger-border)', color: 'var(--brand-danger)' }}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="project" className="block text-sm font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
          {t('meetingSeriesForm.projectLabel')} *
        </label>
        <input
          type="text"
          id="project"
          required
          value={formData.project}
          onChange={(e) => setFormData({ ...formData, project: e.target.value })}
          placeholder={t('meetingSeriesForm.projectPlaceholder')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
          style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
          {t('meetingSeriesForm.nameLabel')} *
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t('meetingSeriesForm.namePlaceholder')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
          style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
        />
      </div>

      <div>
        <label htmlFor="participants" className="block text-sm font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
          {t('meetingSeriesForm.participantsLabel')}
        </label>
        <input
          type="text"
          id="participants"
          value={formData.participants}
          onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
          placeholder={t('meetingSeriesForm.participantsPlaceholder')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
          style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
        />
        <p className="mt-1 text-sm app-text-muted">
          {t('meetingSeriesForm.participantsPlaceholder')}
        </p>
      </div>

      <div>
        <label htmlFor="informedUsers" className="block text-sm font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
          {t('meetingSeriesForm.informedUsersLabel')}
        </label>
        <input
          type="text"
          id="informedUsers"
          value={formData.informedUsers}
          onChange={(e) => setFormData({ ...formData, informedUsers: e.target.value })}
          placeholder={t('meetingSeriesForm.informedUsersPlaceholder')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
          style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
        />
        <p className="mt-1 text-sm app-text-muted">
          {t('meetingSeriesForm.informedUsersPlaceholder')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full sm:w-auto px-6 py-2 min-h-11 border rounded-lg hover:brightness-95 transition-colors"
          style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-surface-soft)', color: 'var(--brand-text)' }}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto px-6 py-2 min-h-11 brand-button-solid rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('meetingSeriesForm.creating') : t('meetingSeriesForm.submitCreate')}
        </button>
      </div>
    </form>
  );
}
