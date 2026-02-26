/**
 * Meeting Series List Component
 * Displays all meeting series with real-time data fetching
 */
'use client';

import { useState, useEffect } from 'react';
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
  { bg: '#3b82f6', text: '#ffffff' }, // blue
  { bg: '#10b981', text: '#ffffff' }, // emerald
  { bg: '#8b5cf6', text: '#ffffff' }, // purple
  { bg: '#f59e0b', text: '#ffffff' }, // amber
  { bg: '#f43f5e', text: '#ffffff' }, // rose
  { bg: '#06b6d4', text: '#ffffff' }, // cyan
  { bg: '#f97316', text: '#ffffff' }, // orange
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

  useEffect(() => {
    fetchSeries();
  }, []);

  const fetchSeries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meeting-series', {
        headers: {
          'x-user-id': 'demo-user', // TODO: Replace with real auth
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch meeting series');
      }
      
      const data = await response.json();
      setSeries(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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
        <div className="text-gray-400 mb-4">
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
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('meetingSeries.noSeries')}
        </h3>
        <p className="text-gray-500 mb-6">
          {t('meetingSeries.createNew')}
        </p>
        {hasPermission('canCreateMeetings') && (
          <Link
            href="/meeting-series/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('meetingSeries.createNew')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('meetingSeries.title')} ({series.length})
        </h2>
        {hasPermission('canCreateMeetings') && (
          <Link
            href="/meeting-series/new"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-md"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t('meetingSeries.createNew')}
          </Link>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {series.map((item) => (
          <Link
            key={item._id}
            href={`/meeting-series/${item._id}`}
            className="group block p-6 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-lg hover:shadow-2xl hover:border-blue-300 hover:scale-[1.02] transition-all duration-300"
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

            <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
              {item.project}
            </h3>
            
            <div className="space-y-2 text-sm text-gray-600">
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
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
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
