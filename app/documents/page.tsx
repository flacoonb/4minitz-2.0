"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Download, File, FileText, Image as ImageIcon, Search, Trash2, Pencil } from 'lucide-react';
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
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (mimeType === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort((a, b) => {
        const aTime = new Date(a.uploadedAt).getTime();
        const bTime = new Date(b.uploadedAt).getTime();
        return bTime - aTime;
      }),
    [documents]
  );

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
      // noop - backend already enforces permissions
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          id: renameTarget._id,
          name: nextName,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || tAttachments('renameError'));
      }

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen brand-page-gradient py-6 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--brand-text)' }}>
            {t('title')}
          </h1>
          <p className="mt-1 app-text-muted">{t('subtitle')}</p>
        </div>

        <div className="app-card rounded-xl p-4 shadow-sm">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 app-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 min-h-11 border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              style={{ borderColor: 'var(--brand-card-border)', backgroundColor: 'var(--brand-card)', color: 'var(--brand-text)' }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--brand-primary)]"></div>
          </div>
        ) : sortedDocuments.length === 0 ? (
          <div className="app-card rounded-xl p-12 text-center shadow-sm">
            <File className="w-10 h-10 mx-auto mb-3 app-text-muted" />
            <p className="font-medium" style={{ color: 'var(--brand-text)' }}>{t('empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedDocuments.map((entry) => (
              <div key={entry._id} className="app-card rounded-xl p-4 border border-[var(--brand-card-border)] shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 app-text-muted">{getFileIcon(entry.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--brand-text)' }}>{entry.originalName}</p>
                    <p className="text-sm app-text-muted mt-0.5">
                      {formatFileSize(entry.size)} • {new Date(entry.uploadedAt).toLocaleDateString(locale)}
                    </p>
                    <div className="text-sm mt-1.5 space-y-1">
                      {entry.minuteTitleSnapshot ? (
                        <p className="app-text-muted">
                          {t('minute')}: <span style={{ color: 'var(--brand-text)' }}>{entry.minuteTitleSnapshot}</span>
                        </p>
                      ) : null}
                      {entry.topicSubjectSnapshot ? (
                        <p className="app-text-muted">
                          {t('topic')}: <span style={{ color: 'var(--brand-text)' }}>{entry.topicSubjectSnapshot}</span>
                        </p>
                      ) : null}
                      {entry.infoItemSubjectSnapshot ? (
                        <p className="app-text-muted">
                          {t('item')}: <span style={{ color: 'var(--brand-text)' }}>{entry.infoItemSubjectSnapshot}</span>
                        </p>
                      ) : null}
                      {entry.tags && entry.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {entry.tags.map((tag) => (
                            <span
                              key={`${entry._id}-${tag}`}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {entry.minuteId ? (
                      <Link href={`/minutes/${entry.minuteId}`} className="inline-flex mt-2 text-sm text-[var(--brand-primary)] hover:underline">
                        {t('openMinute')}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={entry.url}
                      download={entry.originalName}
                      className="p-2 rounded-lg text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]"
                      title={t('download')}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {(hasPermission('canDeleteAllDocuments') ||
                      entry.uploadedBy === user._id ||
                      entry.uploadedBy === user.username) && (
                      <button
                        onClick={() => {
                          setRenameError(null);
                          setRenameTarget(entry);
                        }}
                        disabled={Boolean(renamingId)}
                        className="p-2 rounded-lg text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] disabled:opacity-50"
                        title={tAttachments('rename')}
                      >
                        {renamingId === entry._id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--brand-primary)]"></div>
                        ) : (
                          <Pencil className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {(hasPermission('canDeleteAllDocuments') ||
                      entry.uploadedBy === user._id ||
                      entry.uploadedBy === user.username) && (
                      <button
                        onClick={() => handleDelete(entry._id)}
                        disabled={deletingId === entry._id}
                        className="p-2 rounded-lg text-[var(--brand-danger)] hover:bg-[var(--brand-danger-soft)] disabled:opacity-50"
                        title={tCommon('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
