"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations, useLocale } from 'next-intl';

interface Minute {
  _id: string;
  meetingSeries_id: {
    _id: string;
    project: string | null;
    name: string | null;
  } | null;
  date: string;
  time?: string;
  location?: string;
  title?: string;
  participants: string[];
  topics: any[];
  globalNote: string;
  isFinalized: boolean;
  createdAt: string;
}

export default function MinutesPage() {
  const router = useRouter();
  const { user, loading: authLoading, hasPermission } = useAuth();
  const t = useTranslations('minutes');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('24h');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchMinutes();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/public');
      if (response.ok) {
        const result = await response.json();
        if (result.data?.system?.timeFormat) {
          setTimeFormat(result.data.system.timeFormat);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchMinutes = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/minutes', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('loadListError'));
      }

      const result = await response.json();
      // Sanitize data: ensure meetingSeries_id structure is correct
      const sanitizedData = (result.data || []).map((minute: any) => ({
        ...minute,
        meetingSeries_id: minute.meetingSeries_id || null
      }));
      setMinutes(sanitizedData);
    } catch (err) {
      console.error('Error fetching minutes:', err);
      setError(err instanceof Error ? err.message : t('unknownError'));
      setMinutes([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    if (timeFormat === '24h') return `${timeStr} ${t('clock')}`.trim();
    
    // Convert 24h to 12h
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const filteredMinutes = minutes.filter(minute => {
    // Category Filter (Meeting Series)
    if (categoryFilter && minute.meetingSeries_id?._id !== categoryFilter) {
      return false;
    }

    // Status Filter
    if (statusFilter) {
      const isFinalized = minute.isFinalized;
      if (statusFilter === 'finalized' && !isFinalized) return false;
      if (statusFilter === 'draft' && isFinalized) return false;
    }

    // Search Filter
    if (!searchQuery) return true; // Show all if no search query
    
    const seriesName = minute.meetingSeries_id?.name || '';
    const seriesProject = minute.meetingSeries_id?.project || '';
    const query = searchQuery.toLowerCase();
    
    return seriesName.toLowerCase().includes(query) || 
           seriesProject.toLowerCase().includes(query);
  });

  // Group minutes by meeting series
  const groupedMinutes = React.useMemo(() => {
    try {
      const groups = new Map<string, { series: any; minutes: Minute[] }>();
      
      filteredMinutes.forEach(minute => {
        const seriesId = minute.meetingSeries_id?._id || 'no-series';
        
        if (!groups.has(seriesId)) {
          groups.set(seriesId, {
            series: minute.meetingSeries_id,
            minutes: []
          });
        }
        
        groups.get(seriesId)!.minutes.push(minute);
      });
      
      // Sort minutes within each group by date (newest first)
      groups.forEach(group => {
        group.minutes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
      
      return Array.from(groups.values()).sort((a, b) => {
        // Sort groups by latest minute date
        const latestA = a.minutes[0]?.date || '';
        const latestB = b.minutes[0]?.date || '';
        return new Date(latestB).getTime() - new Date(latestA).getTime();
      });
    } catch (error) {
      console.error('Error grouping minutes:', error);
      return [];
    }
  }, [filteredMinutes]);

  // Generate suggestions for autocomplete
  const suggestions = React.useMemo(() => {
    if (searchQuery.length < 3) return [];
    
    const uniqueItems = new Set<string>();
    minutes.forEach(minute => {
      const name = minute.meetingSeries_id?.name;
      const project = minute.meetingSeries_id?.project;
      
      if (name) {
        uniqueItems.add(name);
      }
      if (project) {
        uniqueItems.add(project);
      }
    });
    
    const query = searchQuery.toLowerCase();
    return Array.from(uniqueItems)
      .filter(item => item.toLowerCase().includes(query))
      .slice(0, 5); // Limit to 5 suggestions
  }, [minutes, searchQuery]);

  // Generate available categories (Meeting Series)
  const availableCategories = React.useMemo(() => {
    const uniqueSeries = new Map<string, { id: string; name: string; project: string }>();
    minutes.forEach(minute => {
      if (minute.meetingSeries_id && (minute.meetingSeries_id.name || minute.meetingSeries_id.project)) {
        const series = minute.meetingSeries_id;
        uniqueSeries.set(series._id, {
          id: series._id,
          name: series.name || t('defaultSeriesName'),
          project: series.project || t('defaultProjectName')
        });
      }
    });
    return Array.from(uniqueSeries.values());
  }, [minutes]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-8 border border-green-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {t('title')}
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                {t('subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
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
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(e.target.value.length >= 3);
                }}
                onFocus={() => setShowSuggestions(searchQuery.length >= 3)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white/90 backdrop-blur-sm transition-all"
              />
            </div>
            
            {/* Autocomplete Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setShowSuggestions(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2 2 4-4m-6 0a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                      <span className="text-gray-900">{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Status and Category Filters */}
          <div className="flex gap-4">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90 backdrop-blur-sm min-w-[140px]"
            >
              <option value="">{t('allStatus')}</option>
              <option value="finalized">{t('finalized')}</option>
              <option value="draft">{t('draft')}</option>
            </select>

            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90 backdrop-blur-sm min-w-[180px]"
            >
              <option value="">{t('allCategories')}</option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.project || t('defaultProjectName')} - {category.name || t('defaultSeriesName')}
                </option>
              ))}
            </select>
            
            <button 
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('');
                setCategoryFilter('');
              }}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {tCommon('reset')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('loadingMinutes')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">{t('loadListError')}</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : filteredMinutes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noMinutesYet')}</h3>
            <p className="text-gray-600 mb-6">{t('createFirstMinute')}</p>
            {hasPermission('canCreateMeetings') && (
              <Link
                href="/minutes/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('createFirstMinuteButton')}
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {groupedMinutes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noMinutesFound')}</h3>
                <p className="text-gray-600">{t('tryOtherFilters')}</p>
              </div>
            ) : (
              groupedMinutes.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-4">
                  {/* Series Header */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">
                            {group.series && (group.series.project || group.series.name)
                              ? `${group.series.project || t('defaultProjectName')} - ${group.series.name || t('defaultSeriesName')}`
                              : t('noSeries')}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {group.minutes.length} {group.minutes.length === 1 ? t('minuteSingular') : t('minutes')}
                          </p>
                        </div>
                      </div>
                      {group.series && (
                        <Link
                          href={`/meeting-series/${group.series._id}`}
                          className="px-4 py-2 bg-white text-green-700 rounded-lg hover:bg-green-50 transition-all text-sm font-medium border border-green-200 hover:border-green-300"
                        >
                          {t('viewSeries')} →
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Minutes in this series */}
                  <div className="space-y-3 pl-4 border-l-4 border-green-100">
                    {group.minutes.map((minute) => (
                      <Link
                        key={minute._id}
                        href={`/minutes/${minute._id}`}
                        className="block p-5 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-semibold text-gray-900">
                                  {minute.title ? (
                                    <span>{minute.title} <span className="text-gray-500 font-normal text-sm">({new Date(minute.date).toLocaleDateString(locale)})</span></span>
                                  ) : (
                                    <>
                                      {new Date(minute.date).toLocaleDateString(locale, {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                      {minute.time && ` • ${formatTime(minute.time)}`}
                                    </>
                                  )}
                                </h4>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  minute.isFinalized
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                                }`}>
                                  {minute.isFinalized ? `✓ ${t('finalized')}` : `○ ${t('draft')}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                {minute.location && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {minute.location}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  {minute.participants.length} {t('participants')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                  {minute.topics.length} {minute.topics.length === 1 ? t('topicSingular') : t('topics')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-green-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
