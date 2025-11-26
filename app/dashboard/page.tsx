'use client';

import { useState, useEffect } from 'react';
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
  }>({ status: 'open' });

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

  useEffect(() => {
    fetchDashboard();
    fetchTasks();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [taskFilter]);

  const handleSendReminders = async () => {
    setIsModalOpen(true);
  };

  const executeSendReminders = async () => {
    setSendingReminders(true);
    try {
      const response = await fetch('/api/tasks/remind-all', {
        method: 'POST',
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

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard', { credentials: 'include' });

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
  };

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (taskFilter.status) params.append('status', taskFilter.status);
      if (taskFilter.priority) params.append('priority', taskFilter.priority);
      if (taskFilter.overdue !== undefined) params.append('overdue', String(taskFilter.overdue));

      const response = await fetch(`/api/tasks?${params.toString()}`, { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        const sanitizedTasks = (result.data || []).map((task: Task) => ({
          ...task,
          meetingSeries: task.meetingSeries || null,
        }));
        setTasks(sanitizedTasks);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

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
    if (!editingTask || !editingTask.topicId) return;

    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/tasks/update/${editingTask.minutesId}/${editingTask.topicId}/${editingTask._id}`,
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
        <p className="text-gray-600">{t('dashboard.overview')}</p>
      </div>

      {/* Statistics Cards with Compact Design */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        {/* Series Card */}
        <div className="group relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4 overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8"></div>
          <div className="relative">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-white/90 text-xs font-medium mb-1">{t('dashboard.series')}</p>
            <p className="text-2xl font-bold text-white">{data.statistics.totalSeries}</p>
          </div>
        </div>

        {/* Minutes Card */}
        <div className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4 overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8"></div>
          <div className="relative">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-white/90 text-xs font-medium mb-1">{t('dashboard.minutes')}</p>
            <p className="text-2xl font-bold text-white">{data.statistics.totalMinutes}</p>
            <p className="text-white/80 text-xs">{data.statistics.finalizedMinutes} {t('dashboard.finalized')}</p>
          </div>
        </div>

        {/* Action Items Card */}
        <div className="group relative bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4 overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8"></div>
          <div className="relative">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-white/90 text-xs font-medium mb-1">{t('dashboard.tasks')}</p>
            <p className="text-2xl font-bold text-white">{data.statistics.totalActionItems}</p>
            <p className="text-white/80 text-xs">{t('dashboard.open')}</p>
          </div>
        </div>

        {/* Overdue Card */}
        <div className="group relative bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4 overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8"></div>
          <div className="relative">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-white/90 text-xs font-medium mb-1">{t('dashboard.overdue')}</p>
            <p className="text-2xl font-bold text-white">{data.statistics.overdueActionItems}</p>
            <p className="text-white/80 text-xs">{t('dashboard.tasks')}</p>
          </div>
        </div>

        {/* Upcoming Card */}
        <div className="group relative bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4 overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8"></div>
          <div className="relative">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-white/90 text-xs font-medium mb-1">{t('dashboard.upcoming')}</p>
            <p className="text-2xl font-bold text-white">{data.statistics.upcomingActionItems}</p>
            <p className="text-white/80 text-xs">{t('dashboard.tasks')}</p>
          </div>
        </div>

        {/* Drafts Card */}
        <div className="group relative bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4 overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8"></div>
          <div className="relative">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <p className="text-white/90 text-xs font-medium mb-1">{t('dashboard.drafts')}</p>
            <p className="text-2xl font-bold text-white">{data.statistics.draftMinutes}</p>
            <p className="text-white/80 text-xs">{t('dashboard.minutes')}</p>
          </div>
        </div>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Tasks */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Moderator Actions */}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {t('dashboard.moderatorActions')}
                  </h2>
                </div>
              </div>
              <p className="text-gray-600 mb-4 text-sm">
                {t('dashboard.sendRemindersDesc')}
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSendReminders}
                  disabled={sendingReminders}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {t('dashboard.myTasks')} ({tasks.length})
                </h2>
              </div>
            </div>

            {/* Task Filters */}
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                value={taskFilter.status || ''}
                onChange={(e) => setTaskFilter({ ...taskFilter, status: e.target.value || undefined })}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('dashboard.allStatus')}</option>
                <option value="open">{t('status.open')}</option>
                <option value="in-progress">{t('status.inProgress')}</option>
                <option value="completed">{t('status.completed')}</option>
              </select>

              <select
                value={taskFilter.priority || ''}
                onChange={(e) => setTaskFilter({ ...taskFilter, priority: e.target.value || undefined })}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('dashboard.allPriorities')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="low">{t('priority.low')}</option>
              </select>

              <button
                onClick={() => setTaskFilter({ ...taskFilter, overdue: !taskFilter.overdue })}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${taskFilter.overdue
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
                  }`}
              >
                {taskFilter.overdue ? `✓ ${t('dashboard.onlyOverdue')}` : t('dashboard.onlyOverdue')}
              </button>

              {(taskFilter.status || taskFilter.priority || taskFilter.overdue) && (
                <button
                  onClick={() => setTaskFilter({})}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
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
                  const seriesName = task.meetingSeries?.name || t('dashboard.noSeries');
                  const seriesProject = task.meetingSeries?.project || '';

                  return (
                    <div
                      key={task._id}
                      className={`relative p-4 rounded-xl border-2 transition-all ${isOverdue
                        ? 'bg-red-50 border-red-200'
                        : task.priority === 'high'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-white border-gray-200'
                        }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <Link
                            href={`/minutes/${task.minutesId}`}
                            className="font-semibold text-gray-900 mb-1 hover:text-blue-600 block"
                          >
                            {task.subject}
                          </Link>
                          <p className="text-sm text-gray-600 mb-2">
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
                          className="ml-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
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
                            'bg-blue-100 text-blue-800'
                          }`}>
                          {task.priority === 'high' ? `🔴 ${t('priority.high')}` :
                            task.priority === 'medium' ? `🟡 ${t('priority.medium')}` :
                              `🔵 ${t('priority.low')}`}
                        </span>

                        {/* Due Date */}
                        {task.dueDate && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-lg ${isOverdue ? 'bg-red-200 text-red-900' : 'bg-purple-100 text-purple-800'
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
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
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
                className="block p-3 bg-gradient-to-br from-gray-50 to-green-50 border border-gray-200 rounded-lg hover:shadow-md hover:scale-[1.02] transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 text-sm truncate">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.editTask')}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {editingTask.meetingSeries?.project ? `${editingTask.meetingSeries.project} • ` : ''}
                    {(editingTask.meetingSeries?.name || t('dashboard.noSeries'))} • {editingTask.topicSubject}
                  </p>
                </div>
                <button
                  onClick={closeTaskModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Original Task Description (Read-only) */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-blue-900 mb-1">{t('dashboard.originalTask')}</h3>
                    <p className="text-base text-blue-800 font-medium">{editingTask.subject}</p>
                    {editingTask.details && (
                      <p className="text-sm text-blue-700 mt-2 whitespace-pre-wrap">{editingTask.details}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-300 flex flex-wrap gap-2 text-xs">
                  <span className="text-blue-700">
                    📅 {t('dashboard.minuteLabel')} {new Date(editingTask.minutesDate).toLocaleDateString(locale)}
                  </span>
                  {editingTask.dueDate && (
                    <span className="text-blue-700">
                      • ⏰ {t('dashboard.dueLabel')} {new Date(editingTask.dueDate).toLocaleDateString(locale)}
                    </span>
                  )}
                  {editingTask.priority && (
                    <span className="text-blue-700">
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
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTaskUpdateStatus('open')}
                    className={`p-4 rounded-lg border-2 transition-all ${taskUpdateStatus === 'open'
                      ? 'border-red-500 bg-red-50 text-red-900'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="text-2xl mb-1">○</div>
                    <div className="font-medium">{t('status.open')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('in-progress')}
                    className={`p-4 rounded-lg border-2 transition-all ${taskUpdateStatus === 'in-progress'
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-900'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="text-2xl mb-1">⏳</div>
                    <div className="font-medium">{t('status.inProgress')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('completed')}
                    className={`p-4 rounded-lg border-2 transition-all ${taskUpdateStatus === 'completed'
                      ? 'border-green-500 bg-green-50 text-green-900'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="text-2xl mb-1">✓</div>
                    <div className="font-medium">{t('status.completed')}</div>
                  </button>

                  <button
                    onClick={() => setTaskUpdateStatus('cancelled')}
                    className={`p-4 rounded-lg border-2 transition-all ${taskUpdateStatus === 'cancelled'
                      ? 'border-gray-500 bg-gray-50 text-gray-900'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="text-2xl mb-1">✕</div>
                    <div className="font-medium">{t('status.cancelled')}</div>
                  </button>
                </div>
              </div>

              {/* Additional Notes (Editable) */}
              <div>
                <label htmlFor="task-notes" className="block text-sm font-medium text-gray-700 mb-2">
                  💬 {t('dashboard.yourComment')}
                </label>
                <textarea
                  id="task-notes"
                  value={taskUpdateNotes}
                  onChange={(e) => setTaskUpdateNotes(e.target.value)}
                  rows={5}
                  placeholder={t('dashboard.commentPlaceholder')}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="mt-2 text-xs text-gray-500 flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m-1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t('dashboard.commentHint')}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={closeTaskModal}
                  disabled={isUpdating}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={updateTaskStatus}
                  disabled={isUpdating}
                  className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
