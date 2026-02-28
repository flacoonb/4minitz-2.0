"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';

interface Task {
  _id: string;
  subject: string;
  details?: string;
  status: 'open' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  responsibles: string[];
  meetingSeriesId: string;
  minutesId?: string;
  minutesDate?: string;
  topicId?: string;
  topicSubject?: string;
  notes?: string;
  meetingSeries?: {
    _id: string;
    project: string;
    name?: string;
  };
}

const STATUS_CONFIG = {
  open: { label: 'Offen', labelEn: 'Open', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
  'in-progress': { label: 'In Arbeit', labelEn: 'In Progress', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-400' },
  completed: { label: 'Erledigt', labelEn: 'Completed', color: 'bg-green-100 text-green-800', dot: 'bg-green-400' },
  cancelled: { label: 'Abgebrochen', labelEn: 'Cancelled', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
};

const PRIORITY_CONFIG = {
  high: { label: 'Hoch', labelEn: 'High', color: 'bg-red-100 text-red-700', icon: '!' },
  medium: { label: 'Mittel', labelEn: 'Medium', color: 'bg-orange-100 text-orange-700', icon: '–' },
  low: { label: 'Tief', labelEn: 'Low', color: 'bg-gray-100 text-gray-600', icon: '↓' },
};

export default function TasksPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Task edit modal state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskUpdateStatus, setTaskUpdateStatus] = useState<'open' | 'in-progress' | 'completed' | 'cancelled'>('open');
  const [taskUpdateNotes, setTaskUpdateNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filterStatus === 'active') {
        // Don't set status param - filter client-side for open + in-progress
      } else if (filterStatus) {
        params.set('status', filterStatus);
      }
      if (filterPriority) params.set('priority', filterPriority);
      if (filterOverdue) params.set('overdue', 'true');

      const response = await fetch(`/api/tasks?${params.toString()}`, { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        let data = result.data || [];

        // Client-side filter for "active" (open + in-progress)
        if (filterStatus === 'active') {
          data = data.filter((t: Task) => t.status === 'open' || t.status === 'in-progress');
        }

        setTasks(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, filterOverdue]);

  useEffect(() => {
    if (user) fetchTasks();
  }, [user, fetchTasks]);

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      task.subject?.toLowerCase().includes(q) ||
      task.topicSubject?.toLowerCase().includes(q) ||
      task.meetingSeries?.project?.toLowerCase().includes(q)
    );
  });

  const isOverdue = (task: Task) =>
    task.dueDate && new Date(task.dueDate) < new Date() && !['completed', 'cancelled'].includes(task.status);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale);
  };

  const getSeriesDisplayName = (task: Task) => {
    if (!task.meetingSeries) return '';
    const { project, name } = task.meetingSeries;
    return name ? `${project} – ${name}` : project;
  };

  // Task edit modal handlers
  const openTaskModal = (task: Task) => {
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
          headers: { 'Content-Type': 'application/json' },
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

      await fetchTasks();
      closeTaskModal();
    } catch (err) {
      console.error('Error updating task:', err);
      alert(t('errors.updateTaskFailed') + ': ' + (err instanceof Error ? err.message : t('errors.unknown')));
    } finally {
      setIsUpdating(false);
    }
  };

  const stats = {
    total: tasks.length,
    open: tasks.filter(t => t.status === 'open').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    overdue: tasks.filter(t => isOverdue(t)).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('tasks.title')}</h1>
            <p className="text-gray-600 mt-1">{t('tasks.subtitle')}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">{t('tasks.total')}</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-yellow-100 shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
            <div className="text-sm text-gray-500">{t('tasks.statusOpen')}</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-blue-100 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-500">{t('tasks.statusInProgress')}</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-red-100 shadow-sm">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-sm text-gray-500">{t('tasks.overdue')}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder={t('tasks.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 min-w-[200px]"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">{t('tasks.filterActive')}</option>
              <option value="open">{t('tasks.statusOpen')}</option>
              <option value="in-progress">{t('tasks.statusInProgress')}</option>
              <option value="completed">{t('tasks.statusCompleted')}</option>
              <option value="cancelled">{t('tasks.statusCancelled')}</option>
              <option value="">{t('tasks.filterAll')}</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('tasks.allPriorities')}</option>
              <option value="high">{t('tasks.priorityHigh')}</option>
              <option value="medium">{t('tasks.priorityMedium')}</option>
              <option value="low">{t('tasks.priorityLow')}</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterOverdue}
                onChange={(e) => setFilterOverdue(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">{t('tasks.onlyOverdue')}</span>
            </label>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-12 border border-gray-100 shadow-sm text-center">
              <div className="text-gray-400 text-5xl mb-4">✓</div>
              <h3 className="text-lg font-semibold text-gray-700">{t('tasks.noTasks')}</h3>
              <p className="text-gray-500 mt-1">{t('tasks.noTasksHint')}</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task._id}
                className={`bg-white/80 backdrop-blur-sm rounded-xl p-5 border shadow-sm transition-all hover:shadow-md ${
                  isOverdue(task) ? 'border-red-200 bg-red-50/50' : 'border-gray-100'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Priority indicator */}
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${PRIORITY_CONFIG[task.priority]?.color || PRIORITY_CONFIG.medium.color}`}>
                    {PRIORITY_CONFIG[task.priority]?.icon || '–'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{task.subject}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[task.status]?.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[task.status]?.dot}`}></span>
                        {locale === 'de' ? STATUS_CONFIG[task.status]?.label : STATUS_CONFIG[task.status]?.labelEn}
                      </span>
                      {isOverdue(task) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {t('tasks.overdue')}
                        </span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                      {task.meetingSeries && (
                        <Link
                          href={`/meeting-series/${task.meetingSeries._id}`}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {getSeriesDisplayName(task)}
                        </Link>
                      )}
                      {task.topicSubject && task.topicSubject !== 'Task' && (
                        <span>• {task.topicSubject}</span>
                      )}
                      {task.dueDate && (
                        <span className={isOverdue(task) ? 'text-red-600 font-medium' : ''}>
                          {t('tasks.due')}: {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.minutesId && task.minutesId !== 'central' && (
                        <Link
                          href={`/minutes/${task.minutesId}`}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {t('tasks.viewProtocol')}
                        </Link>
                      )}
                    </div>

                    {task.notes && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{task.notes}</p>
                    )}
                  </div>

                  {/* Edit Button */}
                  <button
                    onClick={() => openTaskModal(task)}
                    className="shrink-0 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t('common.edit')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Count */}
        {!loading && filteredTasks.length > 0 && (
          <div className="text-center text-sm text-gray-500">
            {filteredTasks.length} {filteredTasks.length === 1 ? t('tasks.taskSingular') : t('tasks.taskPlural')}
          </div>
        )}
      </div>

      {/* Task Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.editTask')}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {editingTask.meetingSeries?.project || t('dashboard.noSeries')}
                    {editingTask.meetingSeries?.name ? ` – ${editingTask.meetingSeries.name}` : ''}{editingTask.topicSubject ? ` • ${editingTask.topicSubject}` : ''}
                  </p>
                </div>
                <button
                  onClick={closeTaskModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Dialog schliessen"
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
                  {editingTask.minutesDate && (
                    <span className="text-blue-700">
                      📅 {t('dashboard.minuteLabel')} {new Date(editingTask.minutesDate).toLocaleDateString(locale)}
                    </span>
                  )}
                  {editingTask.dueDate && (
                    <span className="text-blue-700">
                      {editingTask.minutesDate ? '• ' : ''}⏰ {t('dashboard.dueLabel')} {new Date(editingTask.dueDate).toLocaleDateString(locale)}
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
    </div>
  );
}
