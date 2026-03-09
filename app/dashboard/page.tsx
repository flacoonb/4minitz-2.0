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
  openActionItems: any[];
  overdueActionItems: any[];
  upcomingActionItems: any[];
  recentMinutes: any[];
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
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <p className="font-medium">{t('errors.loadFailed')}</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const recentMinutes = Array.isArray(data.recentMinutes) ? data.recentMinutes : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('dashboard.overview')}</p>
      </div>

      {/* Statistics Cards with Compact Design */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 mb-6">
        {/* Series Card */}
        <Link href="/meeting-series" className="group relative brand-gradient-bg rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary-border)]">
          <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 backdrop-blur-sm rounded-md flex items-center justify-center mb-1">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-white/90 text-[10px] sm:text-xs font-medium mb-0.5 leading-tight truncate">{t('dashboard.series')}</p>
            <p className="text-lg sm:text-xl font-bold text-white leading-tight">{data.statistics.totalSeries}</p>
          </div>
        </Link>

        {/* Minutes Card */}
        <Link href="/minutes" className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-300">
          <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 backdrop-blur-sm rounded-md flex items-center justify-center mb-1">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-white/90 text-[10px] sm:text-xs font-medium mb-0.5 leading-tight truncate">{t('dashboard.minutes')}</p>
            <p className="text-lg sm:text-xl font-bold text-white leading-tight">{data.statistics.totalMinutes}</p>
            <p className="hidden sm:block text-white/80 text-xs">{data.statistics.finalizedMinutes} {t('dashboard.finalized')}</p>
          </div>
        </Link>

        {/* Drafts Card */}
        <Link href="/minutes?isFinalized=false" className="group relative bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-300">
          <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 backdrop-blur-sm rounded-md flex items-center justify-center mb-1">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <p className="text-white/90 text-[10px] sm:text-xs font-medium mb-0.5 leading-tight truncate">{t('dashboard.drafts')}</p>
            <p className="text-lg sm:text-xl font-bold text-white leading-tight">{data.statistics.draftMinutes}</p>
            <p className="hidden sm:block text-white/80 text-xs">{t('dashboard.minutes')}</p>
          </div>
        </Link>

        {/* Action Items Card */}
        <Link href="/tasks?status=active" className="group relative bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-300">
          <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 backdrop-blur-sm rounded-md flex items-center justify-center mb-1">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-white/90 text-[10px] sm:text-xs font-medium mb-0.5 leading-tight truncate">{t('dashboard.tasks')}</p>
            <p className="text-lg sm:text-xl font-bold text-white leading-tight">{data.statistics.totalActionItems}</p>
            <p className="hidden sm:block text-white/80 text-xs">{t('dashboard.open')}</p>
          </div>
        </Link>

        {/* Overdue Card */}
        <Link href="/tasks?status=all&overdue=true" className="group relative bg-gradient-to-br from-red-500 to-rose-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-300">
          <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 backdrop-blur-sm rounded-md flex items-center justify-center mb-1">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-white/90 text-[10px] sm:text-xs font-medium mb-0.5 leading-tight truncate">{t('dashboard.overdue')}</p>
            <p className="text-lg sm:text-xl font-bold text-white leading-tight">{data.statistics.overdueActionItems}</p>
            <p className="hidden sm:block text-white/80 text-xs">{t('dashboard.tasks')}</p>
          </div>
        </Link>

        {/* Upcoming Card */}
        <Link href="/tasks?status=in-progress" className="group relative brand-gradient-bg rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-2.5 sm:p-3 overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary-border)]">
          <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
          <div className="relative">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 backdrop-blur-sm rounded-md flex items-center justify-center mb-1">
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-white/90 text-[10px] sm:text-xs font-medium mb-0.5 leading-tight truncate">{t('dashboard.upcoming')}</p>
            <p className="text-lg sm:text-xl font-bold text-white leading-tight">{data.statistics.upcomingActionItems}</p>
            <p className="hidden sm:block text-white/80 text-xs">{t('dashboard.tasks')}</p>
          </div>
        </Link>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Tasks */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Moderator Actions */}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 p-6 hover:shadow-xl transition-all">
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
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
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
                  <span className="text-sm text-gray-500">
                    {t('dashboard.lastSent')}: {new Date(data.lastRemindersSentAt).toLocaleString(locale)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* My Tasks Section */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 p-6 hover:shadow-xl transition-all">
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
                className="px-3 py-2.5 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[44px] w-full"
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
                className="px-3 py-2.5 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[44px] w-full"
              >
                <option value="">{t('dashboard.allPriorities')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="low">{t('priority.low')}</option>
              </select>

              <button
                onClick={() => setTaskFilter({ ...taskFilter, overdue: !taskFilter.overdue })}
                className={`px-3 py-2.5 text-sm rounded-lg transition-colors min-h-[44px] w-full ${taskFilter.overdue
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600'
                  }`}
              >
                {taskFilter.overdue ? `✓ ${t('dashboard.onlyOverdue')}` : t('dashboard.onlyOverdue')}
              </button>

              {(taskFilter.status || taskFilter.priority || taskFilter.overdue) && (
                <button
                  onClick={() => setTaskFilter({})}
                  className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 min-h-[44px] w-full"
                >
                  ✕ {t('dashboard.resetFilters')}
                </button>
              )}
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-gray-500 font-medium">{t('dashboard.noTasksFound')}</p>
                  <p className="text-gray-400 text-sm mt-1">
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
                      className={`relative p-4 rounded-xl border-2 transition-all ${isOverdue
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : task.priority === 'high'
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <Link
                            href={`/minutes/${task.minutesId}`}
                            className="font-semibold text-gray-900 dark:text-gray-100 mb-1 hover:text-[var(--brand-primary)] dark:hover:text-[var(--brand-primary)] block"
                          >
                            {task.subject}
                          </Link>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {seriesProject ? `${seriesProject} • ` : ''}
                            {seriesName} • {task.topicSubject}
                          </p>
                          {task.details && (
                            <p className="text-sm text-gray-700 mb-2">{task.details}</p>
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
                        <span className={`px-2 py-1 text-xs font-medium rounded-lg ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                          task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                            task.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                          }`}>
                          {task.status === 'completed' ? `✓ ${t('status.completed')}` :
                            task.status === 'in-progress' ? `⏳ ${t('status.inProgress')}` :
                              task.status === 'cancelled' ? `✕ ${t('status.cancelled')}` :
                                `○ ${t('status.open')}`}
                        </span>

                        {/* Priority */}
                        <span className={`px-2 py-1 text-xs font-medium rounded-lg ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                          task.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                            'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]'
                          }`}>
                          {task.priority === 'high' ? `🔴 ${t('priority.high')}` :
                            task.priority === 'medium' ? `🟡 ${t('priority.medium')}` :
                              `🔵 ${t('priority.low')}`}
                        </span>

                        {/* Due Date */}
                        {task.dueDate && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-lg ${isOverdue ? 'bg-red-200 text-red-900' : 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]'
                            }`}>
                            {isOverdue ? '⚠️ ' : '📅 '}
                            {new Date(task.dueDate).toLocaleDateString(locale)}
                          </span>
                        )}

                        {/* Estimated Hours */}
                        {task.estimatedHours && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-lg">
                            ⏱️ {task.estimatedHours}h
                          </span>
                        )}
                      </div>

                      {/* Additional User Comments */}
                      {task.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-500 mb-1">💬 {t('dashboard.additionalComment')}</p>
                          <p className="text-sm text-gray-700 italic">{task.notes}</p>
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
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 p-6 hover:shadow-xl transition-all">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {t('dashboard.recentMinutes')}
            </h2>
          </div>
          <div className="space-y-3">
            {recentMinutes.slice(0, 5).map((minute) => (
              <Link
                key={minute._id}
                href={`/minutes/${minute._id}`}
                className="block p-3 bg-gradient-to-br from-gray-50 to-green-50 dark:from-slate-700 dark:to-emerald-900/20 border border-gray-200 dark:border-slate-600 rounded-lg hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                        {new Date(minute.date).toLocaleDateString(locale, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${minute.isFinalized
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                          }`}
                      >
                        {minute.isFinalized ? t('dashboard.final') : t('dashboard.draft')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {minute.meetingSeries_id?.project || minute.meetingSeries_id?.name || t('dashboard.noSeries')}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-400 flex-shrink-0"
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{t('dashboard.editTask')}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                    {(editingTask.meetingSeries?.project || t('dashboard.noSeries'))}
                    {editingTask.meetingSeries?.name ? ` – ${editingTask.meetingSeries.name}` : ''} • {editingTask.topicSubject}
                  </p>
                </div>
                <button
                  onClick={closeTaskModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('dashboard.changeStatus')}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={() => setTaskUpdateStatus('open')}
                    className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[44px] ${taskUpdateStatus === 'open'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-300'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 dark:text-gray-200'
                      }`}
                  >
                    <div className="text-lg sm:text-xl mb-0.5">○</div>
                    <div className="font-medium text-sm sm:text-base leading-tight">{t('status.open')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('in-progress')}
                    className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[44px] ${taskUpdateStatus === 'in-progress'
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 dark:text-gray-200'
                      }`}
                  >
                    <div className="text-lg sm:text-xl mb-0.5">⏳</div>
                    <div className="font-medium text-sm sm:text-base leading-tight">{t('status.inProgress')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('completed')}
                    className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[44px] ${taskUpdateStatus === 'completed'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-300'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 dark:text-gray-200'
                      }`}
                  >
                    <div className="text-lg sm:text-xl mb-0.5">✓</div>
                    <div className="font-medium text-sm sm:text-base leading-tight">{t('status.completed')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('cancelled')}
                    className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[44px] ${taskUpdateStatus === 'cancelled'
                      ? 'border-gray-500 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-200'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 dark:text-gray-200'
                      }`}
                  >
                    <div className="text-lg sm:text-xl mb-0.5">✕</div>
                    <div className="font-medium text-sm sm:text-base leading-tight">{t('status.cancelled')}</div>
                  </button>
                </div>
              </div>

              {/* Additional Notes (Editable) */}
              <div>
                <label htmlFor="task-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  💬 {t('dashboard.yourComment')}
                </label>
                <textarea
                  id="task-notes"
                  value={taskUpdateNotes}
                  onChange={(e) => setTaskUpdateNotes(e.target.value)}
                  rows={4}
                  placeholder={t('dashboard.commentPlaceholder')}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] transition-colors"
                />
                <p className="mt-2 text-xs text-gray-500 flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m-1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t('dashboard.commentHint')}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={closeTaskModal}
                  disabled={isUpdating}
                  className="w-full sm:w-auto px-6 py-2.5 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 min-h-[44px]"
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
