"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { AgendaEntryItem } from '@/components/AgendaEntryItem';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MeetingSeries {
  _id: string;
  project: string;
  name: string;
  participants: string[];
}

interface Label {
  _id: string;
  name: string;
  color: string;
  description?: string;
  icon?: string;
}

interface AgendaItemEntry {
  id: string;
  subject: string;
  content?: string;
  labelId?: string;
  responsibles: string[];
  dueDate?: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
  isImported?: boolean; // Mark entries imported from previous protocol
  importedComment?: string; // New comment for imported tasks
  originalTaskId?: string; // Original task ID to prevent duplicate imports
}

interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  responsible?: string;
  entries: AgendaItemEntry[];
  isCompleted: boolean;
}

// Sortable Agenda Item Component
function SortableAgendaItem({ 
  agendaItem, 
  index, 
  onUpdate, 
  onDelete, 
  labels,
  selectedSeries
}: {
  agendaItem: AgendaItem;
  index: number;
  onUpdate: (id: string, updates: Partial<AgendaItem>) => void;
  onDelete: (id: string) => void;
  labels: Label[];
  selectedSeries: MeetingSeries | null;
}) {
  const t = useTranslations('minutes');
  const _locale = useLocale();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: agendaItem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<AgendaItemEntry>>({
    subject: '',
    content: '',
    labelId: '',
    responsibles: [],
    dueDate: '',
    isCompleted: false,
    priority: 'medium',
  });

  const addEntry = () => {
    if (newEntry.subject?.trim()) {
      const entry: AgendaItemEntry = {
        id: Date.now().toString(),
        subject: newEntry.subject.trim(),
        content: newEntry.content?.trim() || '',
        labelId: newEntry.labelId || undefined,
        responsibles: newEntry.responsibles || [],
        dueDate: newEntry.dueDate || undefined,
        isCompleted: false,
        priority: newEntry.priority as 'low' | 'medium' | 'high',
      };

      onUpdate(agendaItem.id, {
        entries: [...agendaItem.entries, entry]
      });

      setNewEntry({
        subject: '',
        content: '',
        labelId: '',
        responsibles: [],
        dueDate: '',
        isCompleted: false,
        priority: 'medium',
      });
      setShowEntryForm(false);
    }
  };

  const removeEntry = (entryId: string) => {
    onUpdate(agendaItem.id, {
      entries: agendaItem.entries.filter(e => e.id !== entryId)
    });
  };

  const updateEntry = (entryId: string, updates: Partial<AgendaItemEntry>) => {
    onUpdate(agendaItem.id, {
      entries: agendaItem.entries.map(e => 
        e.id === entryId ? { ...e, ...updates } : e
      )
    });
  };

  const getLabelById = (labelId?: string) => {
    return labels.find(l => l._id === labelId);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg"
    >
      {/* Header with Drag Handle */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-blue-100 text-blue-800 text-sm font-bold rounded-full flex items-center justify-center">
                {index + 1}
              </span>
              <input
                type="text"
                value={agendaItem.title}
                onChange={(e) => onUpdate(agendaItem.id, { title: e.target.value })}
                placeholder={t('agendaItemTitle')}
                className="flex-1 text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 p-0"
              />
            </div>
            
            <textarea
              value={agendaItem.description || ''}
              onChange={(e) => onUpdate(agendaItem.id, { description: e.target.value })}
              placeholder={t('descriptionOptional')}
              rows={2}
              className="w-full mt-2 text-sm bg-transparent border-none focus:outline-none focus:ring-0 p-0 resize-none"
            />
          </div>
        </div>
        
        <button
          onClick={() => onDelete(agendaItem.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Entries */}
      <div className="space-y-3 mb-4">
        {agendaItem.entries.map((entry, entryIndex) => (
          <AgendaEntryItem
            key={entry.id}
            entry={entry}
            entryIndex={entryIndex}
            getLabelById={getLabelById}
            t={t}
            labels={labels}
            selectedSeries={selectedSeries}
            onUpdate={updateEntry}
            onDelete={removeEntry}
          />
        ))}
      </div>

      {/* Add Entry Form */}
      {showEntryForm && (
        <div className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden shadow-sm">
          {/* Header mit Gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('addNewTask')}
            </h4>
          </div>
          
          <div className="p-5 space-y-4">
            {/* Diskussionspunkt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('discussionPoint')}</label>
              <input
                type="text"
                value={newEntry.subject || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, subject: e.target.value }))}
                placeholder={`${t('discussionPoint')}...`}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            
            {/* Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('detailsOptional')}</label>
              <textarea
                value={newEntry.content || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, content: e.target.value }))}
                placeholder={`${t('detailsOptional')}...`}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
              />
            </div>
            
            {/* Type, Status, Priority and Due Date in Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('type')}</label>
                <select
                  value={newEntry.labelId || ''}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, labelId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                >
                  <option value="">{t('selectType')}</option>
                  {labels.map((label) => (
                    <option key={label._id} value={label._id}>
                      {label.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('status')}</label>
                <select
                  value={newEntry.isCompleted ? 'completed' : 'open'}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, isCompleted: e.target.value === 'completed' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                >
                  <option value="open">{t('open')}</option>
                  <option value="completed">{t('completed')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('priority')}</label>
                <select
                  value={newEntry.priority || 'medium'}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                >
                  <option value="low">{t('low')}</option>
                  <option value="medium">{t('medium')}</option>
                  <option value="high">{t('high')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('dueDate')}</label>
                <input
                  type="date"
                  value={newEntry.dueDate || ''}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                />
              </div>
            </div>
            
            {/* Verantwortliche */}
            {selectedSeries && selectedSeries.participants.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('responsiblesLabel')}
                  <span className="text-xs text-gray-500 ml-2">{t('multiSelectHint')}</span>
                </label>
                <select
                  multiple
                  value={newEntry.responsibles || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setNewEntry(prev => ({ ...prev, responsibles: selected }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                  size={3}
                >
                  {selectedSeries.participants.map((participant) => (
                    <option key={participant} value={participant} className="py-1">
                      {participant}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Notizen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('notes')}</label>
              <textarea
                value={newEntry.importedComment || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, importedComment: e.target.value }))}
                placeholder={t('notesPlaceholder')}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
              />
            </div>
            
            {/* Aktions-Buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={addEntry}
                disabled={!newEntry.subject?.trim()}
                className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 shadow-sm hover:shadow"
              >
                {t('add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEntryForm(false);
                  setNewEntry({
                    subject: '',
                    content: '',
                    labelId: '',
                    responsibles: [],
                    dueDate: '',
                    isCompleted: false,
                    priority: 'medium',
                  });
                }}
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Button */}
      <button
        type="button"
        onClick={() => setShowEntryForm(true)}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-600 hover:text-blue-600"
      >
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('addEntry')}
        </div>
      </button>
    </div>
  );
}

export default function NewMinutePage() {
  const t = useTranslations('minutes');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const seriesId = searchParams.get('seriesId');
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [_labelsLoading, setLabelsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [meetingSeries, setMeetingSeries] = useState<MeetingSeries[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<MeetingSeries | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  
  // Pending tasks from previous minutes
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [showPendingTasks, setShowPendingTasks] = useState(false);
  const [loadingPendingTasks, setLoadingPendingTasks] = useState(false);
  const [importingPendingTasks, setImportingPendingTasks] = useState(false);
  
  // Draft check
  const [existingDraft, setExistingDraft] = useState<any>(null);
  const [_checkingDraft, setCheckingDraft] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    meetingSeries_id: seriesId || '',
    date: new Date().toISOString().split('T')[0],
    title: '',
    participants: [] as string[],
    agendaItems: [] as AgendaItem[],
    globalNote: '',
    location: '',
    startTime: '',
    endTime: '',
  });

  // Drag & Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const checkForExistingDraft = useCallback(async (seriesId: string) => {
    setCheckingDraft(true);
    try {
      const response = await fetch(`/api/meeting-series/${seriesId}/check-draft`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.hasDraft) {
          setExistingDraft(result.draft);
        } else {
          setExistingDraft(null);
        }
      }
    } catch (err) {
      console.error('Failed to check for existing draft:', err);
    } finally {
      setCheckingDraft(false);
    }
  }, []);

  const fetchMeetingSeries = useCallback(async () => {
    setSeriesLoading(true);
    try {
      const response = await fetch('/api/meeting-series', {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setMeetingSeries(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch meeting series:', err);
    } finally {
      setSeriesLoading(false);
    }
  }, []);

  const fetchLabels = useCallback(async () => {
    setLabelsLoading(true);
    try {
      const response = await fetch('/api/settings/labels', {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setLabels(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch labels:', err);
    } finally {
      setLabelsLoading(false);
    }
  }, []);

  const fetchPendingTasks = useCallback(async () => {
    if (!formData.meetingSeries_id) {
      alert(t('selectSeriesFirst'));
      return;
    }

    setLoadingPendingTasks(true);
    try {
      const response = await fetch(`/api/meeting-series/${formData.meetingSeries_id}/pending-tasks`, {
        credentials: 'include', // Cookie-based authentication
      });

      if (response.ok) {
        const result = await response.json();
        setPendingTasks(result.data || []);
        if (result.data && result.data.length > 0) {
          setShowPendingTasks(true);
        } else {
          alert(t('noPendingTasksFound'));
        }
      }
    } catch (err) {
      console.error('Error fetching pending tasks:', err);
      alert(t('errorLoadingPendingTasks'));
    } finally {
      setLoadingPendingTasks(false);
    }
  }, [formData.meetingSeries_id, t]);

  // Check permissions
  useEffect(() => {
    if (!authLoading && (!user || user.role === 'user')) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Fetch data
  useEffect(() => {
    if (user && user.role !== 'user') {
      fetchMeetingSeries();
      fetchLabels();
    }
  }, [user, fetchMeetingSeries, fetchLabels]);

  // Update form when seriesId param changes
  useEffect(() => {
    if (seriesId) {
      setFormData(prev => ({ ...prev, meetingSeries_id: seriesId }));
    }
  }, [seriesId]);

  // Update selected series and participants when meetingSeries_id changes
  useEffect(() => {
    if (formData.meetingSeries_id) {
      const series = meetingSeries.find(s => s._id === formData.meetingSeries_id);
      setSelectedSeries(series || null);
      
      if (series) {
        // Check if there's already a draft for this series
        checkForExistingDraft(formData.meetingSeries_id);
        
        setFormData(prev => ({
          ...prev,
          participants: [...series.participants] // Pre-fill with series participants
        }));
        
        // Automatically load pending tasks when a series is selected
        fetchPendingTasks();
      }
    }
  }, [formData.meetingSeries_id, meetingSeries, fetchPendingTasks, checkForExistingDraft]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addAgendaItem = () => {
    const newItem: AgendaItem = {
      id: Date.now().toString(),
      title: '',
      description: '',
      duration: undefined,
      responsible: '',
      entries: [],
      isCompleted: false,
    };

    setFormData(prev => ({
      ...prev,
      agendaItems: [...prev.agendaItems, newItem]
    }));
  };


  const importPendingTasks = () => {
    if (pendingTasks.length === 0) {
      alert(t('noTasksToImport'));
      return;
    }

    // Prevent double imports
    if (importingPendingTasks) {
      return;
    }

    setImportingPendingTasks(true);

    // Collect all already imported task IDs from all agenda items
    const alreadyImportedIds = new Set<string>();
    formData.agendaItems.forEach(item => {
      item.entries.forEach(entry => {
        if (entry.originalTaskId) {
          alreadyImportedIds.add(entry.originalTaskId);
        }
      });
    });

    // Filter out already imported tasks
    const tasksToImport = pendingTasks.filter(task => {
      const taskId = task._id || task.id;
      if (alreadyImportedIds.has(taskId)) {
        console.log('Skipping already imported task:', taskId, task.subject);
        return false;
      }
      return true;
    });

    console.log('Tasks to import:', tasksToImport.length, tasksToImport.map(t => ({ id: t._id || t.id, subject: t.subject })));

    if (tasksToImport.length === 0) {
      alert(t('allTasksImported'));
      setImportingPendingTasks(false);
      return;
    }

    // Immediately remove tasks that will be imported from pendingTasks list
    // This prevents double imports if user clicks quickly
    const originalPendingTasksCount = pendingTasks.length;
    const importedTaskIds = new Set(tasksToImport.map(task => task._id || task.id));
    const remainingTasks = pendingTasks.filter(task => !importedTaskIds.has(task._id || task.id));
    
    console.log('Original pending tasks:', originalPendingTasksCount);
    console.log('Imported task IDs:', Array.from(importedTaskIds));
    console.log('Remaining tasks after filter:', remainingTasks.length);
    
    setPendingTasks(remainingTasks);

    // Check if "Pendenzen aus letzter Sitzung" already exists
    const existingPendingItem = formData.agendaItems.find(
      item => item.title === t('pendingTasksFromLastSession')
    );

    if (existingPendingItem) {
      // Add tasks to existing agenda item
      const baseTimestamp = Date.now();
      const newEntries = tasksToImport.map((task, index) => {
        const entry = {
          id: `${baseTimestamp}-import-${index}-${Math.random().toString(36).substr(2, 9)}`,
          subject: task.subject,
          content: [
            task.details || '',
            task.notes ? `\n\n**Letzter Kommentar:** ${task.notes}` : ''
          ].filter(Boolean).join(''),
          responsibles: task.responsibles || [],
          dueDate: task.duedate,
          isCompleted: task.status === 'completed',
          priority: task.priority || 'medium',
          isImported: true, // Mark as imported
          importedComment: '', // Initialize empty comment field
          originalTaskId: task._id || task.id, // Store original task ID
        };
        console.log('Creating entry:', entry.id, 'for task:', task._id || task.id, task.subject);
        return entry;
      });

      console.log('Adding', newEntries.length, 'new entries to existing agenda item');

      setFormData(prev => ({
        ...prev,
        agendaItems: prev.agendaItems.map(item =>
          item.id === existingPendingItem.id
            ? { ...item, entries: [...item.entries, ...newEntries] }
            : item
        )
      }));
    } else {
      // Create new agenda item with all pending tasks
      const baseTimestamp = Date.now();
      const newAgendaItem: AgendaItem = {
        id: `${baseTimestamp}-agenda-${Math.random().toString(36).substr(2, 9)}`,
        title: t('pendingTasksFromLastSession'),
        description: t('pendingTasksDescription'),
        isCompleted: false,
        entries: tasksToImport.map((task, index) => ({
          id: `${baseTimestamp}-import-${index}-${Math.random().toString(36).substr(2, 9)}`,
          subject: task.subject,
          content: [
            task.details || '',
            task.notes ? `\n\n**Letzter Kommentar:** ${task.notes}` : ''
          ].filter(Boolean).join(''),
          responsibles: task.responsibles || [],
          dueDate: task.duedate,
          isCompleted: task.status === 'completed',
          priority: task.priority || 'medium',
          isImported: true, // Mark as imported
          importedComment: '', // Initialize empty comment field
          originalTaskId: task._id || task.id, // Store original task ID
        }))
      };

      setFormData(prev => ({
        ...prev,
        agendaItems: [newAgendaItem, ...prev.agendaItems]
      }));
    }

    // Reset import state (pendingTasks already updated above)
    if (remainingTasks.length === 0) {
      setShowPendingTasks(false);
    }
    setImportingPendingTasks(false);
    
    const skippedCount = originalPendingTasksCount - tasksToImport.length;
    if (skippedCount > 0) {
      alert(t('tasksImported', {count: tasksToImport.length, skipped: skippedCount}));
    } else {
      alert(t('tasksImportedAsAgenda', {count: tasksToImport.length}));
    }
  };

  const importPendingTask = (task: any) => {
    console.log('=== importPendingTask called ===');
    console.log('Task:', task);
    
    // Check if task is already imported
    const taskId = task._id || task.id;
    console.log('Task ID:', taskId);
    
    // Log all existing originalTaskIds
    const existingIds: string[] = [];
    formData.agendaItems.forEach(item => {
      item.entries.forEach(entry => {
        if (entry.originalTaskId) {
          existingIds.push(entry.originalTaskId);
        }
      });
    });
    console.log('Already imported task IDs:', existingIds);
    
    const isAlreadyImported = formData.agendaItems.some(item =>
      item.entries.some(entry => entry.originalTaskId === taskId)
    );
    
    console.log('Is already imported?', isAlreadyImported);

    if (isAlreadyImported) {
      alert(t('taskAlreadyImported'));
      return;
    }

    // Check if "Pendenzen aus letzter Sitzung" already exists
    const existingPendingItem = formData.agendaItems.find(
      item => item.title === t('pendingTasksFromLastSession')
    );

    const newEntry = {
      id: `${Date.now()}-import-${Math.random().toString(36).substr(2, 9)}`,
      subject: task.subject,
      content: [
        task.details || '',
        task.notes ? `\n\n**Letzter Kommentar:** ${task.notes}` : ''
      ].filter(Boolean).join(''),
      responsibles: task.responsibles || [],
      dueDate: task.duedate,
      isCompleted: task.status === 'completed',
      priority: task.priority || 'medium',
      isImported: true, // Mark as imported
      importedComment: '', // Initialize empty comment field
      originalTaskId: taskId, // Store original task ID
    };
    
    console.log('Creating new entry:', newEntry.id, 'with originalTaskId:', newEntry.originalTaskId);

    if (existingPendingItem) {
      console.log('Adding to existing pending item, current entries:', existingPendingItem.entries.length);
      // Add to existing agenda item
      setFormData(prev => ({
        ...prev,
        agendaItems: prev.agendaItems.map(item =>
          item.id === existingPendingItem.id
            ? { ...item, entries: [...item.entries, newEntry] }
            : item
        )
      }));
    } else {
      // Create new agenda item
      const newAgendaItem: AgendaItem = {
        id: `${Date.now()}-agenda-${Math.random().toString(36).substr(2, 9)}`,
        title: t('pendingTasksFromLastSession'),
        description: t('pendingTasksDescription'),
        isCompleted: false,
        entries: [newEntry]
      };

      setFormData(prev => ({
        ...prev,
        agendaItems: [newAgendaItem, ...prev.agendaItems]
      }));
      console.log('Created new pending item agenda');
    }

    // Remove from pending list
    console.log('Removing task from pending list');
    setPendingTasks(prev => {
      const filtered = prev.filter(t => (t._id || t.id) !== taskId);
      console.log('Pending tasks after removal:', filtered.length);
      return filtered;
    });
    
    console.log('=== importPendingTask completed ===');
  };

  const updateAgendaItem = (id: string, updates: Partial<AgendaItem>) => {
    setFormData(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  };

  const deleteAgendaItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.filter(item => item.id !== id)
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setFormData(prev => {
        const oldIndex = prev.agendaItems.findIndex(item => item.id === active.id);
        const newIndex = prev.agendaItems.findIndex(item => item.id === over?.id);

        return {
          ...prev,
          agendaItems: arrayMove(prev.agendaItems, oldIndex, newIndex)
        };
      });
    }
  };

  const addParticipant = (participant: string) => {
    if (participant.trim() && !formData.participants.includes(participant.trim())) {
      setFormData(prev => ({
        ...prev,
        participants: [...prev.participants, participant.trim()]
      }));
    }
  };

  const removeParticipant = (participant: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participant)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/minutes', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingSeries_id: formData.meetingSeries_id,
          date: formData.date,
          title: formData.title,
          participants: formData.participants,
          agendaItems: formData.agendaItems,
          globalNote: formData.globalNote,
          location: formData.location,
          startTime: formData.startTime,
          endTime: formData.endTime,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create minutes');
      }

      const result = await response.json();
      
      // Redirect to the new minutes
      router.push(`/minutes/${result.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const [newParticipant, setNewParticipant] = useState('');

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Redirect will happen in useEffect if user is not authorized
  if (!user || user.role === 'user') {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/minutes"
          className="inline-flex items-center text-green-600 hover:text-green-800 text-sm font-medium mb-6 hover:scale-105 transition-all"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('backToMinutes')}
        </Link>

        <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-8 border border-green-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {t('newMinuteWithAgenda')}
              </h1>
              <p className="text-lg text-green-700 font-medium mt-1">
                {t('createStructuredMinutes')}
              </p>
            </div>
            {/* Categories management removed */}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">{t('errorCreating')}</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Existing Draft Warning */}
      {existingDraft && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="bg-yellow-400 p-3 rounded-lg flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-900 mb-2">
                {t('draftExistsTitle')}
              </h3>
              <p className="text-yellow-800 mb-4">
                {t('draftExistsText')}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/minutes/${existingDraft._id}/edit`)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t('editDraft')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, meetingSeries_id: '' }));
                    setExistingDraft(null);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  {t('chooseOtherSeries')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-100 shadow-lg ${existingDraft ? 'opacity-50 pointer-events-none' : ''}`}>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t('basicInfo')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="meetingSeries_id" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('sessionSeries')} *
                </label>
                <select
                  id="meetingSeries_id"
                  name="meetingSeries_id"
                  value={formData.meetingSeries_id}
                  onChange={handleInputChange}
                  required
                  disabled={seriesLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  <option value="">{t('selectSessionSeries')}</option>
                  {meetingSeries.map((series) => (
                    <option key={series._id} value={series._id}>
                      {series.project} - {series.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('date')} *
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('minuteTitle')}
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder={t('minuteTitlePlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('location')}
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder={t('locationPlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('startTime')}
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('endTime')}
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* Pending Tasks Section */}
          {formData.meetingSeries_id && (
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl p-6 border-2 border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-600 p-2 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{t('tasksFromLastMinute')}</h2>
                    <p className="text-sm text-gray-600">{t('tasksFromLastMinuteHint')}</p>
                  </div>
                </div>
                {pendingTasks.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPendingTasks(!showPendingTasks)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      {showPendingTasks ? t('hide') : t('show')}
                    </button>
                    <button
                      type="button"
                      onClick={importPendingTasks}
                      disabled={importingPendingTasks}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
                    >
                      {importingPendingTasks ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {t('importing')}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {t('importAll')}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4">
                {loadingPendingTasks ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">{t('loadingTasks')}</p>
                  </div>
                ) : pendingTasks.length === 0 ? (
                  <div className="text-center py-8 bg-white rounded-lg">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-gray-700 font-medium">{t('noTasksAvailable')}</p>
                    <p className="text-sm text-gray-500 mt-2">{t('noTasksInLastMinute')}</p>
                  </div>
                ) : showPendingTasks ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 font-medium mb-3">
                      {t('tasksFound', {count: pendingTasks.length})}
                    </p>
                    {pendingTasks.map((task) => {
                      const taskId = task._id || task.id;
                      const isAlreadyImported = formData.agendaItems.some(item =>
                        item.entries.some(entry => entry.originalTaskId === taskId)
                      );
                      
                      return (
                        <div key={task._id} className={`rounded-lg p-4 border transition-all ${
                          isAlreadyImported 
                            ? 'bg-gray-100 border-gray-300 opacity-60' 
                            : 'bg-white border-gray-200 hover:border-orange-300'
                        }`}>
                          {isAlreadyImported && (
                            <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="font-medium">{t('alreadyImported')}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  task.status === 'open' ? 'bg-blue-100 text-blue-800' :
                                  task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  task.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {task.status === 'open' ? t('open') :
                                   task.status === 'in-progress' ? t('inProgress') :
                                   task.status === 'completed' ? t('completed') :
                                   task.status === 'cancelled' ? t('cancelled') :
                                   task.status}
                                </span>
                                {task.priority && (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    task.priority === 'high' ? 'bg-red-100 text-red-800' :
                                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {task.priority === 'high' ? t('high') :
                                     task.priority === 'medium' ? t('medium') :
                                     t('low')}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-semibold text-gray-900 mb-2">{task.subject}</h3>
                              {task.details && (
                                <p className="text-sm text-gray-600 mb-2">{task.details}</p>
                              )}
                              {task.responsibles && task.responsibles.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span>{task.responsibles.join(', ')}</span>
                                </div>
                              )}
                              {task.duedate && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>{new Date(task.duedate).toLocaleDateString(locale)}</span>
                                </div>
                              )}
                              {task.notes && (
                                <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-gray-700">
                                  <strong>{t('lastComment')}</strong> {task.notes}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => importPendingTask(task)}
                              disabled={isAlreadyImported}
                              className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                                isAlreadyImported
                                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                  : 'bg-orange-600 text-white hover:bg-orange-700'
                              }`}
                            >
                              {isAlreadyImported ? t('imported') : t('importAsAgendaItem')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-white rounded-lg">
                    <button
                      type="button"
                      onClick={() => setShowPendingTasks(true)}
                      className="text-orange-600 hover:text-orange-700 font-medium"
                    >
                      {t('showTasks', {count: pendingTasks.length})}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Participants */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('participants')}</h2>
            {selectedSeries && (
              <p className="text-sm text-gray-600 mb-3">
                {t('participantsHint', {name: selectedSeries.name})}
              </p>
            )}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addParticipant(newParticipant), setNewParticipant(''))}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder={t('addParticipant')}
                />
                <button
                  type="button"
                  onClick={() => {
                    addParticipant(newParticipant);
                    setNewParticipant('');
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
              
              {formData.participants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.participants.map((participant, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{participant}</span>
                      <button
                        type="button"
                        onClick={() => removeParticipant(participant)}
                        className="hover:bg-green-200 rounded-full p-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Traktanden (Agenda Items) */}
          <div>
            <div className="sticky top-32 z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 border border-gray-100 flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('agendaItems')}</h2>
              <button
                type="button"
                onClick={addAgendaItem}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors border-2 border-white shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('addAgendaItem')}
              </button>
            </div>

            {formData.agendaItems.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noAgendaItemsYet')}</h3>
                <p className="text-gray-600 mb-4">{t('addFirstAgendaItemDescription')}</p>
                <button
                  type="button"
                  onClick={addAgendaItem}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t('createFirstAgendaItem')}
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={formData.agendaItems.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {formData.agendaItems.map((item, index) => (
                      <SortableAgendaItem
                        key={item.id}
                        agendaItem={item}
                        index={index}
                        onUpdate={updateAgendaItem}
                        onDelete={deleteAgendaItem}
                        labels={labels}
                        selectedSeries={selectedSeries}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Global Note */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('globalNotes')}</h2>
            <textarea
              id="globalNote"
              name="globalNote"
              value={formData.globalNote}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
              placeholder={t('globalNotesPlaceholder')}
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-4 pt-6 border-t">
            <button
              type="submit"
              disabled={loading || !formData.meetingSeries_id || !formData.date}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('creatingMinute')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('createMinute')}</span>
                </div>
              )}
            </button>

            <Link
              href="/minutes"
              className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              {t('cancel')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}