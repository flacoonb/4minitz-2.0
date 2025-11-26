'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface Minute {
  _id: string;
  meetingSeries_id: {
    _id: string;
    project: string;
    name: string;
  };
  date: string;
  isFinalized: boolean;
  participants: string[];
  topics: Array<{
    subject: string;
    infoItems: any[];
  }>;
  createdAt: string;
}

interface MinutesListProps {
  meetingSeriesId?: string;
}

export default function MinutesList({ meetingSeriesId }: MinutesListProps) {
  const t = useTranslations();
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMinutes = useCallback(async () => {
    try {
      setLoading(true);
      const url = meetingSeriesId
        ? `/api/minutes?meetingSeriesId=${meetingSeriesId}`
        : '/api/minutes';
      
      const response = await fetch(url, {
        headers: {
          'x-user-id': 'demo-user',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch minutes');
      }

      const data = await response.json();
      setMinutes(data.data || []);
    } catch (_err) {
      setError('Failed to load minutes');
    } finally {
      setLoading(false);
    }
  }, [meetingSeriesId]);

  useEffect(() => {
    fetchMinutes();
  }, [fetchMinutes]);

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
      </div>
    );
  }

  if (minutes.length === 0) {
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
          {t('minutes.title')}
        </h3>
        <p className="text-gray-500 mb-6">
          {t('minutes.createNew')}
        </p>
        {meetingSeriesId && (
          <Link
            href={`/meeting-series/${meetingSeriesId}/minutes/new`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('minutes.createNew')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('minutes.title')} ({minutes.length})
        </h2>
        {meetingSeriesId && (
          <Link
            href={`/meeting-series/${meetingSeriesId}/minutes/new`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
            {t('minutes.createNew')}
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {minutes.map((minute) => {
          const topicCount = minute.topics?.length || 0;
          const actionItemCount = minute.topics?.reduce(
            (sum, topic) => sum + (topic.infoItems?.length || 0),
            0
          ) || 0;

          return (
            <Link
              key={minute._id}
              href={`/minutes/${minute._id}`}
              className="block p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {new Date(minute.date).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        minute.isFinalized
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {minute.isFinalized
                        ? `✓ ${t('meetingSeries.finalized')}`
                        : `⚠ ${t('meetingSeries.draft')}`}
                    </span>
                  </div>

                  {!meetingSeriesId && minute.meetingSeries_id && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {minute.meetingSeries_id.project} - {minute.meetingSeries_id.name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
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
                      {minute.participants.length} {t('meetingSeries.participants')}
                    </div>
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                        />
                      </svg>
                      {topicCount} {t('minutes.topics')}
                    </div>
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                      {actionItemCount} {t('minutes.actionItems')}
                    </div>
                  </div>
                </div>

                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
