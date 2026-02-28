"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

interface Minute {
  _id: string;
  meetingSeries_id: {
    _id: string;
    project: string;
    name: string;
  };
  date: string;
  participants: string[];
  topics: any[];
  globalNote: string;
  isFinalized: boolean;
  createdAt: string;
}

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

export default function SeriesMinutesPage() {
  const t = useTranslations('seriesMinutes');
  const locale = useLocale();
  const params = useParams();
  const seriesId = params.seriesId as string;

  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [series, setSeries] = useState<MeetingSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchSeriesData = useCallback(async () => {
    try {
      const response = await fetch(`/api/meeting-series/${seriesId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        setSeries(result.data);
      }
    } catch (err) {
      console.error('Error fetching series data:', err);
    }
  }, [seriesId]);

  const fetchMinutes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/minutes?meetingSeriesId=${seriesId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('loadError'));
      }

      const result = await response.json();
      setMinutes(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unknownError'));
    } finally {
      setLoading(false);
    }
  }, [seriesId, t]);

  useEffect(() => {
    if (seriesId) {
      fetchSeriesData();
      fetchMinutes();
    }
  }, [seriesId, fetchSeriesData, fetchMinutes]);

  const filteredMinutes = minutes.filter(minute => {
    const { isFinalized } = minute;

    if (statusFilter) {
      if (statusFilter === 'finalized' && !isFinalized) return false;
      if (statusFilter === 'draft' && isFinalized) return false;
    }

    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      minute.meetingSeries_id?.project?.toLowerCase().includes(query) ||
      minute.meetingSeries_id?.name?.toLowerCase().includes(query) ||
      minute.globalNote?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => { fetchSeriesData(); fetchMinutes(); }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-gray-600">
        <Link href="/minutes" className="hover:text-green-600 transition-colors">
          {t('minutes')}
        </Link>
        <span>&gt;</span>
        <span className="text-gray-900 font-medium">
          {series ? `${series.project} - ${series.name}` : t('loading')}
        </span>
      </nav>

      {/* Header Section */}
      <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-8 border border-green-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 712-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {series ? `${series.project} - ${series.name}` : t('minutes')}
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                {filteredMinutes.length === 1
                  ? t('minuteFound', { count: filteredMinutes.length })
                  : t('minutesFound', { count: filteredMinutes.length })
                }
              </p>
            </div>
          </div>

          <Link
            href={`/minutes/${seriesId}/new`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('newMinute')}
          </Link>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white/90 backdrop-blur-sm transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90 backdrop-blur-sm"
            >
              <option value="">{t('allStatus')}</option>
              <option value="draft">{t('drafts')}</option>
              <option value="finalized">{t('finalized')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Minutes List */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-100 shadow-lg">
        {filteredMinutes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto w-24 h-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 712-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">{t('noMinutesFound')}</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || statusFilter ? t('noMinutesHint') : t('createFirstHint')}
            </p>
            <Link
              href={`/minutes/${seriesId}/new`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('createNew')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredMinutes.map(minute => (
              <Link
                key={minute._id}
                href={`/minutes/${seriesId}/${minute._id}`}
                className="group block p-6 bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-2xl shadow-lg hover:shadow-2xl hover:border-green-300 hover:scale-[1.02] transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${minute.isFinalized ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${minute.isFinalized
                        ? 'text-green-700 bg-green-100'
                        : 'text-yellow-700 bg-yellow-100'
                      }`}>
                      {minute.isFinalized ? t('finalized') : t('draft')}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(minute.date)}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-2 group-hover:text-green-700 transition-colors">
                  {t('minuteFrom', { date: formatDateShort(minute.date) })}
                </h3>

                {minute.globalNote && (
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {minute.globalNote}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>
                    {t('participants', { count: minute.participants?.length || 0 })}
                  </span>
                  <span>
                    {t('agendaItems', { count: minute.topics?.length || 0 })}
                  </span>
                  <span className="text-xs">
                    {t('createdOn', { date: formatDateShort(minute.createdAt) })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}