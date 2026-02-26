"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';

interface MeetingSeries {
  _id: string;
  project: string;
  name: string;
  description?: string;
  moderators: string[];
  participants: string[];
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

export default function MeetingSeriesPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const { user, loading: _authLoading, hasPermission } = useAuth();
  const t = useTranslations('meetingSeries');
  const tCommon = useTranslations('common');
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

  // Check permissions
  const isModerator = series?.moderators?.includes(user?.username || '') || false;
  const canEditSeries = hasPermission('canModerateAllMeetings') || isModerator;
  const canDeleteSeries = hasPermission('canModerateAllMeetings') || isModerator; // Using moderate permission for delete as well
  const canCreateMinute = hasPermission('canModerateAllMeetings') || isModerator;

  // useEffect(() => {
  //   if (!seriesId) return;
  //   // Don't wait for auth, allow immediate loading with fallback user
  //   fetchData();
  // }, [seriesId, user?._id]); // Re-fetch when user changes

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use cookie/JWT-based authentication; include credentials so server can
      // authenticate the request. Server will enforce visibility rules.
      const [sRes, mRes] = await Promise.all([
        fetch(`/api/meeting-series/${seriesId}`, { credentials: 'include' }),
        fetch(`/api/minutes?meetingSeriesId=${seriesId}`, { credentials: 'include' }),
      ]);

      if (!sRes.ok) throw new Error('Failed to load series');
      if (!mRes.ok) throw new Error('Failed to load minutes');

      const sJson = await sRes.json();
      const mJson = await mRes.json();

      setSeries(sJson.data || null);
      const minutesData = mJson.data || [];
      setMinutes(minutesData);
      
      // Check if there's a draft
      const draftExists = minutesData.some((m: Minute) => !m.isFinalized && !m.finalized);
      setHasDraft(draftExists);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    if (!seriesId) return;
    // Don't wait for auth, allow immediate loading with fallback user
    fetchData();
  }, [seriesId, user?._id, fetchData]);

  const createNewProtocol = async () => {
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
          isFinalized: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Erstellen des Protokolls');
      }

      const result = await response.json();
      
      // Redirect to edit page
      router.push(`/minutes/${result.data._id}/edit`);
    } catch (err) {
      console.error('Error creating protocol:', err);
      alert('Fehler beim Erstellen des Protokolls: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler'));
    } finally {
      setCreating(false);
    }
  };

  const deleteSeries = async () => {
    if (!series) return;
    
    const confirmMessage = minutes.length > 0
      ? `Diese Sitzungsserie hat ${minutes.length} Protokoll(e). Möchten Sie die Serie wirklich löschen? Alle Protokolle bleiben erhalten.`
      : 'Möchten Sie diese Sitzungsserie wirklich löschen?';
    
    if (!confirm(confirmMessage)) return;
    
    try {
      const response = await fetch(`/api/meeting-series/${series._id}`, {
        method: 'DELETE',
        credentials: 'include', // Use cookies for authentication
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Löschen der Sitzungsserie');
      }

      // Redirect to meeting series list
      router.push('/meeting-series');
    } catch (err) {
      console.error('Error deleting series:', err);
      alert('Fehler beim Löschen: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler'));
    }
  };

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
        setImportResult(`${result.imported} Aufgabe(n) erfolgreich übernommen`);
        setImportTasks([]);
        setSelectedTaskIds(new Set());
      } else {
        const err = await res.json();
        setImportResult(`Fehler: ${err.error || 'Import fehlgeschlagen'}`);
      }
    } catch {
      setImportResult('Fehler beim Import');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
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
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/meeting-series"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium mb-6 hover:scale-105 transition-all"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('backToSeries')}
        </Link>

        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  {series.project}{series.name ? ` – ${series.name}` : ''}
                </h1>
                {series.description && (
                  <p className="mt-3 text-gray-700 max-w-2xl leading-relaxed">
                    {series.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              {canEditSeries && (
                <button
                  onClick={openImportModal}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Aufgaben importieren
                </button>
              )}
              {canEditSeries && (
                <Link
                  href={`/meeting-series/${series._id}/edit`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {tCommon('edit')}
                </Link>
              )}
              {canDeleteSeries && (
                <button
                  onClick={deleteSeries}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
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

      {/* Protokolle Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t('minutesCount', {count: minutes.length})}</h2>
        </div>

        {minutes.length === 0 ? (
          <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl text-center">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {minute.title ? (
                          <span>{minute.title} <span className="text-gray-500 font-normal text-sm">({new Date(minute.date).toLocaleDateString('de-DE')})</span></span>
                        ) : (
                          `${series.project}${series.name ? ` – ${series.name}` : ''} – ${new Date(minute.date).toLocaleDateString('de-DE')}`
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {minute.topics?.length ? t('topicsCount', {count: minute.topics.length}) : t('noTopics')} • 
                        {minute.isFinalized || minute.finalized ? t('finalized') : t('draft')}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    minute.isFinalized || minute.finalized 
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
              onClick={createNewProtocol}
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Aufgaben importieren</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Dialog schliessen"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Offene Aufgaben aus einer anderen Sitzungsreihe übernehmen
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Source Series Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quell-Sitzungsreihe
                </label>
                <select
                  value={importSourceId}
                  onChange={(e) => loadSourceTasks(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">– Sitzungsreihe wählen –</option>
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}

              {/* Task List */}
              {importSourceId && !loadingImportTasks && importTasks.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  Keine offenen Aufgaben in dieser Serie
                </div>
              )}

              {importTasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      {selectedTaskIds.size} von {importTasks.length} ausgewählt
                    </span>
                    <button
                      onClick={toggleAllTasks}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {selectedTaskIds.size === importTasks.length ? 'Alle abwählen' : 'Alle auswählen'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {importTasks.map(task => (
                      <label
                        key={task._id}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedTaskIds.has(task._id)
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task._id)}
                          onChange={() => toggleTask(task._id)}
                          className="mt-1 h-4 w-4 text-blue-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{task.subject}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {task.status === 'in-progress' ? 'In Arbeit' : 'Offen'}
                            </span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {task.priority === 'high' ? 'Hoch' : task.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                            </span>
                            {task.dueDate && (
                              <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
                                Fällig: {new Date(task.dueDate).toLocaleDateString('de-DE')}
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
                <div className={`p-3 rounded-lg text-sm ${
                  importResult.startsWith('Fehler') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
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
                Schliessen
              </button>
              {importTasks.length > 0 && selectedTaskIds.size > 0 && (
                <button
                  onClick={executeImport}
                  disabled={importing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importiere...
                    </>
                  ) : (
                    `${selectedTaskIds.size} Aufgabe(n) importieren`
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
