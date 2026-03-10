'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Image as ImageIcon, Download, Trash2, File } from 'lucide-react';
import ConfirmationModal from '@/components/ConfirmationModal';

interface Attachment {
  _id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

interface AttachmentListProps {
  minuteId: string;
  onDelete?: () => void;
}

export default function AttachmentList({ minuteId, onDelete }: AttachmentListProps) {
  const t = useTranslations('attachments');
  const tCommon = useTranslations('common');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/attachments?minuteId=${minuteId}`);
      const data = await response.json();
      setAttachments(data.data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setLoading(false);
    }
  }, [minuteId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

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
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="text-center py-8 app-text-muted">
        <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{t('noAttachments')}</p>
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
            <button
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
          </div>
        </div>
      ))}

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
    </div>
  );
}
