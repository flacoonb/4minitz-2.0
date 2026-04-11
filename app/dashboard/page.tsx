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
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">{t('dashboard.title')}</h1>
        <p className="text-sm app-text-muted">{t('dashboard.overview')}</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column - Tasks */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Moderator Actions */}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <div className="app-card rounded-xl shadow-sm p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 brand-gradient-bg rounded-lg flex items-center justify-center shadow">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold brand-gradient-text">
                    {t('dashboard.moderatorActions')}
                  </h2>
                </div>
              </div>
              <p className="app-text-muted mb-3 text-sm">
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
          <div className="app-card rounded-xl shadow-sm p-4 hover:shadow-md transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 brand-gradient-bg rounded-lg flex items-center justify-center shadow">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold brand-gradient-text break-words">
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
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-6">
                  <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--brand-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  const seriesProject = task.meetingSeries?.project || '';
                  const seriesName = task.meetingSeries?.project || t('dashboard.noSeries');

                  return (
                    <div
                      key={task._id}
                      className={`relative p-3 rounded-lg border transition-all group ${
                        isOverdue
                          ? 'bg-[var(--brand-danger-soft)] border-[var(--brand-danger-border)]'
                          : task.priority === 'high'
                            ? 'bg-[var(--brand-warning-soft)] border-[var(--brand-warning-border)]'
                            : 'bg-[var(--brand-card)] border-[var(--brand-card-border)]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Priority dot */}
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{
                            backgroundColor: task.priority === 'high'
                              ? 'var(--brand-danger)'
                              : task.priority === 'medium'
                                ? 'var(--brand-warning)'
                                : 'var(--brand-primary)'
                          }}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/minutes/${task.minutesId}`} className="text-sm font-semibold hover:text-[var(--brand-primary)] line-clamp-1" style={{ color: 'var(--brand-text)' }}>
                              {task.subject}
                            </Link>
                            <button
                              onClick={(e) => openTaskModal(task, e)}
                              className="flex-shrink-0 p-1.5 min-h-[32px] min-w-[32px] text-xs brand-button-solid rounded-md transition-colors opacity-60 group-hover:opacity-100 inline-flex items-center justify-center"
                              title={t('common.edit')}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>

                          <p className="text-xs app-text-muted truncate">
                            {seriesProject ? `${seriesProject} • ` : ''}{seriesName} • {task.topicSubject}
                          </p>

                          {task.details && (
                            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--brand-text)' }}>{task.details}</p>
                          )}

                          {/* Badges inline */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span
                              className="px-1.5 py-0.5 text-[11px] font-medium rounded"
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

                            {task.dueDate && (
                              <span
                                className="px-1.5 py-0.5 text-[11px] font-medium rounded"
                                style={
                                  isOverdue
                                    ? { backgroundColor: 'var(--brand-dashboard-badge-overdue-soft)', color: 'var(--brand-dashboard-badge-overdue-ink)' }
                                    : { backgroundColor: 'var(--brand-dashboard-badge-upcoming-soft)', color: 'var(--brand-dashboard-badge-upcoming-ink)' }
                                }
                              >
                                {isOverdue ? '⚠️ ' : ''}{new Date(task.dueDate).toLocaleDateString(locale)}
                              </span>
                            )}

                            {task.estimatedHours && (
                              <span className="px-1.5 py-0.5 text-[11px] font-medium rounded bg-[var(--brand-muted-soft)]" style={{ color: 'var(--brand-text)' }}>
                                {task.estimatedHours}h
                              </span>
                            )}
                          </div>

                          {task.notes && (
                            <p className="text-xs italic mt-1.5 app-text-muted line-clamp-1">💬 {task.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Minutes - Sidebar */}
        <div className="app-card rounded-xl shadow-sm p-4 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow" style={{ backgroundColor: 'var(--brand-dashboard-badge-minutes-soft)' }}>
              <svg className="w-4 h-4" style={{ color: 'var(--brand-dashboard-badge-minutes-ink)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--brand-dashboard-badge-minutes-ink)' }}>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-3.5 border-b border-gray-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">{t('dashboard.editTask')}</h2>
                <p className="text-xs text-gray-500 mt-0.5 break-words">
                  {(editingTask.meetingSeries?.project || t('dashboard.noSeries'))}
                  {editingTask.meetingSeries?.name ? ` – ${editingTask.meetingSeries.name}` : ''} • {editingTask.topicSubject}
                </p>
              </div>
              <button
                onClick={closeTaskModal}
                className="p-1.5 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                aria-label="Dialog schliessen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Original Task */}
              <div className="bg-[var(--brand-primary-soft)] border border-[var(--brand-primary-border)] rounded-lg p-3">
                <h3 className="text-xs font-bold text-[var(--brand-primary-strong)] mb-0.5">{t('dashboard.originalTask')}</h3>
                <p className="text-sm text-[var(--brand-primary-strong)] font-medium">{editingTask.subject}</p>
                {editingTask.details && (
                  <p className="text-xs text-[var(--brand-primary-strong)] mt-1 whitespace-pre-wrap line-clamp-3">{editingTask.details}</p>
                )}
                <div className="mt-2 pt-2 border-t border-[var(--brand-primary-border)] flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('dashboard.changeStatus')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { key: 'open', icon: '○', border: 'border-[var(--brand-danger-border)]', bg: 'bg-[var(--brand-danger-soft)]', text: 'text-[var(--brand-danger)]' },
                    { key: 'in-progress', icon: '⏳', border: 'border-[var(--brand-warning-border)]', bg: 'bg-[var(--brand-warning-soft)]', text: 'text-[var(--brand-warning)]' },
                    { key: 'completed', icon: '✓', border: 'border-[var(--brand-success-border)]', bg: 'bg-[var(--brand-success-soft)]', text: 'text-[var(--brand-success)]' },
                    { key: 'cancelled', icon: '✕', border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-600' },
                  ] as const).map(({ key, icon, border, bg, text }) => (
                    <button
                      key={key}
                      onClick={() => setTaskUpdateStatus(key)}
                      className={`py-2.5 px-1 rounded-lg border-2 transition-all text-center ${taskUpdateStatus === key
                        ? `${border} ${bg} ${text} shadow-sm`
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                    >
                      <div className="text-lg leading-none mb-0.5">{icon}</div>
                      <div className="font-medium text-xs leading-tight">{t(`status.${key === 'in-progress' ? 'inProgress' : key}`)}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label htmlFor="task-notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                  💬 {t('dashboard.yourComment')}
                </label>
                <textarea
                  id="task-notes"
                  value={taskUpdateNotes}
                  onChange={(e) => setTaskUpdateNotes(e.target.value)}
                  rows={8}
                  placeholder={t('dashboard.commentPlaceholder')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] transition-colors bg-white text-gray-900"
                />
                <p className="mt-1.5 text-xs text-gray-500">{t('dashboard.commentHint')}</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={closeTaskModal}
                  disabled={isUpdating}
                  className="px-4 py-2 min-h-[38px] rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={updateTaskStatus}
                  disabled={isUpdating}
                  className="px-5 py-2 min-h-[38px] text-white brand-button-solid rounded-lg text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
