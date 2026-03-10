'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';

type MeetingEvent = {
  _id: string;
  meetingSeriesId: string;
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime?: string;
  location?: string;
  note?: string;
  minutesTemplateId?: string;
  pdfTemplateId?: string;
  status: 'draft' | 'invited' | 'confirmed' | 'cancelled' | 'completed';
  invitees?: Array<{ responseStatus?: 'pending' | 'accepted' | 'tentative' | 'declined' }>;
  linkedMinutesId?: string;
};

type MeetingSeries = {
  _id: string;
  project?: string;
  name?: string;
  defaultTemplateId?: string;
  defaultPdfTemplateId?: string;
};

type MinutesTemplateOption = {
  _id: string;
  name: string;
  scope: 'global' | 'series';
};

type PdfTemplateOption = {
  _id: string;
  name: string;
  isActive?: boolean;
};

type MinuteItem = {
  _id: string;
  date: string;
  title?: string;
  isFinalized?: boolean;
  meetingSeries_id?: string | { _id?: string; project?: string; name?: string };
};

type CalendarEntry = {
  id: string;
  kind: 'event' | 'minute';
  dateKey: string;
  title: string;
  meetingSeriesLabel: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  note?: string;
  statusLabel?: string;
  minutesId?: string;
  meetingSeriesId?: string;
};

export default function PlanningPage() {
  const t = useTranslations('planning');
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading, hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [minutes, setMinutes] = useState<MinuteItem[]>([]);
  const [seriesById, setSeriesById] = useState<Record<string, MeetingSeries>>({});
  const [seriesList, setSeriesList] = useState<MeetingSeries[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [eventSeriesId, setEventSeriesId] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartTime, setEventStartTime] = useState('19:00');
  const [eventEndTime, setEventEndTime] = useState('21:00');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [eventMinutesTemplateId, setEventMinutesTemplateId] = useState('');
  const [eventPdfTemplateId, setEventPdfTemplateId] = useState('');
  const [minutesTemplateOptions, setMinutesTemplateOptions] = useState<MinutesTemplateOption[]>([]);
  const [pdfTemplateOptions, setPdfTemplateOptions] = useState<PdfTemplateOption[]>([]);
  const [selectedCalendarEntry, setSelectedCalendarEntry] = useState<CalendarEntry | null>(null);

  const canAccessPlanning = Boolean(user && (user.role === 'admin' || user.role === 'moderator'));
  const canCreateEvent = Boolean(user && hasPermission('canCreateMeetings'));

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getSeriesDefaults = useCallback(
    (seriesId: string) => {
      const selectedSeries = seriesList.find((series) => series._id === seriesId);
      return {
        minutesTemplateId: selectedSeries?.defaultTemplateId ? String(selectedSeries.defaultTemplateId) : '',
        pdfTemplateId: selectedSeries?.defaultPdfTemplateId ? String(selectedSeries.defaultPdfTemplateId) : '',
      };
    },
    [seriesList]
  );

  const resetCreateForm = useCallback(
    (dateValue?: string) => {
      const fallbackSeriesId = eventSeriesId || (seriesList[0]?._id || '');
      const defaults = getSeriesDefaults(fallbackSeriesId);
      setSelectedDate(dateValue || formatDateKey(new Date()));
      setEventSeriesId(fallbackSeriesId);
      setEventTitle('');
      setEventStartTime('19:00');
      setEventEndTime('21:00');
      setEventLocation('');
      setEventNote('');
      setEventMinutesTemplateId(defaults.minutesTemplateId);
      setEventPdfTemplateId(defaults.pdfTemplateId);
      setCreateError(null);
    },
    [eventSeriesId, seriesList, getSeriesDefaults]
  );

  const fetchPlanningData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventsRes, seriesRes, minutesRes] = await Promise.all([
        fetch('/api/meeting-events', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/meeting-series', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/minutes?limit=200', { credentials: 'include', cache: 'no-store' }),
      ]);

      if (!eventsRes.ok) {
        throw new Error(t('loadError'));
      }

      const eventsJson = await eventsRes.json();
      const seriesJson = seriesRes.ok ? await seriesRes.json() : { data: [] };
      const minutesJson = minutesRes.ok ? await minutesRes.json() : { data: [] };
      const loadedEvents = Array.isArray(eventsJson?.data) ? eventsJson.data : [];
      const loadedSeries = Array.isArray(seriesJson?.data) ? seriesJson.data : [];
      const loadedMinutes = Array.isArray(minutesJson?.data) ? minutesJson.data : [];

      const map: Record<string, MeetingSeries> = {};
      for (const series of loadedSeries) {
        if (series?._id) map[String(series._id)] = series;
      }

      setSeriesById(map);
      setSeriesList(loadedSeries);
      setEvents(loadedEvents);
      setMinutes(loadedMinutes);
      setEventSeriesId((prev) => prev || (loadedSeries[0]?._id || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (!authLoading && user && !canAccessPlanning) {
      router.push('/dashboard');
      return;
    }
    if (!authLoading && canAccessPlanning) {
      fetchPlanningData();
    }
  }, [authLoading, user, canAccessPlanning, fetchPlanningData, router]);

  useEffect(() => {
    const shouldLockScroll = showCreateModal || Boolean(selectedCalendarEntry);
    if (!shouldLockScroll) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCreateModal, selectedCalendarEntry]);

  useEffect(() => {
    if (!showCreateModal || !eventSeriesId) return;
    const defaults = getSeriesDefaults(eventSeriesId);
    setEventMinutesTemplateId(defaults.minutesTemplateId);
    setEventPdfTemplateId(defaults.pdfTemplateId);
  }, [showCreateModal, eventSeriesId, getSeriesDefaults]);

  useEffect(() => {
    if (!showCreateModal || !eventSeriesId) return;
    let cancelled = false;

    const loadTemplateOptions = async () => {
      try {
        const [minutesTemplatesRes, pdfTemplatesRes] = await Promise.all([
          fetch(`/api/minutes-templates?meetingSeriesId=${eventSeriesId}`, {
            credentials: 'include',
            cache: 'no-store',
          }),
          fetch('/api/pdf-templates', {
            credentials: 'include',
            cache: 'no-store',
          }),
        ]);

        const minutesTemplatesJson = minutesTemplatesRes.ok ? await minutesTemplatesRes.json() : { data: [] };
        const pdfTemplatesJson = pdfTemplatesRes.ok ? await pdfTemplatesRes.json() : { data: [] };
        if (cancelled) return;

        const loadedMinutesTemplates: MinutesTemplateOption[] = Array.isArray(minutesTemplatesJson?.data)
          ? minutesTemplatesJson.data
          : [];
        const loadedPdfTemplates: PdfTemplateOption[] = Array.isArray(pdfTemplatesJson?.data)
          ? pdfTemplatesJson.data
          : [];

        setMinutesTemplateOptions(loadedMinutesTemplates);
        setPdfTemplateOptions(loadedPdfTemplates);

        const defaults = getSeriesDefaults(eventSeriesId);
        setEventMinutesTemplateId((prev) => {
          if (prev && loadedMinutesTemplates.some((option) => option._id === prev)) return prev;
          if (
            defaults.minutesTemplateId &&
            loadedMinutesTemplates.some((option) => option._id === defaults.minutesTemplateId)
          ) {
            return defaults.minutesTemplateId;
          }
          return '';
        });
        setEventPdfTemplateId((prev) => {
          if (prev && loadedPdfTemplates.some((option) => option._id === prev)) return prev;
          if (defaults.pdfTemplateId && loadedPdfTemplates.some((option) => option._id === defaults.pdfTemplateId)) {
            return defaults.pdfTemplateId;
          }
          return '';
        });
      } catch {
        if (cancelled) return;
        setMinutesTemplateOptions([]);
        setPdfTemplateOptions([]);
      }
    };

    loadTemplateOptions();

    return () => {
      cancelled = true;
    };
  }, [showCreateModal, eventSeriesId, getSeriesDefaults]);

  const filteredEvents = useMemo(() => {
    if (statusFilter === 'all') return events;
    return events.filter((event) => event.status === statusFilter);
  }, [events, statusFilter]);

  const getSeriesLabel = useCallback((event: MeetingEvent) => {
    const series = seriesById[event.meetingSeriesId];
    if (!series) return t('unknownSeries');
    return series.name ? `${series.project || ''} - ${series.name}`.trim() : series.project || t('unknownSeries');
  }, [seriesById, t]);

  const formatDateTime = (event: MeetingEvent) => {
    const dateText = new Date(event.scheduledDate).toLocaleDateString(locale);
    const end = event.endTime ? `-${event.endTime}` : '';
    return `${dateText} ${event.startTime}${end}`;
  };

  const getRsvpStats = (event: MeetingEvent) => {
    const invitees = Array.isArray(event.invitees) ? event.invitees : [];
    return {
      total: invitees.length,
      accepted: invitees.filter((i) => i.responseStatus === 'accepted').length,
      tentative: invitees.filter((i) => i.responseStatus === 'tentative').length,
      declined: invitees.filter((i) => i.responseStatus === 'declined').length,
      pending: invitees.filter((i) => !i.responseStatus || i.responseStatus === 'pending').length,
    };
  };

  const statusBadgeClass: Record<MeetingEvent['status'], string> = {
    draft: 'bg-[var(--brand-muted-soft)] text-[var(--brand-text-muted)]',
    invited: 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]',
    confirmed: 'bg-[var(--brand-success-soft)] text-[var(--brand-success)]',
    cancelled: 'bg-[var(--brand-danger-soft)] text-[var(--brand-danger)]',
    completed: 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]',
  };

  const calendarEntriesByDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};

    for (const event of events) {
      const key = formatDateKey(new Date(event.scheduledDate));
      map[key] = map[key] || [];
      map[key].push({
        id: event._id,
        kind: 'event',
        dateKey: key,
        title: event.title,
        meetingSeriesLabel: getSeriesLabel(event),
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        note: event.note,
        statusLabel: t(`status.${event.status}`),
        minutesId: event.linkedMinutesId,
        meetingSeriesId: event.meetingSeriesId,
      });
    }

    for (const minute of minutes) {
      const dateObj = new Date(minute.date);
      if (Number.isNaN(dateObj.getTime())) continue;
      const key = formatDateKey(dateObj);
      const seriesId =
        typeof minute.meetingSeries_id === 'string'
          ? minute.meetingSeries_id
          : minute.meetingSeries_id?._id;
      const seriesLabel =
        typeof minute.meetingSeries_id === 'object' && minute.meetingSeries_id
          ? minute.meetingSeries_id.name
            ? `${minute.meetingSeries_id.project || ''} - ${minute.meetingSeries_id.name}`.trim()
            : minute.meetingSeries_id.project || t('unknownSeries')
          : seriesId
            ? (seriesById[seriesId]?.name
                ? `${seriesById[seriesId]?.project || ''} - ${seriesById[seriesId]?.name}`.trim()
                : seriesById[seriesId]?.project || t('unknownSeries'))
            : t('unknownSeries');

      map[key] = map[key] || [];
      map[key].push({
        id: `minute-${minute._id}`,
        kind: 'minute',
        dateKey: key,
        title: minute.title || t('minuteEntryDefaultTitle'),
        meetingSeriesLabel: seriesLabel,
        statusLabel: minute.isFinalized ? t('minuteFinalized') : t('minuteDraft'),
        minutesId: minute._id,
        meetingSeriesId: seriesId,
      });
    }

    Object.values(map).forEach((entries) => {
      entries.sort((left, right) => {
        const lt = left.startTime || '99:99';
        const rt = right.startTime || '99:99';
        return lt.localeCompare(rt);
      });
    });

    return map;
  }, [events, minutes, t, seriesById, getSeriesLabel]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const mondayBased = (firstDayOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayBased);
    const days: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [calendarMonth]);

  const calendarWeekdays = useMemo(() => {
    const monday = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01 is Monday
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setUTCDate(monday.getUTCDate() + index);
      return formatter.format(day).replace(/\.$/, '');
    });
  }, [locale]);

  const openCreateForDate = (date: Date) => {
    if (!canCreateEvent) return;
    resetCreateForm(formatDateKey(date));
    setShowCreateModal(true);
  };

  const createEvent = async () => {
    if (!eventSeriesId || !eventTitle.trim() || !selectedDate || !eventStartTime) {
      setCreateError(t('create.validationError'));
      return;
    }
    setCreatingEvent(true);
    setCreateError(null);
    try {
      const response = await fetch('/api/meeting-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          meetingSeriesId: eventSeriesId,
          title: eventTitle.trim(),
          scheduledDate: selectedDate,
          startTime: eventStartTime,
          endTime: eventEndTime || undefined,
          location: eventLocation.trim() || undefined,
          note: eventNote.trim() || undefined,
          minutesTemplateId: eventMinutesTemplateId || undefined,
          pdfTemplateId: eventPdfTemplateId || undefined,
          inviteeUserIds: [],
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || t('create.createError'));
      }
      setShowCreateModal(false);
      await fetchPlanningData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('create.createError'));
    } finally {
      setCreatingEvent(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (!user || !canAccessPlanning) return null;

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: 'var(--brand-danger-soft)', borderColor: 'var(--brand-danger-border)', color: 'var(--brand-danger)' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen brand-page-gradient py-5 sm:py-6 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
        <div className="bg-[var(--brand-primary-soft)] rounded-2xl p-4 sm:p-5 border border-[var(--brand-primary-border)] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, var(--brand-text), var(--brand-text-muted))' }}>
                {t('title')}
              </h1>
              <p className="text-sm sm:text-base mt-1 app-text-muted">{t('subtitle')}</p>
            </div>
            <button
              onClick={fetchPlanningData}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl brand-button-primary min-h-[44px] shadow-md"
            >
              {t('refresh')}
            </button>
          </div>
        </div>

        <div className="app-card rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 p-4">
            <div className="xl:col-span-2">
              <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                <button
                  onClick={() =>
                    setCalendarMonth(
                      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                    )
                  }
                  className="min-h-10 min-w-10 sm:min-h-11 sm:min-w-11 px-2 sm:px-3 py-2 rounded-lg border hover:bg-[var(--brand-surface-soft)]"
                  style={{ borderColor: 'var(--brand-card-border)', color: 'var(--brand-text)' }}
                  aria-label={t('calendar.previousMonth')}
                >
                  ‹
                </button>
                <div className="font-semibold text-center px-1 sm:px-2 leading-tight" style={{ color: 'var(--brand-text)' }}>
                  <span className="sm:hidden">
                    {calendarMonth.toLocaleDateString(locale, { month: 'short', year: '2-digit' })}
                  </span>
                  <span className="hidden sm:inline">
                    {calendarMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                    )
                  }
                  className="min-h-10 min-w-10 sm:min-h-11 sm:min-w-11 px-2 sm:px-3 py-2 rounded-lg border hover:bg-[var(--brand-surface-soft)]"
                  style={{ borderColor: 'var(--brand-card-border)', color: 'var(--brand-text)' }}
                  aria-label={t('calendar.nextMonth')}
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-medium app-text-muted mb-1">
                {calendarWeekdays.map((weekday, index) => (
                  <div key={`${weekday}-${index}`} className="px-0.5 sm:px-2 py-1 text-center truncate">
                    {weekday}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {calendarDays.map((day) => {
                  const dayKey = formatDateKey(day);
                  const dayEntries = calendarEntriesByDate[dayKey] || [];
                  const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isToday = dayKey === formatDateKey(new Date());
                  return (
                    <div
                      key={dayKey}
                      onClick={() => {
                        if (canCreateEvent && isCurrentMonth) openCreateForDate(day);
                      }}
                      className={`min-h-[68px] sm:min-h-[84px] rounded-md sm:rounded-lg border p-1 sm:p-1.5 text-left transition-colors ${
                        isCurrentMonth
                          ? 'bg-[var(--brand-card)] border-[var(--brand-card-border)] hover:border-[var(--brand-primary-border)] hover:bg-[var(--brand-primary-soft)]'
                          : 'bg-[var(--brand-surface-soft)] border-[var(--brand-card-border)] text-[var(--brand-text-muted)]'
                      } ${canCreateEvent && isCurrentMonth ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div
                          className={`text-[11px] sm:text-xs font-semibold ${
                            isToday
                              ? 'inline-flex w-5 h-5 sm:w-6 sm:h-6 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white'
                              : ''
                          }`}
                        >
                          {day.getDate()}
                        </div>
                        {canCreateEvent && isCurrentMonth && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreateForDate(day);
                            }}
                            className="min-h-6 min-w-6 sm:min-h-7 sm:min-w-7 rounded text-[11px] sm:text-[12px] text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]"
                            title={t('calendar.createButton')}
                            aria-label={t('calendar.createButton')}
                          >
                            +
                          </button>
                        )}
                      </div>
                      {dayEntries.length > 0 && (
                        <div className="space-y-0.5 sm:space-y-1">
                          {dayEntries.slice(0, 3).map((entry) => (
                            <button
                              key={entry.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCalendarEntry(entry);
                              }}
                              className={`w-full text-left truncate leading-tight text-[9px] sm:text-[10px] px-1 py-0.5 rounded ${
                                entry.kind === 'event'
                                  ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] hover:brightness-95'
                                  : 'bg-[var(--brand-success-soft)] text-[var(--brand-success)] hover:brightness-95'
                              }`}
                              title={entry.title}
                            >
                              {entry.kind === 'event' ? `${entry.startTime || ''} ` : ''}{entry.title}
                            </button>
                          ))}
                          {dayEntries.length > 3 && (
                            <div className="text-[9px] sm:text-[10px] app-text-muted px-1">{`+${dayEntries.length - 3}`}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border p-4 app-card">
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--brand-text)' }}>{t('calendar.quickCreateTitle')}</h3>
              <p className="text-sm app-text-muted mb-4">{t('calendar.quickCreateHint')}</p>
              <button
                onClick={() => {
                  resetCreateForm();
                  setShowCreateModal(true);
                }}
                disabled={!canCreateEvent}
                className="w-full px-4 py-2.5 rounded-xl brand-button-primary min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {t('calendar.createButton')}
              </button>
              {!canCreateEvent && (
                <p className="text-xs text-[var(--brand-warning)] mt-2">{t('calendar.noPermission')}</p>
              )}
            </div>
          </div>

          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card-soft)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>{t('filterStatus')}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 border rounded-lg min-h-[44px] sm:min-w-[240px]"
                style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
              >
                <option value="all">{t('statusAll')}</option>
                <option value="draft">{t('status.draft')}</option>
                <option value="invited">{t('status.invited')}</option>
                <option value="confirmed">{t('status.confirmed')}</option>
                <option value="cancelled">{t('status.cancelled')}</option>
                <option value="completed">{t('status.completed')}</option>
              </select>
            </div>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="app-card rounded-xl p-10 text-center app-text-muted shadow-sm">
            {t('empty')}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event) => {
              const stats = getRsvpStats(event);
              return (
                <div
                  key={event._id}
                  className="app-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-lg break-words" style={{ color: 'var(--brand-text)' }}>{event.title}</div>
                      <div className="text-sm app-text-muted">{getSeriesLabel(event)}</div>
                      <div className="text-sm app-text-muted">{formatDateTime(event)}</div>
                      {event.location && <div className="text-sm app-text-muted">{event.location}</div>}
                    </div>
                    <span
                      className={`self-start px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass[event.status]}`}
                    >
                      {t(`status.${event.status}`)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-[var(--brand-success-soft)] text-[var(--brand-success)]">
                      {t('rsvpBadges.accepted')} {stats.accepted}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-[var(--brand-warning-soft)] text-[var(--brand-warning)]">
                      {t('rsvpBadges.tentative')} {stats.tentative}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-[var(--brand-danger-soft)] text-[var(--brand-danger)]">
                      {t('rsvpBadges.declined')} {stats.declined}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]">
                      {t('rsvpBadges.pending')} {stats.pending}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-[var(--brand-muted-soft)] text-[var(--brand-text-muted)]">
                      {t('rsvpBadges.total')} {stats.total}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/meeting-series/${event.meetingSeriesId}`}
                      className="px-3 py-2 rounded-lg border hover:bg-[var(--brand-surface-soft)] min-h-[40px] inline-flex items-center"
                      style={{ borderColor: 'var(--brand-card-border)', color: 'var(--brand-text)' }}
                    >
                      {t('openSeries')}
                    </Link>
                    {event.linkedMinutesId && (
                      <Link
                        href={`/minutes/${event.linkedMinutesId}`}
                        className="px-3 py-2 rounded-lg border hover:bg-[var(--brand-surface-soft)] min-h-[40px] inline-flex items-center"
                        style={{ borderColor: 'var(--brand-card-border)', color: 'var(--brand-text)' }}
                      >
                        {t('openMinutes')}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedCalendarEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50">
          <div className="w-full max-w-lg max-h-[90vh] app-card rounded-2xl shadow-2xl border overflow-y-auto">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--brand-card-border)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--brand-text)' }}>{t('entryModal.title')}</h2>
              <button
                onClick={() => setSelectedCalendarEntry(null)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-[var(--brand-surface-soft)] app-text-muted"
              >
                ✕
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide app-text-muted">
                {selectedCalendarEntry.kind === 'event' ? t('entryModal.typeEvent') : t('entryModal.typeMinute')}
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--brand-text)' }}>{selectedCalendarEntry.title}</div>
              <div className="text-sm" style={{ color: 'var(--brand-text)' }}>{selectedCalendarEntry.meetingSeriesLabel}</div>
              <div className="text-sm app-text-muted">
                {new Date(selectedCalendarEntry.dateKey).toLocaleDateString(locale)}
                {selectedCalendarEntry.startTime
                  ? `, ${selectedCalendarEntry.startTime}${selectedCalendarEntry.endTime ? ` - ${selectedCalendarEntry.endTime}` : ''}`
                  : ''}
              </div>
              {selectedCalendarEntry.location && (
                <div className="text-sm app-text-muted">
                  {t('entryModal.location')}: {selectedCalendarEntry.location}
                </div>
              )}
              {selectedCalendarEntry.statusLabel && (
                <div className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--brand-muted-soft)] text-[var(--brand-text-muted)]">
                  {selectedCalendarEntry.statusLabel}
                </div>
              )}
              {selectedCalendarEntry.note && (
                <div className="text-sm border rounded-lg p-3" style={{ color: 'var(--brand-text)', backgroundColor: 'var(--brand-surface-soft)', borderColor: 'var(--brand-card-border)' }}>
                  {selectedCalendarEntry.note}
                </div>
              )}
            </div>
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-t flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2" style={{ borderColor: 'var(--brand-card-border)' }}>
              {selectedCalendarEntry.minutesId && (
                <Link
                  href={`/minutes/${selectedCalendarEntry.minutesId}`}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-lg border hover:bg-[var(--brand-surface-soft)] min-h-11 inline-flex items-center justify-center"
                  style={{ borderColor: 'var(--brand-card-border)', color: 'var(--brand-text)' }}
                >
                  {t('openMinutes')}
                </Link>
              )}
              {selectedCalendarEntry.meetingSeriesId && (
                <Link
                  href={`/meeting-series/${selectedCalendarEntry.meetingSeriesId}`}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-lg border hover:bg-[var(--brand-surface-soft)] min-h-11 inline-flex items-center justify-center"
                  style={{ borderColor: 'var(--brand-card-border)', color: 'var(--brand-text)' }}
                >
                  {t('openSeries')}
                </Link>
              )}
              <button
                onClick={() => setSelectedCalendarEntry(null)}
                className="w-full sm:w-auto px-3 py-2.5 min-h-11 rounded-lg hover:brightness-95"
                style={{ backgroundColor: 'var(--brand-surface-soft)', color: 'var(--brand-text)' }}
              >
                {t('create.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/50">
          <div className="w-full max-w-lg max-h-[92vh] app-card rounded-2xl shadow-2xl border overflow-y-auto">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--brand-card-border)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--brand-text)' }}>{t('create.title')}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-[var(--brand-surface-soft)] app-text-muted"
              >
                ✕
              </button>
            </div>
            <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-3.5">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.series')}</label>
                <select
                  value={eventSeriesId}
                  onChange={(e) => setEventSeriesId(e.target.value)}
                  className="w-full px-3 py-2 min-h-10 border rounded-lg"
                  style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                >
                  <option value="">{t('create.selectSeries')}</option>
                  {seriesList.map((series) => (
                    <option key={series._id} value={series._id}>
                      {series.name ? `${series.project || ''} - ${series.name}`.trim() : series.project}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.titleLabel')}</label>
                <input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-3 py-2 min-h-10 border rounded-lg"
                  style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                  placeholder={t('create.titlePlaceholder')}
                />
              </div>
              <div className="rounded-xl border p-2.5 sm:p-3" style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card-soft)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide app-text-muted mb-2">
                  {t('create.schedule')}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.date')}</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2 min-h-10 border rounded-lg"
                      style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.startTime')}</label>
                    <input
                      type="time"
                      value={eventStartTime}
                      onChange={(e) => setEventStartTime(e.target.value)}
                      className="w-full px-3 py-2 min-h-10 border rounded-lg"
                      style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.endTime')}</label>
                    <input
                      type="time"
                      value={eventEndTime}
                      onChange={(e) => setEventEndTime(e.target.value)}
                      className="w-full px-3 py-2 min-h-10 border rounded-lg"
                      style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.minutesTemplateLabel')}</label>
                  <select
                    value={eventMinutesTemplateId}
                    onChange={(e) => setEventMinutesTemplateId(e.target.value)}
                    className="w-full px-3 py-2 min-h-10 border rounded-lg"
                    style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                  >
                    <option value="">{t('create.minutesTemplateDefault')}</option>
                    {minutesTemplateOptions.map((template) => (
                      <option key={template._id} value={template._id}>
                        {template.name} ({template.scope === 'global' ? t('create.templateGlobal') : t('create.templateSeries')})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.pdfTemplateLabel')}</label>
                  <select
                    value={eventPdfTemplateId}
                    onChange={(e) => setEventPdfTemplateId(e.target.value)}
                    className="w-full px-3 py-2 min-h-10 border rounded-lg"
                    style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                  >
                    <option value="">{t('create.pdfTemplateDefault')}</option>
                    {pdfTemplateOptions.map((template) => (
                      <option key={template._id} value={template._id}>
                        {template.name}{template.isActive ? ` (${t('create.templateActive')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.location')}</label>
                <input
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full px-3 py-2 min-h-10 border rounded-lg"
                  style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                  placeholder={t('create.locationPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--brand-text)' }}>{t('create.note')}</label>
                <textarea
                  value={eventNote}
                  onChange={(e) => setEventNote(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg min-h-[84px]"
                  style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                  rows={2}
                  placeholder={t('create.notePlaceholder')}
                />
              </div>
              {createError && <div className="text-sm text-[var(--brand-danger)]">{createError}</div>}
            </div>
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-t flex flex-col sm:flex-row sm:justify-end gap-2" style={{ borderColor: 'var(--brand-card-border)' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 min-h-11 rounded-lg hover:brightness-95"
                style={{ backgroundColor: 'var(--brand-surface-soft)', color: 'var(--brand-text)' }}
              >
                {t('create.cancel')}
              </button>
              <button
                onClick={createEvent}
                disabled={creatingEvent}
                className="w-full sm:w-auto px-4 py-2.5 min-h-11 rounded-lg brand-button-solid disabled:opacity-50"
              >
                {creatingEvent ? t('create.creating') : t('create.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
