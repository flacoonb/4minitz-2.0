'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { withAdminAuth } from '@/contexts/AuthContext';
import {
  parseMinutesMarkdown,
  serializeTopicsToMarkdown,
  type MinutesMarkdownInfoItem,
  type MinutesMarkdownTopic,
} from '@/lib/minutesMarkdown';

interface TemplateRecord {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  content: {
    title?: string;
    time?: string;
    endTime?: string;
    location?: string;
    globalNote?: string;
    topics?: MinutesMarkdownTopic[];
  };
}

interface User {
  _id: string;
  username: string;
  firstName: string;
  lastName: string;
}

interface ClubFunctionEntry {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  token: string;
}

interface MentionCandidate {
  value: string;
  label: string;
}

function getTextareaCaretCoordinates(
  textarea: HTMLTextAreaElement,
  caretPosition: number
): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.font = style.font;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;

  const before = textarea.value.slice(0, caretPosition);
  const after = textarea.value.slice(caretPosition) || ' ';
  mirror.textContent = before;

  const marker = document.createElement('span');
  marker.textContent = after[0];
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;

  document.body.removeChild(mirror);
  return { top, left };
}

function AdminTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [globalNote, setGlobalNote] = useState('');
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');
  const [topics, setTopics] = useState<MinutesMarkdownTopic[]>([]);
  const [markdown, setMarkdown] = useState('## Traktandum\n- [i] Info');
  const [markdownWarnings, setMarkdownWarnings] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [clubFunctions, setClubFunctions] = useState<ClubFunctionEntry[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionCandidate[]>([]);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionCaretIndex, setMentionCaretIndex] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionMenuPosition, setMentionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const editingTemplate = useMemo(
    () => templates.find((template) => template._id === editingId) || null,
    [templates, editingId]
  );

  const loadTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/minutes-templates?scope=global&includeInactive=true', {
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Vorlagen konnten nicht geladen werden');
      setTemplates(result.data || []);
    } catch (err: any) {
      setError(err.message || 'Vorlagen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const loadClubFunctions = async () => {
      try {
        const response = await fetch('/api/club-functions?includeInactive=true', { credentials: 'include' });
        if (!response.ok) return;
        const result = await response.json();
        setClubFunctions(result.data || []);
      } catch {
        // optional
      }
    };
    loadClubFunctions();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch('/api/users?limit=1000', { credentials: 'include' });
        if (!response.ok) return;
        const result = await response.json();
        setAllUsers(result.data || []);
      } catch {
        // ignore users loading errors in template editor
      }
    };
    loadUsers();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setTitle('');
    setTime('');
    setEndTime('');
    setLocation('');
    setGlobalNote('');
    setTopics([]);
    setMarkdown('## Traktandum\n- [i] Info');
    setMarkdownWarnings([]);
    closeMentionSuggestions();
  };

  const startEdit = (template: TemplateRecord) => {
    setEditingId(template._id);
    setName(template.name || '');
    setDescription(template.description || '');
    setTitle(template.content?.title || '');
    setTime(template.content?.time || '');
    setEndTime(template.content?.endTime || '');
    setLocation(template.content?.location || '');
    setGlobalNote(template.content?.globalNote || '');
    const templateTopics = template.content?.topics || [];
    setTopics(templateTopics);
    setMarkdown(serializeTopicsToMarkdown(templateTopics));
    setMarkdownWarnings([]);
    closeMentionSuggestions();
    setShowEditorModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowEditorModal(true);
  };

  useEffect(() => {
    if (editorMode !== 'markdown') return;
    setMarkdown(serializeTopicsToMarkdown(topics));
  }, [editorMode, topics]);

  const mentionCandidates = useMemo(() => {
    const seen = new Set<string>();
    const result: MentionCandidate[] = [];
    clubFunctions.forEach((fn) => {
      const value = fn.token;
      if (!value || seen.has(value)) return;
      seen.add(value);
      result.push({
        value,
        label: `${fn.name} (@${value})${fn.isActive ? '' : ' [inaktiv]'}`,
      });
    });
    return result;
  }, [clubFunctions]);

  const responsibleOptions = useMemo(
    () =>
      clubFunctions.map((fn) => ({
        value: fn.token,
        label: `${fn.name} (${fn.token})${fn.isActive ? '' : ' [inaktiv]'}`,
        disabled: !fn.isActive,
      })),
    [clubFunctions]
  );

  const closeMentionSuggestions = () => {
    setMentionSuggestions([]);
    setMentionStartIndex(null);
    setMentionCaretIndex(null);
    setSelectedMentionIndex(0);
    setMentionMenuPosition(null);
  };

  const updateMentionSuggestions = (text: string, caretPos: number) => {
    const textarea = markdownTextareaRef.current;
    if (!textarea) {
      closeMentionSuggestions();
      return;
    }

    const before = text.slice(0, caretPos);
    const atIndex = before.lastIndexOf('@');
    if (atIndex === -1) {
      closeMentionSuggestions();
      return;
    }

    const prefix = before.slice(atIndex + 1);
    if (prefix.includes(' ') || prefix.includes('\n') || prefix.includes('\t')) {
      closeMentionSuggestions();
      return;
    }

    const query = prefix.trim().toLowerCase();
    const suggestions = mentionCandidates
      .filter((candidate) => {
        if (!query) return true;
        return (
          candidate.value.toLowerCase().includes(query) ||
          candidate.label.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);

    if (suggestions.length === 0) {
      closeMentionSuggestions();
      return;
    }

    setMentionSuggestions(suggestions);
    setMentionStartIndex(atIndex);
    setMentionCaretIndex(caretPos);
    setSelectedMentionIndex(0);
    const caret = getTextareaCaretCoordinates(textarea, caretPos);
    const dropdownTop = Math.max(8, caret.top + 24);
    const dropdownLeft = Math.max(8, Math.min(caret.left, textarea.clientWidth - 260));
    setMentionMenuPosition({ top: dropdownTop, left: dropdownLeft });
  };

  const applyMentionSuggestion = (candidate: MentionCandidate) => {
    if (mentionStartIndex === null || mentionCaretIndex === null) return;
    const before = markdown.slice(0, mentionStartIndex);
    const after = markdown.slice(mentionCaretIndex);
    const insertion = `@${candidate.value}`;
    const needsSpace = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
    const nextValue = `${before}${insertion}${needsSpace ? ' ' : ''}${after}`;
    const nextCursor = before.length + insertion.length + (needsSpace ? 1 : 0);

    setMarkdown(nextValue);
    closeMentionSuggestions();

    requestAnimationFrame(() => {
      if (!markdownTextareaRef.current) return;
      markdownTextareaRef.current.focus();
      markdownTextareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertMarkdownSnippet = (snippet: string) => {
    const textarea = markdownTextareaRef.current;
    const currentValue = markdown;
    const selectionStart = textarea?.selectionStart ?? currentValue.length;
    const selectionEnd = textarea?.selectionEnd ?? currentValue.length;
    const beforeRaw = currentValue.slice(0, selectionStart);
    const afterRaw = currentValue.slice(selectionEnd);
    const before = beforeRaw.length > 0 && !beforeRaw.endsWith('\n') ? `${beforeRaw}\n` : beforeRaw;
    const after = afterRaw.length > 0 && !afterRaw.startsWith('\n') ? `\n${afterRaw}` : afterRaw;
    const insertion = snippet.endsWith('\n') ? snippet : `${snippet}\n`;
    const newValue = `${before}${insertion}${after}`;
    const cursorPosition = before.length + insertion.length;
    setMarkdown(newValue);
    requestAnimationFrame(() => {
      if (!markdownTextareaRef.current) return;
      markdownTextareaRef.current.focus();
      markdownTextareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const buildInfoTemplate = () =>
    ['- [i] Informationstitel @userId', '  Details zur Information', '  information: Kontext oder Info'].join('\n');

  const buildTaskTemplate = (status: 'open' | 'in-progress' | 'done') => {
    const token = status === 'open' ? ' ' : status === 'in-progress' ? '~' : 'x';
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return [
      `- [${token}] Aufgabentitel !medium due:${dueDate} @userId`,
      '  Details zur Aufgabe',
      '  beschluss: Nächster Schritt / Kommentar',
    ].join('\n');
  };

  const addTopic = () => {
    setTopics((prev) => [...prev, { subject: '', responsibles: [], infoItems: [] }]);
  };

  const updateTopic = (topicIndex: number, field: keyof MinutesMarkdownTopic, value: any) => {
    setTopics((prev) =>
      prev.map((topic, index) => (index === topicIndex ? { ...topic, [field]: value } : topic))
    );
  };

  const removeTopic = (topicIndex: number) => {
    setTopics((prev) => prev.filter((_, index) => index !== topicIndex));
  };

  const addItem = (topicIndex: number, itemType: 'actionItem' | 'infoItem') => {
    setTopics((prev) =>
      prev.map((topic, index) => {
        if (index !== topicIndex) return topic;
        const newItem: MinutesMarkdownInfoItem = {
          subject: '',
          details: '',
          itemType,
          status: itemType === 'actionItem' ? 'open' : 'open',
          priority: 'medium',
          dueDate: '',
          responsibles: [],
          notes: '',
        };
        return { ...topic, infoItems: [...(topic.infoItems || []), newItem] };
      })
    );
  };

  const updateItem = (topicIndex: number, itemIndex: number, updates: Partial<MinutesMarkdownInfoItem>) => {
    setTopics((prev) =>
      prev.map((topic, tIndex) => {
        if (tIndex !== topicIndex) return topic;
        return {
          ...topic,
          infoItems: (topic.infoItems || []).map((item, iIndex) =>
            iIndex === itemIndex ? { ...item, ...updates } : item
          ),
        };
      })
    );
  };

  const removeItem = (topicIndex: number, itemIndex: number) => {
    setTopics((prev) =>
      prev.map((topic, tIndex) => {
        if (tIndex !== topicIndex) return topic;
        return { ...topic, infoItems: (topic.infoItems || []).filter((_, iIndex) => iIndex !== itemIndex) };
      })
    );
  };

  const saveTemplate = async () => {
    setSaving(true);
    setError('');
    try {
      const parsed = editorMode === 'markdown' ? parseMinutesMarkdown(markdown) : null;
      const topicsToSave = editorMode === 'markdown' ? (parsed?.topics || []) : topics;
      if (topicsToSave.length === 0) {
        throw new Error('Mindestens ein Traktandum mit Eintrag ist erforderlich.');
      }
      setMarkdownWarnings(parsed?.warnings || []);

      const payload = {
        name,
        description,
        scope: 'global',
        content: {
          title,
          time,
          endTime,
          location,
          globalNote,
          topics: topicsToSave,
        },
      };

      const url = editingId ? `/api/minutes-templates/${editingId}` : '/api/minutes-templates';
      const method = editingId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Vorlage konnte nicht gespeichert werden');

      resetForm();
      setShowEditorModal(false);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Vorlage konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (template: TemplateRecord) => {
    try {
      const response = await fetch(`/api/minutes-templates/${template._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Status konnte nicht geändert werden');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Status konnte nicht geändert werden');
    }
  };

  const removeTemplate = async (templateId: string) => {
    if (!window.confirm('Vorlage wirklich löschen?')) return;
    try {
      const response = await fetch(`/api/minutes-templates/${templateId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Vorlage konnte nicht gelöscht werden');
      if (editingId === templateId) resetForm();
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Vorlage konnte nicht gelöscht werden');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-6 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-2xl p-4 sm:p-6 border border-blue-100 dark:border-slate-700 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Globale Protokoll-Vorlagen
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1">
                Admins verwalten wiederverwendbare Vorlagen für alle Serien.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 min-h-[44px]"
            >
              Zurück zum Admin-Bereich
            </Link>
          </div>
        </div>

        {error && <div className="p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">{error}</div>}

        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Vorlagen</h2>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 min-h-[44px] shadow-md"
            >
              + Neue Vorlage
            </button>
          </div>
          {loading ? (
            <p className="text-gray-500 dark:text-slate-400">Lade Vorlagen...</p>
          ) : templates.length === 0 ? (
            <p className="text-gray-500 dark:text-slate-400">Noch keine Vorlagen vorhanden.</p>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template._id}
                  className="rounded-xl border border-gray-100 dark:border-slate-700 bg-gradient-to-r from-white to-gray-50 dark:from-slate-900 dark:to-slate-800 p-4 shadow-sm"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 break-words">{template.name}</p>
                      {template.description && <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{template.description}</p>}
                      <span
                        className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${
                          template.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {template.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => startEdit(template)}
                        className="px-3 py-2 min-h-[40px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-sm text-gray-800 dark:text-slate-200"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => toggleActive(template)}
                        className="px-3 py-2 min-h-[40px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-sm text-gray-800 dark:text-slate-200"
                      >
                        {template.isActive ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                      <button
                        onClick={() => removeTemplate(template._id)}
                        className="px-3 py-2 min-h-[40px] bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showEditorModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEditorModal(false);
                  closeMentionSuggestions();
                }}
                className="px-3 py-2 min-h-[40px] bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700"
              >
                Schliessen
              </button>
            </div>

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreibung (optional)" className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Standard-Titel (optional)" className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Startzeit (z. B. 09:00)" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl" />
              <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="Endzeit (z. B. 10:30)" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl" />
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ort (optional)" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl" />
            </div>
            <textarea value={globalNote} onChange={(e) => setGlobalNote(e.target.value)} placeholder="Globaler Hinweis (optional)" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl min-h-[80px]" />

            <div className="space-y-3">
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (editorMode === 'markdown') {
                      const parsed = parseMinutesMarkdown(markdown);
                      setTopics(parsed.topics);
                      setMarkdownWarnings(parsed.warnings);
                    }
                    setEditorMode('visual');
                    closeMentionSuggestions();
                  }}
                  className={`px-4 py-2 text-sm font-medium ${
                    editorMode === 'visual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Visuell
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('markdown')}
                  className={`px-4 py-2 text-sm font-medium ${
                    editorMode === 'markdown' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Markdown
                </button>
              </div>

              {editorMode === 'visual' ? (
                <div className="space-y-3">
                  <button type="button" onClick={addTopic} className="px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 min-h-[40px]">+ Traktandum</button>
                  {topics.map((topic, topicIndex) => (
                    <div key={`topic-${topicIndex}`} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/80">
                      <div className="flex gap-2">
                        <input value={topic.subject} onChange={(e) => updateTopic(topicIndex, 'subject', e.target.value)} placeholder="Traktandum" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
                        <button type="button" onClick={() => removeTopic(topicIndex)} className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg min-h-[40px]">Löschen</button>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => addItem(topicIndex, 'infoItem')} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded">+ Info</button>
                        <button type="button" onClick={() => addItem(topicIndex, 'actionItem')} className="px-3 py-1.5 text-xs bg-amber-100 text-amber-800 rounded">+ Aufgabe</button>
                      </div>
                      {(topic.infoItems || []).map((item, itemIndex) => (
                        <div key={`item-${itemIndex}`} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2 shadow-sm">
                          <div className="flex gap-2">
                            <select value={item.itemType} onChange={(e) => updateItem(topicIndex, itemIndex, { itemType: e.target.value as 'actionItem' | 'infoItem' })} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                              <option value="infoItem">Info</option>
                              <option value="actionItem">Aufgabe</option>
                            </select>
                            <input value={item.subject} onChange={(e) => updateItem(topicIndex, itemIndex, { subject: e.target.value })} placeholder="Betreff" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
                            <button type="button" onClick={() => removeItem(topicIndex, itemIndex)} className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded">Entfernen</button>
                          </div>
                          <textarea value={item.details || ''} onChange={(e) => updateItem(topicIndex, itemIndex, { details: e.target.value })} placeholder="Details" className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[70px]" />
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Verantwortliche (Mehrfachauswahl)</p>
                            <select
                              multiple
                              value={item.responsibles || []}
                              onChange={(e) =>
                                updateItem(topicIndex, itemIndex, {
                                  responsibles: Array.from(e.target.selectedOptions).map((option) => option.value),
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[110px]"
                            >
                              {responsibleOptions.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                  disabled={option.disabled && !(item.responsibles || []).includes(option.value)}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {item.itemType === 'actionItem' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <select value={item.status || 'open'} onChange={(e) => updateItem(topicIndex, itemIndex, { status: e.target.value as 'open' | 'in-progress' | 'completed' | 'cancelled' })} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="open">Offen</option>
                                <option value="in-progress">In Arbeit</option>
                                <option value="completed">Erledigt</option>
                                <option value="cancelled">Abgebrochen</option>
                              </select>
                              <select value={item.priority || 'medium'} onChange={(e) => updateItem(topicIndex, itemIndex, { priority: e.target.value as 'high' | 'medium' | 'low' })} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="high">Hoch</option>
                                <option value="medium">Mittel</option>
                                <option value="low">Tief</option>
                              </select>
                              <input type="date" value={item.dueDate || ''} onChange={(e) => updateItem(topicIndex, itemIndex, { dueDate: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            </div>
                          )}
                          <textarea value={item.notes || ''} onChange={(e) => updateItem(topicIndex, itemIndex, { notes: e.target.value })} placeholder={item.itemType === 'actionItem' ? 'Beschluss' : 'Information'} className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[60px]" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => insertMarkdownSnippet('## Neues Traktandum')} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Traktandum</button>
                    <button type="button" onClick={() => insertMarkdownSnippet(buildInfoTemplate())} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Info</button>
                    <button type="button" onClick={() => insertMarkdownSnippet(buildTaskTemplate('open'))} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Aufgabe offen</button>
                    <button type="button" onClick={() => insertMarkdownSnippet(buildTaskTemplate('in-progress'))} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Aufgabe in Arbeit</button>
                    <button type="button" onClick={() => insertMarkdownSnippet(buildTaskTemplate('done'))} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Aufgabe erledigt</button>
                    <button type="button" onClick={() => insertMarkdownSnippet('!high')} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Prio</button>
                    <button type="button" onClick={() => insertMarkdownSnippet('due:2026-03-20')} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Fällig</button>
                    <button type="button" onClick={() => insertMarkdownSnippet('@userId')} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Verantwortlich</button>
                    <button type="button" onClick={() => insertMarkdownSnippet('  beschluss: Kommentar')} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200">Beschluss/Info</button>
                  </div>
                  <div className="relative">
                    <textarea
                      ref={markdownTextareaRef}
                      value={markdown}
                      onChange={(e) => {
                        setMarkdown(e.target.value);
                        updateMentionSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
                      }}
                      onKeyUp={(e) => updateMentionSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                      onClick={(e) => updateMentionSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                      onScroll={() => {
                        if (mentionSuggestions.length === 0) return;
                        const caretPos = markdownTextareaRef.current?.selectionStart ?? markdown.length;
                        updateMentionSuggestions(markdown, caretPos);
                      }}
                      onKeyDown={(e) => {
                        if (mentionSuggestions.length === 0) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedMentionIndex((prev) => (prev + 1 >= mentionSuggestions.length ? 0 : prev + 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedMentionIndex((prev) => (prev - 1 < 0 ? mentionSuggestions.length - 1 : prev - 1));
                        } else if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault();
                          applyMentionSuggestion(mentionSuggestions[selectedMentionIndex]);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          closeMentionSuggestions();
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl min-h-[260px] font-mono text-sm"
                    />
                    {mentionSuggestions.length > 0 && mentionMenuPosition && (
                      <div className="absolute z-30 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-auto w-64" style={{ top: mentionMenuPosition.top, left: mentionMenuPosition.left }}>
                        {mentionSuggestions.map((candidate, index) => (
                          <button
                            key={`${candidate.value}-${index}`}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${index === selectedMentionIndex ? 'bg-blue-100' : ''}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              applyMentionSuggestion(candidate);
                            }}
                          >
                            {candidate.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {markdownWarnings.length > 0 && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                      {markdownWarnings.slice(0, 5).map((warning, index) => (
                        <p key={index}>- {warning}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveTemplate}
                disabled={saving || !name.trim()}
                className="px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
              >
                {saving ? 'Speichern...' : editingTemplate ? 'Änderungen speichern' : 'Vorlage erstellen'}
              </button>
              <button
                onClick={() => {
                  setShowEditorModal(false);
                  closeMentionSuggestions();
                }}
                className="px-4 py-2.5 min-h-[44px] bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default withAdminAuth(AdminTemplatesPage);
