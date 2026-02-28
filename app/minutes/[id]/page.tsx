"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';

interface Minute {
  _id: string;
  meetingSeries_id: any;
  date: string;
  time?: string;
  location?: string;
  participants: string[];
  participantsWithStatus?: Array<{
    userId: string;
    attendance: 'present' | 'excused' | 'absent';
  }>;
  topics: Topic[];
  globalNote: string;
  isFinalized: boolean;
  reopeningHistory?: Array<{
    reopenedAt: string;
    reopenedBy: string;
    reason: string;
  }>;
}

interface Topic {
  subject: string;
  responsibles?: string[];
  infoItems?: InfoItem[];
}

interface InfoItem {
  subject: string;
  details?: string;
  itemType: 'actionItem' | 'infoItem';
  status?: 'open' | 'in-progress' | 'completed' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  responsibles?: string[];
  estimatedHours?: number;
  actualHours?: number;
  notes?: string;
}

interface User {
  _id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
}

export default function MinuteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [minute, setMinute] = useState<Minute | null>(null);
  const isModerator = user && minute?.meetingSeries_id?.moderators?.includes(user.username);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minuteId, setMinuteId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('24h');

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setMinuteId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  const fetchSettings = useCallback(async () => {
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
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users?limit=1000', {
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        setAllUsers(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  const fetchMinute = useCallback(async () => {
    if (!minuteId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/minutes/${minuteId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(t('minutes.notFound'));
      }

      const result = await response.json();
      const minuteData = result.data;
      
      setMinute(minuteData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('minutes.loadError'));
    } finally {
      setLoading(false);
    }
  }, [minuteId, t]);

  const handleFinalize = async () => {
    if (!minute || !minuteId) return;
    
    // If reopening a finalized protocol, show dialog
    if (minute.isFinalized) {
      setShowReopenDialog(true);
      return;
    }
    
    // Show finalize confirmation dialog
    setShowFinalizeDialog(true);
  };

  const confirmFinalize = async () => {
    if (!minute || !minuteId) return;

    try {
      const response = await fetch(`/api/minutes/${minuteId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isFinalized: true,
          isModerator: true,
        }),
      });

      if (response.ok) {
        setShowFinalizeDialog(false);
        await fetchMinute();
      } else {
        const errorData = await response.json();
        setErrorMessage(`${t('common.error')}: ${errorData.error || 'Unbekannter Fehler'}`);
        setShowFinalizeDialog(false);
      }
    } catch (error) {
      console.error('Fehler beim Finalisieren:', error);
      setErrorMessage(t('minutes.finalizeErrorGeneric'));
      setShowFinalizeDialog(false);
    }
  };

  const handleReopen = async () => {
    if (!minute || !minuteId || !reopenReason.trim()) {
      setErrorMessage(t('minutes.reopenReasonRequired'));
      return;
    }

    try {
      const response = await fetch(`/api/minutes/${minuteId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isFinalized: false,
          reopenReason: reopenReason.trim(),
          isModerator: true,
        }),
      });

      if (response.ok) {
        setShowReopenDialog(false);
        setReopenReason('');
        await fetchMinute();
      } else {
        const errorData = await response.json();
        setErrorMessage(`${t('common.error')}: ${errorData.error || 'Unbekannter Fehler'}`);
      }
    } catch (error) {
      console.error('Fehler beim Wiedereröffnen:', error);
      setErrorMessage(t('minutes.reopenErrorGeneric'));
    }
  };

  const handleExport = async () => {
    if (!minute) return;
    
    setExportingPdf(true);
    
    try {
      // Fetch PDF settings
      const response = await fetch('/api/pdf-settings');
      const settingsResult = await response.json();

      if (!settingsResult.success) {
        throw new Error(t('minutes.pdfSettingsError'));
      }

      // Fetch global settings for locale
      try {
        const globalSettingsResponse = await fetch('/api/settings/public');
        const globalSettingsResult = await globalSettingsResponse.json();

        if (globalSettingsResult.success && globalSettingsResult.data) {
           settingsResult.data.locale = globalSettingsResult.data.language?.defaultLanguage;
        }
      } catch (e) {
        console.warn('Could not fetch global settings for PDF export', e);
      }

      // Fetch PDF layout settings
      let layoutSettings = null;
      try {
        const layoutResponse = await fetch('/api/pdf-layout-settings');
        const layoutResult = await layoutResponse.json();
        layoutSettings = layoutResult.success ? layoutResult.data : null;
      } catch (e) {
        console.warn('Could not fetch PDF layout settings', e);
      }

      // Dynamically import PDF generator (client-side only)
      const { generateMinutePdf } = await import('@/lib/pdfGenerator');

      await generateMinutePdf(minute, settingsResult.data, allUsers, layoutSettings);
    } catch (error) {
      console.error('Error generating PDF:', error);
      const errorMsg = error instanceof Error ? error.message : t('minutes.pdfGenerationError');
      alert(errorMsg);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDelete = async () => {
    if (!minute || !minuteId) return;
    
    // Check if finalized
    if (minute.isFinalized) {
      setErrorMessage(t('minutes.finalizedDeleteError'));
      return;
    }
    
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!minute || !minuteId) return;

    try {
      const response = await fetch(`/api/minutes/${minuteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        const seriesId = minute?.meetingSeries_id?._id;
        router.push(seriesId ? `/meeting-series/${seriesId}` : '/meeting-series');
      } else {
        const errorData = await response.json();
        setErrorMessage(`${t('minutes.deleteError')}: ${errorData.error || 'Unbekannter Fehler'}`);
        setShowDeleteDialog(false);
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      setErrorMessage(t('minutes.deleteErrorGeneric'));
      setShowDeleteDialog(false);
    }
  };

  // Helper function to get user by ID
  const getUserById = (userId: string): User | undefined => {
    return allUsers.find(u => u._id === userId);
  };

  // Helper function to get user initials
  const getUserInitials = (userId: string): string => {
    const user = getUserById(userId);
    if (!user) return '?';
    return `${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`;
  };

  // Helper function to format multiple users as initials
  const formatUsersAsInitials = (userIds: string[]): string => {
    return userIds.map(id => getUserInitials(id)).join(', ');
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    if (timeFormat === '24h') return `${timeStr} ${t('minutes.clock')}`;
    
    // Convert 24h to 12h
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  useEffect(() => {
    if (minuteId) {
      fetchMinute();
      fetchUsers();
      fetchSettings();
    }
  }, [minuteId, fetchMinute, fetchUsers, fetchSettings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !minute) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h1>
          <p className="text-gray-600">{error || t('minutes.notFound')}</p>
          <Link href="/meeting-series" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            {t('minutes.backToOverview')}
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
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-gray-500 mb-3 flex-wrap">
                <Link href="/meeting-series" className="hover:text-blue-600 transition-colors">
                  {t('nav.meetingSeries')}
                </Link>
                {minute.meetingSeries_id?._id && (
                  <>
                    <span className="text-gray-400">›</span>
                    <Link href={`/meeting-series/${minute.meetingSeries_id._id}`} className="hover:text-blue-600 transition-colors">
                      {minute.meetingSeries_id.project && minute.meetingSeries_id.name
                        ? `${minute.meetingSeries_id.project} – ${minute.meetingSeries_id.name}`
                        : minute.meetingSeries_id.name || minute.meetingSeries_id.project || 'Series'}
                    </Link>
                  </>
                )}
                <span className="text-gray-400">›</span>
                <span className="text-gray-900 font-medium">
                  {new Date(minute.date).toLocaleDateString(locale)}
                </span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('minutes.details')}</h1>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-700">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">
                    {new Date(minute.date).toLocaleDateString(locale)}
                    {minute.time && ` • ${formatTime(minute.time)}`}
                  </span>
                </div>
                
                {minute.location && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium">{minute.location}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <span className={`px-4 py-2 rounded-xl font-semibold text-sm ${
                    minute.isFinalized
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {minute.isFinalized ? t('minutes.isFinalized') : t('minutes.isDraft')}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {isModerator && !minute.isFinalized && (
                <Link
                  href={`/minutes/${minuteId}/edit`}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t('common.edit')}
                  </div>
                </Link>
              )}
              {isModerator && (
                <button
                  onClick={handleFinalize}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105 ${
                    minute.isFinalized
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                  }`}
                >
                  {minute.isFinalized ? t('minutes.reopen') : t('minutes.finalize')}
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={exportingPdf}
                className="px-6 py-3 bg-gradient-to-r from-gray-500 to-slate-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {exportingPdf ? t('minutes.exportingPDF') : t('minutes.exportPDF')}
                </div>
              </button>
              {isModerator && (
                <button
                  onClick={handleDelete}
                  disabled={minute.isFinalized}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title={minute.isFinalized ? t('minutes.finalizedCantDelete') : t('minutes.delete')}
                >
                  {t('common.delete')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Participants */}
        {((minute.participantsWithStatus && minute.participantsWithStatus.length > 0) || (minute.participants && minute.participants.length > 0)) && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('minutes.participants')}</h2>
            <div className="flex flex-wrap gap-3">
              {minute.participantsWithStatus && minute.participantsWithStatus.length > 0 ? (
                minute.participantsWithStatus
                  .filter(p => p.attendance === 'present')
                  .map((p, index) => {
                    const isGuest = p.userId.startsWith('guest:');
                    const id = isGuest ? p.userId.replace('guest:', '') : p.userId;
                    const user = allUsers.find(u => u._id === id);
                    const displayName = user ? `${user.firstName} ${user.lastName}` : id;
                    
                    return (
                      <span key={index} className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        {displayName}
                        {isGuest && <span className="ml-1 text-xs text-blue-600">({t('minutes.guest')})</span>}
                      </span>
                    );
                  })
              ) : (
                minute.participants.map((participant, index) => (
                  <span key={index} className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    {participant}
                  </span>
                ))
              )}
            </div>
          </div>
        )}



        {/* Global Note */}
        {minute.globalNote && (
          <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-amber-300 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-amber-900 mb-4 flex items-center gap-2">
                  {t('minutes.globalNotes')}
                  <span className="text-sm font-normal text-amber-700 bg-amber-200 px-3 py-1 rounded-full">
                    {minute.globalNote.split('\n\n').length} {t('minutes.entries')}
                  </span>
                </h2>
                <div className="space-y-4">
                  {minute.globalNote.split('\n\n').map((note, index) => (
                    <div key={index} className="bg-white rounded-xl p-5 border-l-4 border-gray-300 shadow-md hover:shadow-lg transition-all">
                      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Topics */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('minutes.topics')}</h2>
          {minute.topics.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-100 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('minutes.noTopics')}</h3>
              <p className="text-gray-600">{t('minutes.noTopicsDescription')}</p>
            </div>
          ) : (
            minute.topics.map((topic, topicIndex) => (
              <div key={topicIndex} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {topicIndex + 1}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">{topic.subject}</h3>
                    </div>
                    {topic.responsibles && topic.responsibles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {topic.responsibles.map((responsible, idx) => (
                          <span key={idx} className="inline-flex items-center text-sm px-3 py-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 rounded-lg border border-purple-200 font-medium">
                            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            {responsible}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Items */}
                {topic.infoItems && topic.infoItems.length > 0 && (
                  <div className="space-y-3">
                    {topic.infoItems.map((item, itemIndex) => {
                      const getPriorityBadge = () => {
                        const badges = {
                          high: { bg: 'bg-red-100', text: 'text-red-800', icon: '🔥', label: t('priority.high') },
                          medium: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '⚠️', label: t('priority.medium') },
                          low: { bg: 'bg-green-100', text: 'text-green-800', icon: '✓', label: t('priority.low') },
                        };
                        return badges[item.priority || 'medium'];
                      };

                      const getStatusBadge = () => {
                        const badges = {
                          open: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '○', label: t('status.open') },
                          'in-progress': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '◐', label: t('status.inProgress') },
                          completed: { bg: 'bg-green-100', text: 'text-green-800', icon: '✓', label: t('status.completed') },
                          cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '✗', label: t('status.cancelled') },
                        };
                        return badges[item.status || 'open'];
                      };

                      const priorityBadge = getPriorityBadge();
                      const statusBadge = getStatusBadge();

                      return (
                        <div 
                          key={itemIndex} 
                          className={`bg-white border-l-4 ${
                            item.itemType === 'actionItem' 
                              ? item.priority === 'high' ? 'border-red-500' 
                                : item.priority === 'low' ? 'border-blue-500'
                                : 'border-orange-500'
                              : 'border-blue-400'
                          } p-4 rounded-lg shadow-sm hover:shadow-md transition-all`}
                        >
                          {/* Type Label and Title */}
                          <div className="mb-2">
                            {item.itemType === 'actionItem' ? (
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600 uppercase tracking-wide">
                                  {t('minutes.actionItem')}
                                </span>
                                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${priorityBadge.bg} ${priorityBadge.text}`}>
                                  {priorityBadge.icon} {priorityBadge.label}
                                </span>
                                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
                                  {statusBadge.icon} {statusBadge.label}
                                </span>
                              </div>
                            ) : (
                              <div className="mb-2">
                                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
                                  ℹ️ {t('minutes.infoItem')}
                                </span>
                              </div>
                            )}
                            <h4 className="font-bold text-gray-900 text-base">{item.subject}</h4>
                          </div>
                          
                          {item.details && (
                            <p className="text-sm text-gray-700 mb-3 leading-relaxed">{item.details}</p>
                          )}

                          {/* Info Items - Show responsible persons if available */}
                          {item.itemType === 'infoItem' && item.responsibles && item.responsibles.length > 0 && (
                            <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center gap-2 text-sm">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="font-semibold text-blue-900">{t('minutes.responsibles')}</span>
                                <span className="text-blue-800 font-medium">
                                  {formatUsersAsInitials(item.responsibles)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Action Items - Structured info boxes */}
                          {item.itemType === 'actionItem' && (
                            <div className="mt-3 space-y-2">
                              {/* Due Date & Responsible in a grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {item.dueDate && (
                                  <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      <div className="flex-1">
                                        <p className="text-xs font-semibold text-orange-900">{t('minutes.dueDate')}</p>
                                        <p className="text-sm font-bold text-orange-800">
                                          {new Date(item.dueDate).toLocaleDateString(locale, { 
                                            day: '2-digit', 
                                            month: 'long', 
                                            year: 'numeric' 
                                          })}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {item.responsibles && item.responsibles.length > 0 && (
                                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                      <div className="flex-1">
                                        <p className="text-xs font-semibold text-indigo-900">
                                          {item.responsibles.length > 1 ? t('minutes.responsiblePlural') : t('minutes.responsible')}
                                        </p>
                                        <p className="text-sm font-bold text-indigo-800">
                                          {formatUsersAsInitials(item.responsibles)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {item.notes && (
                            <div className="mt-3 p-3 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg">
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-gray-700 mb-1">{t('common.note')}</p>
                                  <p className="text-sm text-gray-800">{item.notes}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Reopening History */}
        {minute.reopeningHistory && minute.reopeningHistory.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-amber-300 hover:shadow-2xl transition-all duration-300 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-amber-900 mb-4 flex items-center gap-2">
                  {t('minutes.reopeningHistory')}
                </h2>
                <div className="space-y-4">
                  {minute.reopeningHistory.map((entry, index) => (
                    <div key={index} className="bg-white rounded-xl p-5 border-l-4 border-amber-500 shadow-md hover:shadow-lg transition-all">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">📝</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-900 mb-2">
                            {t('minutes.reopenedAt')} {new Date(entry.reopenedAt).toLocaleString(locale, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} {t('minutes.by')} {allUsers.find(u => u._id === entry.reopenedBy) 
                              ? `${allUsers.find(u => u._id === entry.reopenedBy)?.firstName} ${allUsers.find(u => u._id === entry.reopenedBy)?.lastName}`
                              : entry.reopenedBy}
                          </p>
                          <p className="text-sm text-gray-700 italic bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                            {t('minutes.reason')} {entry.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right">
          <div className="bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-md">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold">{t('common.error')}</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-white hover:text-red-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Finalize Confirmation Dialog */}
      {showFinalizeDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">{t('minutes.finalizeConfirmTitle')}</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {t('minutes.finalizeConfirmText')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinalizeDialog(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmFinalize}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                {t('minutes.finalize')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">{t('minutes.deleteConfirmTitle')}</h3>
            </div>
            <p className="text-gray-600 mb-2">
              {t('minutes.deleteConfirmText')}
            </p>
            <p className="text-red-600 font-semibold text-sm mb-6">
              {t('minutes.deleteConfirmWarning')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Dialog */}
      {showReopenDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">{t('minutes.reopenTitle')}</h3>
            </div>
            <p className="text-gray-600 mb-4">
              {t('minutes.reopenReasonLabel')}
            </p>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder={t('minutes.reopenReasonPlaceholder')}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none transition-all"
              rows={4}
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReopenDialog(false);
                  setReopenReason('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleReopen}
                disabled={!reopenReason.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('minutes.reopen')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
