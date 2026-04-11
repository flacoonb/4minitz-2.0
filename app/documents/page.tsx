"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileText,
  Filter,
  Image as ImageIcon,
  Search,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AttachmentRenameModal from '@/components/AttachmentRenameModal';

interface AttachmentEntry {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  minuteId?: string;
  topicId?: string;
  minuteTitleSnapshot?: string;
  topicSubjectSnapshot?: string;
  infoItemSubjectSnapshot?: string;
  meetingSeriesNameSnapshot?: string;
  tags?: string[];
  url: string;
}

interface SeriesGroup {
  name: string;
  documents: AttachmentEntry[];
}

type FileTypeFilter = 'all' | 'pdf' | 'image' | 'office' | 'other';

const FILE_TYPE_FILTERS: FileTypeFilter[] = ['all', 'pdf', 'image', 'office', 'other'];

function matchesTypeFilter(mime: string, filter: FileTypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pdf') return mime === 'application/pdf';
  if (filter === 'image') return mime.startsWith('image/');
  if (filter === 'office')
    return (
      mime.includes('word') ||
      mime.includes('excel') ||
      mime.includes('spreadsheet') ||
      mime === 'text/plain'
    );
  return (
    !mime.startsWith('image/') &&
    mime !== 'application/pdf' &&
    !mime.includes('word') &&
    !mime.includes('excel') &&
    !mime.includes('spreadsheet') &&
    mime !== 'text/plain'
  );
}

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const tAttachments = useTranslations('attachments');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState<AttachmentEntry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<AttachmentEntry | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');
  const [collapsedSeries, setCollapsedSeries] = useState<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '500');
      const response = await fetch(`/api/attachments?${params.toString()}`, { credentials: 'include' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t('loadError'));
      setDocuments(Array.isArray(payload?.data) ? payload.data : []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [user, search, t]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const formatFileSize = (bytes: number): string => {
    if (!Number.isFinite(bytes)) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (mimeType === 'application/pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const filteredDocuments = useMemo(
    () => documents.filter((d) => matchesTypeFilter(d.mimeType, typeFilter)),
    [documents, typeFilter]
  );

  const grouped: SeriesGroup[] = useMemo(() => {
    const sorted = [...filteredDocuments].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    const map = new Map<string, AttachmentEntry[]>();
    for (const doc of sorted) {
      const key = doc.meetingSeriesNameSnapshot || t('noSeries');
      const list = map.get(key);
      if (list) {
        list.push(doc);
      } else {
        map.set(key, [doc]);
      }
    }

    return Array.from(map.entries()).map(([name, docs]) => ({ name, documents: docs }));
  }, [filteredDocuments, t]);

  const toggleSeries = (name: string) => {
    setCollapsedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const buildContext = (entry: AttachmentEntry): string => {
    const parts: string[] = [];
    if (entry.minuteTitleSnapshot) parts.push(entry.minuteTitleSnapshot);
    if (entry.topicSubjectSnapshot) parts.push(entry.topicSubjectSnapshot);
    if (entry.infoItemSubjectSnapshot) parts.push(entry.infoItemSubjectSnapshot);
    return parts.join(' › ');
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      const response = await fetch(`/api/attachments?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('delete failed');
      setDocuments((prev) => prev.filter((entry) => entry._id !== id));
    } catch {
      // backend enforces permissions
    } finally {
      setDeletingId(null);
    }
  };

  const handleRename = async (nextName: string) => {
    if (!renameTarget) return;
    try {
      setRenamingId(renameTarget._id);
      setRenameError(null);
      const response = await fetch('/api/attachments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: renameTarget._id, name: nextName }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || tAttachments('renameError'));

      const updatedName = String(payload?.data?.originalName || nextName);
      setDocuments((prev) =>
        prev.map((doc) =>
          doc._id === renameTarget._id ? { ...doc, originalName: updatedName } : doc
        )
      );
      setRenameTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : tAttachments('renameError');
      setRenameError(message);
    } finally {
      setRenamingId(null);
    }
  };

  const canModify = (entry: AttachmentEntry) =>
    hasPermission('canDeleteAllDocuments') ||
    entry.uploadedBy === user?._id ||
    entry.uploadedBy === user?.username;

  if (!user) return null;

  return (
    <div className="min-h-screen brand-page-gradient py-2 sm:py-3 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--brand-text)' }}>
              {t('title')}
            </h1>
            <p className="mt-0.5 text-sm app-text-muted">{t('subtitle')}</p>
          </div>
          {!loading && (
            <span className="text-sm font-medium app-text-muted whitespace-nowrap">
              {t('count', { count: filteredDocuments.length })}
            </span>
          )}
        </div>

        {/* Search + Filter bar */}
        <div className="app-card rounded-xl p-3 shadow-sm space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 app-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 min-h-11 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent text-sm"
              style={{
                borderColor: 'var(--brand-card-border)',
                backgroundColor: 'var(--brand-card)',
                color: 'var(--brand-text)',
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 app-text-muted" />
            {FILE_TYPE_FILTERS.map((ft) => (
              <button
                key={ft}
                onClick={() => setTypeFilter(ft)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === ft
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-[var(--brand-surface-soft)] hover:bg-[var(--brand-primary-soft)]'
                }`}
                style={typeFilter !== ft ? { color: 'var(--brand-text)' } : undefined}
              >
                {t(`filterType.${ft}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--brand-primary)]" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="app-card rounded-xl p-12 text-center shadow-sm">
            <File className="w-10 h-10 mx-auto mb-3 app-text-muted" />
            <p className="font-medium" style={{ color: 'var(--brand-text)' }}>
              {t('empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => {
              const isCollapsed = collapsedSeries.has(group.name);
              return (
                <div
                  key={group.name}
                  className="app-card rounded-xl border border-[var(--brand-card-border)] shadow-sm overflow-hidden"
                >
                  {/* Series header */}
                  <button
                    onClick={() => toggleSeries(group.name)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:brightness-95 transition-colors"
                    style={{ backgroundColor: 'var(--brand-surface-soft)' }}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 flex-shrink-0 app-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 flex-shrink-0 app-text-muted" />
                    )}
                    <span
                      className="font-semibold text-sm truncate"
                      style={{ color: 'var(--brand-text)' }}
                    >
                      {group.name}
                    </span>
                    <span className="ml-auto text-xs app-text-muted flex-shrink-0">
                      {group.documents.length}
                    </span>
                  </button>

                  {/* Document rows */}
                  {!isCollapsed && (
                    <div>
                      {group.documents.map((entry, idx) => {
                        const context = buildContext(entry);
                        return (
                          <div
                            key={entry._id}
                            className={`flex items-center gap-3 px-4 py-2 hover:brightness-[0.97] transition-colors group${idx > 0 ? ' border-t' : ''}`}
                            style={idx > 0 ? { borderColor: 'var(--brand-card-border)' } : undefined}
                          >
                            {/* Icon */}
                            <div className="flex-shrink-0 app-text-muted">
                              {getFileIcon(entry.mimeType)}
                            </div>

                            {/* Name + context */}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium truncate"
                                style={{ color: 'var(--brand-text)' }}
                              >
                                {entry.originalName}
                              </p>
                              {context && (
                                <p className="text-xs app-text-muted truncate">
                                  {entry.minuteId ? (
                                    <Link
                                      href={`/minutes/${entry.minuteId}`}
                                      className="hover:underline text-[var(--brand-primary)]"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {context}
                                    </Link>
                                  ) : (
                                    context
                                  )}
                                </p>
                              )}
                            </div>

                            {/* Size + Date */}
                            <div className="hidden sm:flex flex-col items-end flex-shrink-0 gap-0">
                              <span className="text-xs app-text-muted">
                                {formatFileSize(entry.size)}
                              </span>
                              <span className="text-xs app-text-muted">
                                {new Date(entry.uploadedAt).toLocaleDateString(locale)}
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                              <a
                                href={entry.url}
                                download={entry.originalName}
                                className="p-1.5 rounded-md text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]"
                                title={t('download')}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              {canModify(entry) && (
                                <>
                                  <button
                                    onClick={() => {
                                      setRenameError(null);
                                      setRenameTarget(entry);
                                    }}
                                    disabled={Boolean(renamingId)}
                                    className="p-1.5 rounded-md text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] disabled:opacity-50"
                                    title={tAttachments('rename')}
                                  >
                                    {renamingId === entry._id ? (
                                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[var(--brand-primary)]" />
                                    ) : (
                                      <Pencil className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(entry._id)}
                                    disabled={deletingId === entry._id}
                                    className="p-1.5 rounded-md text-[var(--brand-danger)] hover:bg-[var(--brand-danger-soft)] disabled:opacity-50"
                                    title={tCommon('delete')}
                                  >
                                    {deletingId === entry._id ? (
                                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[var(--brand-danger)]" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {renameTarget ? (
          <AttachmentRenameModal
            isOpen
            currentName={renameTarget.originalName || ''}
            isProcessing={Boolean(renamingId)}
            errorMessage={renameError}
            onClose={() => {
              if (renamingId) return;
              setRenameError(null);
              setRenameTarget(null);
            }}
            onConfirm={handleRename}
          />
        ) : null}
      </div>
    </div>
  );
}
