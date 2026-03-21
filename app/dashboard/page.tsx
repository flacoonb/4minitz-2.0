'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmationModal from '@/components/ConfirmationModal';

// Demo fallback removed; rely on cookie/JWT auth via credentials

interface DashboardData {
  statistics: {
    totalSeries: number;
    totalMinutes: number;
    finalizedMinutes: number;
    draftMinutes: number;
    totalActionItems: number;
    overdueActionItems: number;
    upcomingActionItems: number;
  };
  /** Preview list only; full task rows come from GET /api/tasks */
  recentMinutes: Array<{
    _id: string;
    date: string;
    isFinalized: boolean;
    meetingSeries_id: { project: string | null; name: string | null } | null;
  }>;
  lastRemindersSentAt?: string;
}

interface Task {
  _id: string;
  subject: string;
  details?: string;
  status: 'open' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  responsibles: string[];
  estimatedHours?: number;
  notes?: string;
  meetingSeries?: {
    name?: string | null;
    project?: string | null;
  } | null;
  minutesId: string;
  minutesDate: string;
  topicSubject: string;
  topicId?: string; // Added for API call
}

export default function DashboardPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<{
    status?: string;
    priority?: string;
    overdue?: boolean;
  }>({});

  // Task update modal state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskUpdateStatus, setTaskUpdateStatus] = useState<'open' | 'in-progress' | 'completed' | 'cancelled'>('open');
  const [taskUpdateNotes, setTaskUpdateNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  const handleSendReminders = async () => {
    setIsModalOpen(true);
  };

  const executeSendReminders = async () => {
    setSendingReminders(true);
    try {
      const response = await fetch('/api/tasks/remind-all', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to send reminders');

      // Refresh dashboard to update "last sent" time
      fetchDashboard();
    } catch (error) {
      console.error('Error sending reminders:', error);
      alert(t('dashboard.remindersError'));
    } finally {
      setSendingReminders(false);
      setIsModalOpen(false);
    }
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard', { credentials: 'include', cache: 'no-store' });

      if (!response.ok) {
        throw new Error(t('errors.fetchDashboardFailed'));
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (taskFilter.status && taskFilter.status !== 'all') params.append('status', taskFilter.status);
      if (taskFilter.priority) params.append('priority', taskFilter.priority);
      if (taskFilter.overdue !== undefined) params.append('overdue', String(taskFilter.overdue));

      const response = await fetch(`/api/tasks?${params.toString()}`, { credentials: 'include', cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        let data = (result.data || []).map((task: Task) => ({
          ...task,
          meetingSeries: task.meetingSeries || null,
        }));
        // Default: show active tasks (open + in-progress) when no specific status filter set
        if (!taskFilter.status || taskFilter.status === '') {
          data = data.filter((t: Task) => t.status === 'open' || t.status === 'in-progress');
        }
        setTasks(data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  }, [taskFilter]);

  useEffect(() => {
    fetchDashboard();
    fetchTasks();
  }, [fetchDashboard, fetchTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const openTaskModal = (task: Task, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setEditingTask(task);
    setTaskUpdateStatus(task.status);
    setTaskUpdateNotes(task.notes || '');
  };

  const closeTaskModal = () => {
    setEditingTask(null);
    setTaskUpdateStatus('open');
    setTaskUpdateNotes('');
  };

  const updateTaskStatus = async () => {
    if (!editingTask) return;

    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/tasks/${editingTask._id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: taskUpdateStatus,
            notes: taskUpdateNotes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('errors.updateTaskFailed'));
      }

      // Refresh tasks list
      await fetchTasks();
      closeTaskModal();
    } catch (err) {
      console.error('Error updating task:', err);
      alert(t('errors.updateTaskFailed') + ': ' + (err instanceof Error ? err.message : t('errors.unknown')));
    } finally {
      setIsUpdating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (error || !data) {
    return (
      <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: 'var(--brand-danger-soft)', borderColor: 'var(--brand-danger-border)', color: 'var(--brand-danger)' }}>
        <p className="font-medium">{t('errors.loadFailed')}</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const recentMinutes = Array.isArray(data.recentMinutes) ? data.recentMinutes : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('dashboard.title')}</h1>
        <p className="app-text-muted">{t('dashboard.overview')}</p>
      </div>

      {/* Statistics Cards with Compact Design */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mb-6">
        {/* Series Card */}
        <Link href="/meeting-series" className="group relative app-card rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary-border)]">
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mb-1" style={{ backgroundColor: 'var(--brand-dashboard-badge-series-soft)' }}>
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: 'var(--brand-dashboard-badge-series-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-xs font-medium mb-0.5 leading-tight truncate app-text-muted">{t('dashboard.series')}</p>
            <p className="text-lg sm:text-xl font-bold leading-tight" style={{ color: 'var(--brand-dashboard-badge-series-ink)' }}>{data.statistics.totalSeries}</p>
          </div>
        </Link>

        {/* Minutes Card */}
        <Link href="/minutes" className="group relative app-card rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary-border)]">
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mb-1" style={{ backgroundColor: 'var(--brand-dashboard-badge-minutes-soft)' }}>
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: 'var(--brand-dashboard-badge-minutes-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs font-medium mb-0.5 leading-tight truncate app-text-muted">{t('dashboard.minutes')}</p>
            <p className="text-lg sm:text-xl font-bold leading-tight" style={{ color: 'var(--brand-dashboard-badge-minutes-ink)' }}>{data.statistics.totalMinutes}</p>
            <p className="hidden sm:block text-xs app-text-muted">{data.statistics.finalizedMinutes} {t('dashboard.finalized')}</p>
          </div>
        </Link>

        {/* Drafts Card */}
        <Link href="/minutes?isFinalized=false" className="group relative app-card rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary-border)]">
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mb-1" style={{ backgroundColor: 'var(--brand-dashboard-badge-drafts-soft)' }}>
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: 'var(--brand-dashboard-badge-drafts-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <p className="text-xs font-medium mb-0.5 leading-tight truncate app-text-muted">{t('dashboard.drafts')}</p>
            <p className="text-lg sm:text-xl font-bold leading-tight" style={{ color: 'var(--brand-dashboard-badge-drafts-ink)' }}>{data.statistics.draftMinutes}</p>
            <p className="hidden sm:block text-xs app-text-muted">{t('dashboard.minutes')}</p>
          </div>
        </Link>

        {/* Action Items Card */}
        <Link href="/tasks?status=active" className="group relative app-card rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary-border)]">
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mb-1" style={{ backgroundColor: 'var(--brand-dashboard-badge-tasks-soft)' }}>
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: 'var(--brand-dashboard-badge-tasks-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-xs font-medium mb-0.5 leading-tight truncate app-text-muted">{t('dashboard.tasks')}</p>
            <p className="text-lg sm:text-xl font-bold leading-tight" style={{ color: 'var(--brand-dashboard-badge-tasks-ink)' }}>{data.statistics.totalActionItems}</p>
            <p className="hidden sm:block text-xs app-text-muted">{t('dashboard.open')}</p>
          </div>
        </Link>

        {/* Overdue Card */}
        <Link href="/tasks?status=all&overdue=true" className="group relative app-card rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary-border)]">
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mb-1" style={{ backgroundColor: 'var(--brand-dashboard-badge-overdue-soft)' }}>
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: 'var(--brand-dashboard-badge-overdue-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs font-medium mb-0.5 leading-tight truncate app-text-muted">{t('dashboard.overdue')}</p>
            <p className="text-lg sm:text-xl font-bold leading-tight" style={{ color: 'var(--brand-dashboard-badge-overdue-ink)' }}>{data.statistics.overdueActionItems}</p>
            <p className="hidden sm:block text-xs app-text-muted">{t('dashboard.tasks')}</p>
          </div>
        </Link>

        {/* Upcoming Card */}
        <Link href="/tasks?status=in-progress" className="group relative app-card rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary-border)]">
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mb-1" style={{ backgroundColor: 'var(--brand-dashboard-badge-upcoming-soft)' }}>
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color: 'var(--brand-dashboard-badge-upcoming-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs font-medium mb-0.5 leading-tight truncate app-text-muted">{t('dashboard.upcoming')}</p>
            <p className="text-lg sm:text-xl font-bold leading-tight" style={{ color: 'var(--brand-dashboard-badge-upcoming-ink)' }}>{data.statistics.upcomingActionItems}</p>
            <p className="hidden sm:block text-xs app-text-muted">{t('dashboard.tasks')}</p>
          </div>
        </Link>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Tasks */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Moderator Actions */}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <div className="app-card rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 brand-gradient-bg rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold brand-gradient-text">
                    {t('dashboard.moderatorActions')}
                  </h2>
                </div>
              </div>
              <p className="app-text-muted mb-4 text-sm">
                {t('dashboard.sendRemindersDesc')}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button
                  onClick={handleSendReminders}
                  disabled={sendingReminders}
                  className="px-4 py-2 min-h-[44px] brand-button-solid rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingReminders ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {t('dashboard.sendReminders')}
                    </>
                  )}
                </button>
                {data?.lastRemindersSentAt && (
                  <span className="text-sm app-text-muted">
                    {t('dashboard.lastSent')}: {new Date(data.lastRemindersSentAt).toLocaleString(locale)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* My Tasks Section */}
          <div className="app-card rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 brand-gradient-bg rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold brand-gradient-text break-words">
                  {t('dashboard.myTasks')} ({tasks.length})
                </h2>
              </div>
            </div>

            {/* Task Filters */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <select
                value={taskFilter.status || ''}
                onChange={(e) => setTaskFilter({ ...taskFilter, status: e.target.value || undefined })}
                className="px-3 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[44px] w-full"
                style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
              >
                <option value="">{t('tasks.filterActive')}</option>
                <option value="open">{t('status.open')}</option>
                <option value="in-progress">{t('status.inProgress')}</option>
                <option value="completed">{t('status.completed')}</option>
                <option value="all">{t('tasks.filterAll')}</option>
              </select>

              <select
                value={taskFilter.priority || ''}
                onChange={(e) => setTaskFilter({ ...taskFilter, priority: e.target.value || undefined })}
                className="px-3 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[44px] w-full"
                style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
              >
                <option value="">{t('dashboard.allPriorities')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="low">{t('priority.low')}</option>
              </select>

              <button
                onClick={() => setTaskFilter({ ...taskFilter, overdue: !taskFilter.overdue })}
                className={`px-3 py-2.5 text-sm rounded-lg transition-colors min-h-[44px] w-full ${taskFilter.overdue
                  ? 'border'
                  : 'bg-[var(--brand-surface-soft)] border'
                  }`}
                style={taskFilter.overdue
                  ? { backgroundColor: 'var(--brand-dashboard-badge-overdue-soft)', color: 'var(--brand-dashboard-badge-overdue-ink)', borderColor: 'var(--brand-primary-border)' }
                  : { color: 'var(--brand-text)', borderColor: 'var(--brand-card-border)' }}
              >
                {taskFilter.overdue ? `✓ ${t('dashboard.onlyOverdue')}` : t('dashboard.onlyOverdue')}
              </button>

              {(taskFilter.status || taskFilter.priority || taskFilter.overdue) && (
                <button
                  onClick={() => setTaskFilter({})}
                  className="px-3 py-2.5 text-sm min-h-[44px] w-full"
                  style={{ color: 'var(--brand-text-muted)' }}
                >
                  ✕ {t('dashboard.resetFilters')}
                </button>
              )}
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--brand-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="font-medium app-text-muted">{t('dashboard.noTasksFound')}</p>
                  <p className="text-sm mt-1 app-text-muted">
                    {Object.keys(taskFilter).length > 0 ? t('dashboard.tryOtherFilters') : t('dashboard.noTasksAssigned')}
                  </p>
                </div>
              ) : (
                tasks.map((task) => {
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
                  const seriesName = task.meetingSeries?.project || t('dashboard.noSeries');
                  const seriesProject = task.meetingSeries?.project || '';

                  return (
                    <div
                      key={task._id}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        isOverdue
                          ? 'bg-[var(--brand-danger-soft)] border-[var(--brand-danger-border)]'
                          : task.priority === 'high'
                            ? 'bg-[var(--brand-warning-soft)] border-[var(--brand-warning-border)]'
                            : 'bg-[var(--brand-card)] border-[var(--brand-card-border)]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <Link href={`/minutes/${task.minutesId}`} className="font-semibold mb-1 hover:text-[var(--brand-primary)] block" style={{ color: 'var(--brand-text)' }}>
                            {task.subject}
                          </Link>
                          <p className="text-sm mb-2 app-text-muted">
                            {seriesProject ? `${seriesProject} • ` : ''}
                            {seriesName} • {task.topicSubject}
                          </p>
                          {task.details && (
                            <p className="text-sm mb-2" style={{ color: 'var(--brand-text)' }}>{task.details}</p>
                          )}
                        </div>

                        {/* Edit Button */}
                        <button
                          onClick={(e) => openTaskModal(task, e)}
                          className="w-full sm:w-auto sm:ml-2 px-3 py-1.5 min-h-[44px] text-sm brand-button-solid rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {t('common.edit')}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {/* Status */}
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-lg"
                          style={
                            task.status === 'completed'
                              ? { backgroundColor: 'var(--brand-dashboard-badge-minute-final-soft)', color: 'var(--brand-dashboard-badge-minute-final-ink)' }
                              : task.status === 'in-progress'
                                ? { backgroundColor: 'var(--brand-dashboard-badge-upcoming-soft)', color: 'var(--brand-dashboard-badge-upcoming-ink)' }
                                : task.status === 'cancelled'
                                  ? { backgroundColor: 'var(--brand-muted-soft)', color: 'var(--brand-text-muted)' }
                                  : { backgroundColor: 'var(--brand-dashboard-badge-series-soft)', color: 'var(--brand-dashboard-badge-series-ink)' }
                          }
                        >
                          {task.status === 'completed' ? `✓ ${t('status.completed')}` :
                            task.status === 'in-progress' ? `⏳ ${t('status.inProgress')}` :
                              task.status === 'cancelled' ? `✕ ${t('status.cancelled')}` :
                                `○ ${t('status.open')}`}
                        </span>

                        {/* Priority */}
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-lg"
                          style={
                            task.priority === 'high'
                              ? { backgroundColor: 'var(--brand-dashboard-badge-overdue-soft)', color: 'var(--brand-dashboard-badge-overdue-ink)' }
                              : task.priority === 'medium'
                                ? { backgroundColor: 'var(--brand-dashboard-badge-drafts-soft)', color: 'var(--brand-dashboard-badge-drafts-ink)' }
                                : { backgroundColor: 'var(--brand-dashboard-badge-series-soft)', color: 'var(--brand-dashboard-badge-series-ink)' }
                          }
                        >
                          {task.priority === 'high' ? `🔴 ${t('priority.high')}` :
                            task.priority === 'medium' ? `🟡 ${t('priority.medium')}` :
                              `🔵 ${t('priority.low')}`}
                        </span>

                        {/* Due Date */}
                        {task.dueDate && (
                          <span
                            className="px-2 py-1 text-xs font-medium rounded-lg"
                            style={
                              isOverdue
                                ? { backgroundColor: 'var(--brand-dashboard-badge-overdue-soft)', color: 'var(--brand-dashboard-badge-overdue-ink)' }
                                : { backgroundColor: 'var(--brand-dashboard-badge-upcoming-soft)', color: 'var(--brand-dashboard-badge-upcoming-ink)' }
                            }
                          >
                            {isOverdue ? '⚠️ ' : '📅 '}
                            {new Date(task.dueDate).toLocaleDateString(locale)}
                          </span>
                        )}

                        {/* Estimated Hours */}
                        {task.estimatedHours && (
                          <span className="px-2 py-1 text-xs font-medium rounded-lg bg-[var(--brand-muted-soft)]" style={{ color: 'var(--brand-text)' }}>
                            ⏱️ {task.estimatedHours}h
                          </span>
                        )}
                      </div>

                      {/* Additional User Comments */}
                      {task.notes && (
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--brand-card-border)' }}>
                          <p className="text-xs font-medium mb-1 app-text-muted">💬 {t('dashboard.additionalComment')}</p>
                          <p className="text-sm italic" style={{ color: 'var(--brand-text)' }}>{task.notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Minutes - Sidebar */}
        <div className="app-card rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--brand-dashboard-badge-minutes-soft)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--brand-dashboard-badge-minutes-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--brand-dashboard-badge-minutes-ink)' }}>
              {t('dashboard.recentMinutes')}
            </h2>
          </div>
          <div className="space-y-3">
            {recentMinutes.slice(0, 5).map((minute) => (
              <Link
                key={minute._id}
                href={`/minutes/${minute._id}`}
                className="block p-3 rounded-lg hover:shadow-md transition-all duration-200"
                style={{ backgroundColor: 'var(--brand-dashboard-badge-minutes-soft)', border: '1px solid var(--brand-card-border)' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--brand-text)' }}>
                        {new Date(minute.date).toLocaleDateString(locale, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={minute.isFinalized
                          ? { backgroundColor: 'var(--brand-dashboard-badge-minute-final-soft)', color: 'var(--brand-dashboard-badge-minute-final-ink)' }
                          : { backgroundColor: 'var(--brand-dashboard-badge-minute-draft-soft)', color: 'var(--brand-dashboard-badge-minute-draft-ink)' }}
                      >
                        {minute.isFinalized ? t('dashboard.final') : t('dashboard.draft')}
                      </span>
                    </div>
                    <p className="text-xs truncate app-text-muted">
                      {minute.meetingSeries_id?.project || minute.meetingSeries_id?.name || t('dashboard.noSeries')}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: 'var(--brand-text-muted)' }}
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
            ))}
          </div>
        </div>
      </div>

      {/* Task Update Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="app-card rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b" style={{ borderColor: 'var(--brand-card-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--brand-text)' }}>{t('dashboard.editTask')}</h2>
                  <p className="text-sm mt-1 break-words app-text-muted">
                    {(editingTask.meetingSeries?.project || t('dashboard.noSeries'))}
                    {editingTask.meetingSeries?.name ? ` – ${editingTask.meetingSeries.name}` : ''} • {editingTask.topicSubject}
                  </p>
                </div>
                <button
                  onClick={closeTaskModal}
                  className="transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg"
                  style={{ color: 'var(--brand-text-muted)' }}
                  aria-label="Dialog schliessen"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Original Task Description (Read-only) */}
              <div className="bg-[var(--brand-primary-soft)] border-2 border-[var(--brand-primary-border)] rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 mb-2">
                  <svg className="w-5 h-5 text-[var(--brand-primary)] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-[var(--brand-primary-strong)] mb-1">{t('dashboard.originalTask')}</h3>
                    <p className="text-sm sm:text-base text-[var(--brand-primary-strong)] font-medium">{editingTask.subject}</p>
                    {editingTask.details && (
                      <p className="text-sm text-[var(--brand-primary-strong)] mt-2 whitespace-pre-wrap">{editingTask.details}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--brand-primary-border)] flex flex-wrap gap-2 text-xs">
                  <span className="text-[var(--brand-primary-strong)]">
                    📅 {t('dashboard.minuteLabel')} {new Date(editingTask.minutesDate).toLocaleDateString(locale)}
                  </span>
                  {editingTask.dueDate && (
                    <span className="text-[var(--brand-primary-strong)]">
                      • ⏰ {t('dashboard.dueLabel')} {new Date(editingTask.dueDate).toLocaleDateString(locale)}
                    </span>
                  )}
                  {editingTask.priority && (
                    <span className="text-[var(--brand-primary-strong)]">
                      • {editingTask.priority === 'high' ? `🔴 ${t('priority.high')}` :
                        editingTask.priority === 'medium' ? `🟡 ${t('priority.medium')}` : `🔵 ${t('priority.low')}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
                  {t('dashboard.changeStatus')}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={() => setTaskUpdateStatus('open')}
                    className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[44px] ${taskUpdateStatus === 'open'
                      ? 'border-[var(--brand-danger-border)] bg-[var(--brand-danger-soft)] text-[var(--brand-danger)]'
                      : 'border-[var(--brand-card-border)] hover:border-[var(--brand-primary-border)]'
                      }`}
                    style={taskUpdateStatus !== 'open' ? { color: 'var(--brand-text)' } : undefined}
                  >
                    <div className="text-lg sm:text-xl mb-0.5">○</div>
                    <div className="font-medium text-sm sm:text-base leading-tight">{t('status.open')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('in-progress')}
                    className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[44px] ${taskUpdateStatus === 'in-progress'
                      ? 'border-[var(--brand-warning-border)] bg-[var(--brand-warning-soft)] text-[var(--brand-warning)]'
                      : 'border-[var(--brand-card-border)] hover:border-[var(--brand-primary-border)]'
                      }`}
                    style={taskUpdateStatus !== 'in-progress' ? { color: 'var(--brand-text)' } : undefined}
                  >
                    <div className="text-lg sm:text-xl mb-0.5">⏳</div>
                    <div className="font-medium text-sm sm:text-base leading-tight">{t('status.inProgress')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('completed')}
                    className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[44px] ${taskUpdateStatus === 'completed'
                      ? 'border-[var(--brand-success-border)] bg-[var(--brand-success-soft)] text-[var(--brand-success)]'
                      : 'border-[var(--brand-card-border)] hover:border-[var(--brand-primary-border)]'
                      }`}
                    style={taskUpdateStatus !== 'completed' ? { color: 'var(--brand-text)' } : undefined}
                  >
                    <div className="text-lg sm:text-xl mb-0.5">✓</div>
                    <div className="font-medium text-sm sm:text-base leading-tight">{t('status.completed')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('cancelled')}
                    className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[44px] ${taskUpdateStatus === 'cancelled'
                      ? 'border-[var(--brand-card-border)] bg-[var(--brand-muted-soft)]'
                      : 'border-[var(--brand-card-border)] hover:border-[var(--brand-primary-border)]'
                      }`}
                    style={taskUpdateStatus === 'cancelled' ? { color: 'var(--brand-text)' } : { color: 'var(--brand-text)' }}
                  >
                    <div className="text-lg sm:text-xl mb-0.5">✕</div>
                    <div className="font-medium text-sm sm:text-base leading-tight">{t('status.cancelled')}</div>
                  </button>
                </div>
              </div>

              {/* Additional Notes (Editable) */}
              <div>
                <label htmlFor="task-notes" className="block text-sm font-medium mb-2" style={{ color: 'var(--brand-text)' }}>
                  💬 {t('dashboard.yourComment')}
                </label>
                <textarea
                  id="task-notes"
                  value={taskUpdateNotes}
                  onChange={(e) => setTaskUpdateNotes(e.target.value)}
                  rows={4}
                  placeholder={t('dashboard.commentPlaceholder')}
                  className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] transition-colors"
                  style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
                />
                <p className="mt-2 text-xs app-text-muted flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m-1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t('dashboard.commentHint')}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--brand-card-border)' }}>
                <button
                  onClick={closeTaskModal}
                  disabled={isUpdating}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
                  style={{ color: 'var(--brand-text)', backgroundColor: 'var(--brand-surface-soft)' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={updateTaskStatus}
                  disabled={isUpdating}
                  className="w-full sm:w-auto px-6 py-2.5 text-white brand-button-solid rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {isUpdating ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('common.saving')}
                    </>
                  ) : (
                    t('common.save')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={executeSendReminders}
        title={t('dashboard.sendReminders')}
        message={t('dashboard.confirmSendReminders')}
        confirmText={t('common.send')}
        cancelText={t('common.cancel')}
        isProcessing={sendingReminders}
        type="info"
      />
    </div>
  );
}
