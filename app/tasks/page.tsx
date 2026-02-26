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
    </div>
  );
}
