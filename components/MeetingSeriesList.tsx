/**
 * Meeting Series List Component
 * Displays all meeting series with real-time data fetching
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface MeetingSeries {
  _id: string;
  project: string;
  name: string;
  lastMinutesDate?: string;
  lastMinutesFinalized?: boolean;
  moderators: string[];
  participants: string[];
  createdAt: string;
}

const YEAR_COLORS = [
  { bg: 'var(--brand-primary)', text: '#ffffff' },
  { bg: 'var(--brand-secondary)', text: '#ffffff' },
  { bg: 'var(--brand-accent)', text: '#ffffff' },
  { bg: 'var(--brand-success)', text: '#ffffff' },
  { bg: 'var(--brand-warning)', text: '#ffffff' },
  { bg: 'var(--brand-danger)', text: '#ffffff' },
  { bg: 'var(--brand-primary-strong)', text: '#ffffff' },
];

function getYearColor(name: string): { bg: string; text: string } {
  const year = parseInt(name, 10);
  if (!isNaN(year)) {
    return YEAR_COLORS[year % YEAR_COLORS.length];
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return YEAR_COLORS[Math.abs(hash) % YEAR_COLORS.length];
}

export default function MeetingSeriesList() {
  const t = useTranslations();
  const { hasPermission } = useAuth();
  const [series, setSeries] = useState<MeetingSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeries = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meeting-series', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(t('errors.loadFailed'));
      }
      
      const data = await response.json();
      setSeries(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: 'var(--brand-danger-soft)', borderColor: 'var(--brand-danger-border)', color: 'var(--brand-danger)' }}>
        <p className="font-medium">{t('errors.loadFailed')}</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchSeries}
          className="mt-2 text-sm underline hover:no-underline"
        >
          {t('common.confirm')}
        </button>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-4" style={{ color: 'var(--brand-text-muted)' }}>
          <svg
            className="mx-auto h-16 w-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
          {t('meetingSeries.noSeries')}
        </h3>
        <p className="mb-6" style={{ color: 'var(--brand-text-muted)' }}>
          {t('meetingSeries.createNew')}
        </p>
        {hasPermission('canCreateMeetings') && (
          <Link
            href="/meeting-series/new"
            className="inline-flex items-center px-4 py-2 brand-button-solid rounded-lg transition-colors"
          >
            {t('meetingSeries.createNew')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold break-words" style={{ color: 'var(--brand-text)' }}>
          {t('meetingSeries.title')} ({series.length})
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {series.map((item) => (
          <Link
            key={item._id}
            href={`/meeting-series/${item._id}`}
            className="group block p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 app-card"
            style={{ borderColor: 'var(--brand-card-border)' }}
          >
            {item.name && (
              <div className="mb-3">
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: getYearColor(item.name).bg, color: getYearColor(item.name).text }}
                >
                  {item.name}
                </span>
              </div>
            )}

            <h3 className="text-lg font-bold mb-3 group-hover:text-[var(--brand-primary)] transition-colors" style={{ color: 'var(--brand-text)' }}>
              {item.project}
            </h3>
            
            <div className="space-y-2 text-sm" style={{ color: 'var(--brand-text-muted)' }}>
              {item.lastMinutesDate && (
                <div className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {t('meetingSeries.lastMinutes')}: {new Date(item.lastMinutesDate).toLocaleDateString()}
                </div>
              )}
              
              <div className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                {item.moderators.length} {t('meetingSeries.moderators')}, {item.participants.length} {t('meetingSeries.participants')}
              </div>

              {item.lastMinutesFinalized !== undefined && (
                <div className="flex items-center">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      item.lastMinutesFinalized
                        ? 'bg-[var(--brand-success-soft)] text-[var(--brand-success)] border border-[var(--brand-success-border)]'
                        : 'bg-[var(--brand-warning-soft)] text-[var(--brand-warning)] border border-[var(--brand-warning-border)]'
                    }`}
                  >
                    {item.lastMinutesFinalized ? `✓ ${t('meetingSeries.finalized')}` : `⚠ ${t('meetingSeries.draft')}`}
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
