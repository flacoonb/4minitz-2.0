"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import ConfirmationModal from '@/components/ConfirmationModal';

interface MeetingSeries {
  _id: string;
  project: string;
  name: string;
  description?: string;
  defaultTemplateId?: string;
  moderators: string[];
  participants: string[];
  visibleFor?: string[];
  members?: { userId: string }[];
  createdAt: string;
}

interface ImportTask {
  _id: string;
  subject: string;
  status: string;
  priority: string;
  dueDate?: string;
  responsibles: string[];
}

interface Minute {
  _id: string;
  date: string;
  title?: string;
  finalized: boolean;
  isFinalized: boolean;
  topics: any[];
}

interface MinutesTemplate {
  _id: string;
  name: string;
  description?: string;
  scope: 'global' | 'series';
}

interface MeetingEventInvitee {
  userId: string;
  responseStatus: 'pending' | 'accepted' | 'declined' | 'tentative';
}

interface MeetingEvent {
  _id: string;
  meetingSeriesId: string;
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime?: string;
  location?: string;
  note?: string;
  status: 'draft' | 'invited' | 'confirmed' | 'cancelled' | 'completed';
  linkedMinutesId?: string;
  invitees: MeetingEventInvitee[];
}

interface UserDirectoryEntry {
  _id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
}

interface ClubFunctionEntry {
  _id: string;
  name: string;
  assignedUserId?: string;
  isActive?: boolean;
}

export default function MeetingSeriesPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const { user, loading: _authLoading, hasPermission } = useAuth();
  const t = useTranslations('meetingSeries');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const seriesId = params?.id;

  const [series, setSeries] = useState<MeetingSeries | null>(null);
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [creating, setCreating] = useState(false);

  // Import tasks modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [allSeries, setAllSeries] = useState<{ _id: string; project: string; name?: string }[]>([]);
  const [importSourceId, setImportSourceId] = useState('');
  const [importTasks, setImportTasks] = useState<ImportTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [loadingImportTasks, setLoadingImportTasks] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importResultType, setImportResultType] = useState<'success' | 'error' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [meetingEvents, setMeetingEvents] = useState<MeetingEvent[]>([]);
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventActionLoadingId, setEventActionLoadingId] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [userDirectory, setUserDirectory] = useState<Record<string, UserDirectoryEntry>>({});
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('19:00');
  const [eventEndTime, setEventEndTime] = useState('21:00');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);
  const [eventToDelete, setEventToDelete] = useState<MeetingEvent | null>(null);
  const [functionNamesByUserId, setFunctionNamesByUserId] = useState<Record<string, string[]>>({});

  // Check permissions
  const username = user?.username || '';
  const userId = user?._id || '';
  const isModerator = series?.moderators?.includes(username) || series?.moderators?.includes(userId) || false;
  const isParticipant =
    series?.participants?.includes(username) ||
    series?.participants?.includes(userId) ||
    series?.visibleFor?.includes(username) ||
    series?.visibleFor?.includes(userId) ||
    series?.members?.some((member) => member.userId === userId) ||
    false;
  const canEditSeries = hasPermission('canModerateAllMeetings') || isModerator;
  const canDeleteSeries = hasPermission('canModerateAllMeetings') || isModerator; // Using moderate permission for delete as well
  const canCreateMinute =
    hasPermission('canCreateMeetings') &&
    (hasPermission('canModerateAllMeetings') || isModerator || isParticipant);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use cookie/JWT-based authentication; include credentials so server can
      // authenticate the request. Server will enforce visibility rules.
      const [sRes, mRes, eRes] = await Promise.all([
        fetch(`/api/meeting-series/${seriesId}`, { credentials: 'include' }),
        fetch(`/api/minutes?meetingSeriesId=${seriesId}`, { credentials: 'include' }),
        fetch(`/api/meeting-events?meetingSeriesId=${seriesId}`, { credentials: 'include' }),
      ]);

      if (!sRes.ok) throw new Error(t('loadError'));
      if (!mRes.ok) throw new Error(t('loadError'));

      const sJson = await sRes.json();
      const mJson = await mRes.json();
      const eJson = eRes.ok ? await eRes.json() : { data: [] };

      setSeries(sJson.data || null);
      const minutesData = mJson.data || [];
      setMinutes(minutesData);
      setMeetingEvents(Array.isArray(eJson.data) ? eJson.data : []);

      // Check if there's a draft
      const draftExists = minutesData.some((m: Minute) => !m.isFinalized && !m.finalized);
      setHasDraft(draftExists);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unknownError'));
    } finally {
      setLoading(false);
    }
  }, [seriesId, t]);

  useEffect(() => {
    if (!seriesId) return;
    // Don't wait for auth, allow immediate loading with fallback user
    fetchData();
  }, [seriesId, user?._id, fetchData]);

  useEffect(() => {
    if (!series?.members?.length) return;
    setSelectedInviteeIds(series.members.map((member) => member.userId));
  }, [series?._id, series?.members]);

  useEffect(() => {
    const fetchFunctions = async () => {
      try {
        const response = await fetch('/api/club-functions?includeInactive=true', {
          credentials: 'include',
        });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        const data: ClubFunctionEntry[] = Array.isArray(payload?.data) ? payload.data : [];
        const map: Record<string, string[]> = {};
        for (const entry of data) {
          const userIdValue = String(entry.assignedUserId || '').trim();
          const fnName = String(entry.name || '').trim();
          if (!userIdValue || !fnName) continue;
          map[userIdValue] = map[userIdValue] || [];
          map[userIdValue].push(fnName);
        }
        Object.keys(map).forEach((userIdValue) => {
          map[userIdValue] = Array.from(new Set(map[userIdValue])).sort((a, b) => a.localeCompare(b));
        });
        setFunctionNamesByUserId(map);
      } catch {
        setFunctionNamesByUserId({});
      }
    };
    fetchFunctions();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users?limit=500', { credentials: 'include' });
        if (!response.ok) return;
        const result = await response.json();
        if (isCancelled) return;
        const entries: UserDirectoryEntry[] = Array.isArray(result.data) ? result.data : [];
        const map: Record<string, UserDirectoryEntry> = {};
        entries.forEach((entry) => {
          if (!entry?._id) return;
          map[entry._id] = entry;
        });
        setUserDirectory(map);
      } catch {
        // non-blocking
      }
    };
    fetchUsers();
    return () => {
      isCancelled = true;
    };
  }, []);

  const createNewProtocol = async (templateId?: string) => {
    if (!series) return;

    setCreating(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const response = await fetch('/api/minutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          meetingSeries_id: series._id,
          date: today,
          participants: series.participants || [],
          topics: [],
          globalNote: '',
          isFinalized: false,
          templateId: templateId || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('errorCreatingProtocol'));
      }

      const result = await response.json();

      // Redirect to edit page
      router.push(`/minutes/${result.data._id}/edit`);
    } catch (err) {
      console.error('Error creating protocol:', err);
      alert(t('errorCreatingProtocol') + ': ' + (err instanceof Error ? err.message : t('unknownError')));
    } finally {
      setCreating(false);
    }
  };

  const resolveUserLabel = (userIdValue: string) => {
    const userEntry = userDirectory[userIdValue];
    if (!userEntry) return userIdValue;
    const fullName = `${userEntry.firstName || ''} ${userEntry.lastName || ''}`.trim();
    const fnNames = functionNamesByUserId[userIdValue] || [];
    const fnLabel = fnNames.length > 0 ? ` (${fnNames.join(', ')})` : '';
    return (fullName || userEntry.username || userEntry.email || userIdValue) + fnLabel;
  };

  const formatEventDateTime = (event: MeetingEvent) => {
    const dateLabel = new Date(event.scheduledDate).toLocaleDateString(locale);
    const endPart = event.endTime ? ` - ${event.endTime}` : '';
    return `${dateLabel}, ${event.startTime}${endPart}`;
  };

  const getInviteeCounts = (event: MeetingEvent) => {
    const counts = { pending: 0, accepted: 0, declined: 0, tentative: 0 };
    event.invitees?.forEach((invitee) => {
      if (invitee.responseStatus in counts) {
        (counts as any)[invitee.responseStatus] += 1;
      }
    });
    return counts;
  };

  const resetEventForm = () => {
    const defaultDate = new Date().toISOString().split('T')[0];
    setEventTitle('');
    setEventDate(defaultDate);
    setEventStartTime('19:00');
    setEventEndTime('21:00');
    setEventLocation('');
    setEventNote('');
    setSelectedInviteeIds(series?.members?.map((member) => member.userId) || []);
  };

  const createMeetingEvent = async () => {
    if (!series) return;
    if (!eventTitle.trim() || !eventDate || !eventStartTime) {
      setEventError(t('planner.validationRequired'));
      return;
    }
    setCreatingEvent(true);
    setEventError(null);
    try {
      const response = await fetch('/api/meeting-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          meetingSeriesId: series._id,
          title: eventTitle.trim(),
          scheduledDate: eventDate,
          startTime: eventStartTime,
          endTime: eventEndTime || undefined,
          location: eventLocation.trim() || undefined,
          note: eventNote.trim() || undefined,
          inviteeUserIds: selectedInviteeIds,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t('planner.errors.createFailed'));
      setMeetingEvents((prev) =>
        [...prev, result.data].sort((a, b) => {
          const left = new Date(a.scheduledDate).getTime();
          const right = new Date(b.scheduledDate).getTime();
          return left - right;
        })
      );
      setShowEventCreator(false);
      resetEventForm();
    } catch (err) {
      setEventError(err instanceof Error ? err.message : t('planner.errors.createFailed'));
    } finally {
      setCreatingEvent(false);
    }
  };

  const sendEventInvites = async (eventId: string) => {
    setEventActionLoadingId(eventId);
    setEventError(null);
    try {
      const response = await fetch(`/api/meeting-events/${eventId}/send-invites`, {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t('planner.errors.invitesFailed'));
      await fetchData();
    } catch (err) {
      setEventError(err instanceof Error ? err.message : t('planner.errors.invitesFailed'));
    } finally {
      setEventActionLoadingId(null);
    }
  };

  const prepareMinutesFromEvent = async (eventId: string) => {
    setEventActionLoadingId(eventId);
    setEventError(null);
    try {
      const response = await fetch(`/api/meeting-events/${eventId}/prepare-minutes`, {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t('planner.errors.prepareFailed'));
      const minutesId = result?.data?.minutesId;
      if (minutesId) {
        router.push(`/minutes/${minutesId}/edit`);
        return;
      }
      await fetchData();
    } catch (err) {
      setEventError(err instanceof Error ? err.message : t('planner.errors.prepareFailed'));
    } finally {
      setEventActionLoadingId(null);
    }
  };

  const deleteMeetingEvent = async (event: MeetingEvent) => {
    setEventActionLoadingId(event._id);
    setEventError(null);
    try {
      const response = await fetch(`/api/meeting-events/${event._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t('planner.errors.cancelFailed'));
      setMeetingEvents((prev) => prev.filter((entry) => entry._id !== event._id));
      setEventToDelete(null);
    } catch (err) {
      setEventError(err instanceof Error ? err.message : t('planner.errors.cancelFailed'));
    } finally {
      setEventActionLoadingId(null);
    }
  };

  const toggleInvitee = (inviteeId: string) => {
    setSelectedInviteeIds((prev) =>
      prev.includes(inviteeId) ? prev.filter((value) => value !== inviteeId) : [...prev, inviteeId]
    );
  };

  const deleteSeries = async () => {
    if (!series) return;

    try {
      const response = await fetch(`/api/meeting-series/${series._id}`, {
        method: 'DELETE',
        credentials: 'include', // Use cookies for authentication
      });

      if (!response.ok) {
        await response.json();
        throw new Error(t('loadListError'));
      }

      // Redirect to meeting series list
      router.push('/meeting-series');
    } catch (err) {
      console.error('Error deleting series:', err);
      alert(t('errorDeleting', { error: err instanceof Error ? err.message : t('unknownError') }));
    }
  };

  const deleteConfirmMessage = minutes.length > 0
    ? t('confirmDeleteWithMinutes', { count: minutes.length })
    : t('confirmDeleteEmpty');

  const openImportModal = async () => {
    setShowImportModal(true);
    setImportSourceId('');
    setImportTasks([]);
    setSelectedTaskIds(new Set());
    setImportResult(null);
    try {
      const res = await fetch('/api/meeting-series', { credentials: 'include' });
      if (res.ok) {
        const result = await res.json();
        const others = (result.data || []).filter((s: { _id: string }) => s._id !== seriesId);
        setAllSeries(others);
      }
    } catch { /* ignore */ }
  };

  const openTemplateModal = async () => {
    if (!series) return;
    setShowTemplateModal(true);
    setSelectedTemplateId('');
    setTemplatesError(null);
    setLoadingTemplates(true);
    try {
      const response = await fetch(
        `/api/minutes-templates?meetingSeriesId=${series._id}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t('templateLoadError'));
      }
      const result = await response.json();
      const loadedTemplates: MinutesTemplate[] = Array.isArray(result.data)
        ? result.data.filter((template: any) => template && typeof template._id === 'string')
        : [];
      setTemplates(loadedTemplates);
      const defaultTemplateId = series.defaultTemplateId ? String(series.defaultTemplateId).trim() : '';
      if (defaultTemplateId && loadedTemplates.some((template) => template._id === defaultTemplateId)) {
        setSelectedTemplateId(defaultTemplateId);
      } else {
        setSelectedTemplateId('');
      }
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : t('templateLoadError'));
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadSourceTasks = async (sourceId: string) => {
    setImportSourceId(sourceId);
    setImportTasks([]);
    setSelectedTaskIds(new Set());
    if (!sourceId) return;

    setLoadingImportTasks(true);
    try {
      const res = await fetch(`/api/meeting-series/${sourceId}/open-tasks`, { credentials: 'include' });
      if (res.ok) {
        const result = await res.json();
        const tasks = result.data || [];
        setImportTasks(tasks);
        setSelectedTaskIds(new Set(tasks.map((t: ImportTask) => t._id)));
      }
    } catch { /* ignore */ }
    finally { setLoadingImportTasks(false); }
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAllTasks = () => {
    if (selectedTaskIds.size === importTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(importTasks.map(t => t._id)));
    }
  };

  const executeImport = async () => {
    if (selectedTaskIds.size === 0) return;
    setImportResult(null);
    setImportResultType(null);
    setImporting(true);
    try {
      const res = await fetch(`/api/meeting-series/${seriesId}/import-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceSeriesId: importSourceId,
          taskIds: Array.from(selectedTaskIds),
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setImportResultType('success');
        setImportResult(t('tasksImportedSuccess', { count: result.imported }));
        setImportTasks([]);
        setSelectedTaskIds(new Set());
      } else {
        const err = await res.json();
        setImportResultType('error');
        setImportResult(t('importError', { error: err.error || t('importFailed') }));
      }
    } catch {
      setImportResultType('error');
      setImportResult(t('importFailed'));
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[var(--brand-primary)] mx-auto mb-4"></div>
          <p className="text-gray-600 animate-pulse">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">{t('loadError')}</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link
          href="/meeting-series"
          className="inline-flex items-center text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] text-sm font-medium mb-3 hover:scale-105 transition-all"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('backToSeries')}
        </Link>

        <div className="bg-[var(--brand-primary-soft)] rounded-xl p-4 sm:p-5 border border-[var(--brand-primary-border)]">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 brand-gradient-bg rounded-xl flex items-center justify-center shadow">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent break-words" style={{ backgroundImage: 'linear-gradient(90deg, var(--brand-text), var(--brand-text-muted))' }}>
                  {series.project}{series.name ? ` – ${series.name}` : ''}
                </h1>
                {series.description && (
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed app-text-muted">
                    {series.description}
                  </p>
                )}
              </div>
            </div>
            <div className="w-full md:w-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-2.5">
              {canEditSeries && (
                <button
                  onClick={openImportModal}
                  className="inline-flex w-full justify-center items-center gap-2 px-4 py-2.5 min-h-11 rounded-lg shadow-md hover:shadow-lg transition-all"
                  style={{ background: 'linear-gradient(90deg, var(--brand-warning), var(--brand-warning))', color: '#fff' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('importTasks')}
                </button>
              )}
              {canEditSeries && (
                <Link
                  href={`/meeting-series/${series._id}/templates`}
                  className="inline-flex w-full justify-center items-center gap-2 px-4 py-2.5 min-h-11 rounded-lg shadow-md hover:shadow-lg transition-all"
                  style={{ background: 'linear-gradient(90deg, var(--brand-secondary), var(--brand-accent))', color: '#fff' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M5 7h14" />
                  </svg>
                  {t('manageSeriesTemplates')}
                </Link>
              )}
              {canEditSeries && (
                <Link
                  href={`/meeting-series/${series._id}/edit`}
                  className="inline-flex w-full justify-center items-center gap-2 px-4 py-2.5 min-h-11 rounded-lg shadow-md hover:shadow-lg transition-all"
                  style={{ background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-primary-strong))', color: '#fff' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {tCommon('edit')}
                </Link>
              )}
              {canDeleteSeries && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex w-full justify-center items-center gap-2 px-4 py-2.5 min-h-11 rounded-lg shadow-md hover:shadow-lg transition-all"
                  style={{ background: 'linear-gradient(90deg, var(--brand-danger), var(--brand-danger))', color: '#fff' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {tCommon('delete')}
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Planner Section */}
      <div className="app-card rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('planner.title')}</h2>
            <p className="text-sm text-gray-600">{t('planner.subtitle')}</p>
          </div>
          {canCreateMinute && (
            <button
              onClick={() => {
                resetEventForm();
                setShowEventCreator((prev) => !prev);
                setEventError(null);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 brand-button-solid rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showEventCreator ? t('planner.closeInput') : t('planner.planMeeting')}
            </button>
          )}
        </div>

        {showEventCreator && (
          <div className="mb-6 p-4 rounded-xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('planner.form.titleLabel')}</label>
                <input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder={t('planner.form.titlePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('planner.form.dateLabel')}</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('planner.form.startTimeLabel')}</label>
                <input
                  type="time"
                  value={eventStartTime}
                  onChange={(e) => setEventStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('planner.form.endTimeLabel')}</label>
                <input
                  type="time"
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('planner.form.locationLabel')}</label>
                <input
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder={t('planner.form.locationPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('planner.form.noteOptionalLabel')}</label>
                <textarea
                  value={eventNote}
                  onChange={(e) => setEventNote(e.target.value)}
                  rows={2}
                  placeholder={t('planner.form.notePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                {t('planner.form.invitedMembers', { count: selectedInviteeIds.length })}
              </p>
              {series.members?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {series.members.map((member) => (
                    <label
                      key={member.userId}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInviteeIds.includes(member.userId)}
                        onChange={() => toggleInvitee(member.userId)}
                        className="h-4 w-4 text-[var(--brand-primary)] rounded"
                      />
                      <span className="text-sm text-gray-800">{resolveUserLabel(member.userId)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('planner.form.noMembers')}</p>
              )}
            </div>

            {eventError && <p className="text-sm text-red-700">{eventError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEventCreator(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={createMeetingEvent}
                disabled={creatingEvent}
                className="px-4 py-2 rounded-lg brand-button-solid disabled:opacity-50"
              >
                {creatingEvent ? t('saving') : t('planner.form.createMeeting')}
              </button>
            </div>
          </div>
        )}

        {meetingEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-600">
            {t('planner.noPlannedMeetings')}
          </div>
        ) : (
          <div className="space-y-3">
            {meetingEvents.map((event) => {
              const counts = getInviteeCounts(event);
              const isActionLoading = eventActionLoadingId === event._id;
              return (
                <div key={event._id} className="rounded-xl border border-gray-200 p-4 bg-white">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{event.title}</p>
                      <p className="text-sm text-gray-600">{formatEventDateTime(event)}</p>
                      {event.location && <p className="text-sm text-gray-600">{event.location}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]">{t('planner.status.pending')} {counts.pending}</span>
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">{t('planner.status.accepted')} {counts.accepted}</span>
                      <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">{t('planner.status.tentative')} {counts.tentative}</span>
                      <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-800">{t('planner.status.declined')} {counts.declined}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => sendEventInvites(event._id)}
                      disabled={isActionLoading}
                      className="px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-sm hover:bg-[var(--brand-primary-strong)] disabled:opacity-50"
                    >
                      {t('planner.actions.sendInvites')}
                    </button>
                    <button
                      onClick={() => prepareMinutesFromEvent(event._id)}
                      disabled={isActionLoading || (event.status !== 'invited' && event.status !== 'confirmed')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        event.status !== 'invited' && event.status !== 'confirmed'
                          ? t('planner.actions.prepareHint')
                          : undefined
                      }
                    >
                      {t('planner.actions.prepareMinute')}
                    </button>
                    <button
                      onClick={() => setEventToDelete(event)}
                      disabled={isActionLoading}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-50"
                    >
                      {t('planner.actions.cancelMeeting')}
                    </button>
                    {event.linkedMinutesId && (
                      <Link
                        href={`/minutes/${event.linkedMinutesId}/edit`}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                      >
                        {t('planner.actions.toDraft')}
                      </Link>
                    )}
                  </div>
                  {event.status !== 'invited' && event.status !== 'confirmed' && (
                    <p className="mt-2 text-xs text-amber-700">
                      {t('planner.actions.prepareInactiveHint')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Protokolle Section */}
      <div className="app-card rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{t('minutesCount', { count: minutes.length })}</h2>
        </div>

        {minutes.length === 0 ? (
          <div className="p-6 bg-gradient-to-br from-gray-50 to-[var(--brand-page-to)] rounded-xl text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noMinutes')}</h3>
            <p className="text-gray-600 mb-4">{t('noMinutesText')}</p>
            <p className="text-sm text-gray-500">{t('noMinutesHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {minutes.map((minute, index) => (
              <Link
                key={minute._id}
                href={`/minutes/${minute._id}`}
                className="block p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border hover:shadow-lg transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 brand-gradient-bg rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 break-words">
                        {minute.title ? (
                          <span>{minute.title} <span className="text-gray-500 font-normal text-sm">({new Date(minute.date).toLocaleDateString(locale)})</span></span>
                        ) : (
                          `${series.project}${series.name ? ` – ${series.name}` : ''} – ${new Date(minute.date).toLocaleDateString(locale)}`
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {minute.topics?.length ? t('topicsCount', { count: minute.topics.length }) : t('noTopics')} •
                        {minute.isFinalized || minute.finalized ? t('finalized') : t('draft')}
                      </p>
                    </div>
                  </div>
                  <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-medium ${minute.isFinalized || minute.finalized
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                    {minute.isFinalized || minute.finalized ? t('finalized') : t('draft')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* New Protocol Button - Only show if no draft exists and user has permission */}
        {!hasDraft && canCreateMinute && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={openTemplateModal}
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg shadow-md hover:shadow-lg hover:scale-[1.01] transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {t('creatingMinute')}
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t('createMinute')}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Import Tasks Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-gray-900">{t('importTasks')}</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg"
                  aria-label={t('planner.closeDialogAria')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {t('importTasksSubtitle')}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Source Series Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('sourceSeries')}
                </label>
                <select
                  value={importSourceId}
                  onChange={(e) => loadSourceTasks(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent bg-white"
                >
                  <option value="">{t('selectSeries')}</option>
                  {allSeries.map(s => (
                    <option key={s._id} value={s._id}>
                      {s.project}{s.name ? ` – ${s.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Loading */}
              {loadingImportTasks && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]"></div>
                </div>
              )}

              {/* Task List */}
              {importSourceId && !loadingImportTasks && importTasks.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  {t('noOpenTasks')}
                </div>
              )}

              {importTasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      {t('selectedOfTotal', { selected: selectedTaskIds.size, total: importTasks.length })}
                    </span>
                    <button
                      onClick={toggleAllTasks}
                      className="text-sm text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)]"
                    >
                      {selectedTaskIds.size === importTasks.length ? t('deselectAll') : t('selectAll')}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {importTasks.map(task => (
                      <label
                        key={task._id}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedTaskIds.has(task._id)
                            ? 'border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)]'
                            : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task._id)}
                          onChange={() => toggleTask(task._id)}
                          className="mt-1 h-4 w-4 text-[var(--brand-primary)] rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{task.subject}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className={`px-1.5 py-0.5 text-xs rounded ${task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>
                              {task.status === 'in-progress' ? t('inProgressStatus') : t('openStatus')}
                            </span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                                task.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                                  'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]'
                              }`}>
                              {task.priority === 'high' ? t('highPriority') : task.priority === 'medium' ? t('mediumPriority') : t('lowPriority')}
                            </span>
                            {task.dueDate && (
                              <span className="px-1.5 py-0.5 text-xs bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] rounded">
                                {t('dueLabel')}: {new Date(task.dueDate).toLocaleDateString(locale)}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div className={`p-3 rounded-lg text-sm ${importResultType === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                  }`}>
                  {importResult}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('close')}
              </button>
              {importTasks.length > 0 && selectedTaskIds.size > 0 && (
                <button
                  onClick={executeImport}
                  disabled={importing}
                  className="px-6 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-strong)] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {t('importingTasks')}
                    </>
                  ) : (
                    t('importNTasks', { count: selectedTaskIds.size })
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-gray-900">{t('chooseTemplateTitle')}</h2>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{t('chooseTemplateHint')}</p>
            </div>

            <div className="p-6 space-y-4">
              {loadingTemplates && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]"></div>
                </div>
              )}

              {templatesError && (
                <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                  {templatesError}
                </div>
              )}

              {!loadingTemplates && (
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTemplateId === '' ? 'border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)]' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={selectedTemplateId === ''}
                      onChange={() => setSelectedTemplateId('')}
                      className="mt-1 h-4 w-4 text-[var(--brand-primary)]"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{t('templateNone')}</p>
                      <p className="text-sm text-gray-600">{t('templateNoneHint')}</p>
                    </div>
                  </label>

                  {templates.map((template) => (
                    <label
                      key={template._id}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedTemplateId === template._id
                          ? 'border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={selectedTemplateId === template._id}
                        onChange={() => setSelectedTemplateId(template._id)}
                        className="mt-1 h-4 w-4 text-[var(--brand-primary)]"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900">{template.name}</p>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                            {template.scope === 'global' ? t('templateGlobal') : t('templateSeries')}
                          </span>
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                        )}
                      </div>
                    </label>
                  ))}

                  {!templatesError && templates.length === 0 && (
                    <p className="text-sm text-gray-500">{t('noTemplatesAvailable')}</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  createNewProtocol(selectedTemplateId || undefined);
                }}
                disabled={creating}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {creating ? t('creatingMinute') : t('createMinute')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(eventToDelete)}
        onClose={() => setEventToDelete(null)}
        onConfirm={() => {
          if (!eventToDelete) return;
          deleteMeetingEvent(eventToDelete);
        }}
        title={t('planner.deleteConfirmTitle')}
        message={
          eventToDelete
            ? t('planner.deleteConfirmMessageWithDate', {
                title: eventToDelete.title,
                date: new Date(eventToDelete.scheduledDate).toLocaleDateString(locale),
              })
            : t('planner.deleteConfirmMessage')
        }
        confirmText={t('planner.deleteConfirmAction')}
        cancelText={tCommon('cancel')}
        isProcessing={Boolean(eventToDelete && eventActionLoadingId === eventToDelete._id)}
        type="danger"
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteSeries();
        }}
        title={tCommon('delete')}
        message={deleteConfirmMessage}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        type="danger"
      />
    </div>
  );
}
