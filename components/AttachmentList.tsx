'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Image as ImageIcon, Download, Trash2, File, Pencil } from 'lucide-react';
import ConfirmationModal from '@/components/ConfirmationModal';
import AttachmentRenameModal from '@/components/AttachmentRenameModal';

interface Attachment {
  _id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
  tags?: string[];
  minuteTitleSnapshot?: string;
  topicSubjectSnapshot?: string;
  meetingSeriesNameSnapshot?: string;
}

interface AttachmentListProps {
  minuteId: string;
  topicId?: string;
  infoItemId?: string;
  limit?: number;
  onDelete?: () => void;
  refreshKey?: string | number;
  hideWhenEmpty?: boolean;
  linksOnly?: boolean;
  showActions?: boolean;
}

export default function AttachmentList({
  minuteId,
  topicId,
  infoItemId,
  limit,
  onDelete,
  refreshKey,
  hideWhenEmpty = false,
  linksOnly = false,
  showActions = true,
}: AttachmentListProps) {
  const t = useTranslations('attachments');
  const tCommon = useTranslations('common');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Attachment | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ minuteId });
      if (topicId) params.set('topicId', topicId);
      if (infoItemId) params.set('infoItemId', infoItemId);
      if (limit) params.set('limit', String(limit));
      const response = await fetch(`/api/attachments?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Failed to fetch attachments (${response.status})`);
      }
      const data = await response.json();
      setAttachments(data.data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [minuteId, topicId, infoItemId, limit]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments, refreshKey]);

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      const response = await fetch(`/api/attachments?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setAttachments(attachments.filter(a => a._id !== id));
      onDelete?.();
    } catch (_error) {
      alert(t('deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async (nextName: string) => {
    if (!renameTarget) return;
    try {
      setRenaming(renameTarget._id);
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
        throw new Error(payload?.error || t('renameError'));
      }

      const updatedName = String(payload?.data?.originalName || nextName);
      setAttachments((prev) =>
        prev.map((entry) =>
          entry._id === renameTarget._id
            ? { ...entry, originalName: updatedName }
            : entry
        )
      );
      setRenameTarget(null);
      onDelete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('renameError');
      setRenameError(message);
    } finally {
      setRenaming(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  if (loading) {
    if (hideWhenEmpty) return null;
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (attachments.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className="text-center py-8 app-text-muted">
        <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{t('noAttachments')}</p>
      </div>
    );
  }

  if (linksOnly) {
    return (
      <div className="mt-3 space-y-1.5">
        {attachments.map((attachment) => (
          <a
            key={attachment._id}
            href={attachment.url}
            download={attachment.originalName}
            className="block text-sm font-medium hover:underline break-all"
            style={{ color: 'var(--brand-primary)' }}
          >
            {attachment.originalName}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment._id}
          className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:brightness-95"
          style={{ backgroundColor: 'var(--brand-surface-soft)' }}
        >
          <div className="flex-shrink-0 app-text-muted">
            {getFileIcon(attachment.mimeType)}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--brand-text)' }}>
              {attachment.originalName}
            </p>
            <p className="text-xs app-text-muted">
              {formatFileSize(attachment.size)} • {new Date(attachment.uploadedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={attachment.url}
              download={attachment.originalName}
              className="p-2 text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] rounded-lg transition-colors"
              title={t('download')}
            >
              <Download className="w-4 h-4" />
            </a>
            {showActions ? (
              <button
                type="button"
                onClick={() => {
                  setRenameError(null);
                  setRenameTarget(attachment);
                }}
                disabled={Boolean(renaming)}
                className="p-2 text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] rounded-lg transition-colors disabled:opacity-50"
                title={t('rename')}
              >
                {renaming === attachment._id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--brand-primary)]"></div>
                ) : (
                  <Pencil className="w-4 h-4" />
                )}
              </button>
            ) : null}
            {showActions ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(attachment._id)}
                disabled={deleting === attachment._id}
                className="p-2 text-[var(--brand-danger)] hover:bg-[var(--brand-danger-soft)] rounded-lg transition-colors disabled:opacity-50"
                title={t('delete')}
              >
                {deleting === attachment._id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--brand-danger)]"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {showActions ? (
        <ConfirmationModal
          isOpen={Boolean(confirmDeleteId)}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            if (confirmDeleteId) {
              handleDelete(confirmDeleteId);
            }
            setConfirmDeleteId(null);
          }}
          title={t('delete')}
          message={t('confirmDelete')}
          confirmText={t('delete')}
          cancelText={tCommon('cancel')}
          isProcessing={Boolean(deleting)}
          type="danger"
        />
      ) : null}

      {showActions && renameTarget ? (
        <AttachmentRenameModal
          isOpen
          currentName={renameTarget.originalName || ''}
          isProcessing={Boolean(renaming)}
          errorMessage={renameError}
          onClose={() => {
            if (renaming) return;
            setRenameError(null);
            setRenameTarget(null);
          }}
          onConfirm={handleRename}
        />
      ) : null}
    </div>
  );
}
