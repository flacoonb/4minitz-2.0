'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X } from 'lucide-react';

interface AttachmentUploadProps {
  minuteId: string;
  topicId?: string;
  infoItemId?: string;
  onUploadComplete?: () => void;
}

const FALLBACK_ALLOWED_FILE_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
const FALLBACK_MAX_FILE_SIZE_MB = 10;

export default function AttachmentUpload({ 
  minuteId, 
  topicId, 
  infoItemId,
  onUploadComplete 
}: AttachmentUploadProps) {
  const t = useTranslations('attachments');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(FALLBACK_ALLOWED_FILE_TYPES);
  const [maxFileSizeMB, setMaxFileSizeMB] = useState<number>(FALLBACK_MAX_FILE_SIZE_MB);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadUploadSettings = async () => {
      try {
        const response = await fetch('/api/settings/public', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) return;

        const payload = await response.json().catch(() => ({}));
        const rawTypes: unknown[] = Array.isArray(payload?.data?.system?.allowedFileTypes)
          ? payload.data.system.allowedFileTypes
          : [];
        const sanitizedTypes: string[] = Array.from(
          new Set(
            rawTypes
              .map((entry): string => String(entry || '').trim().toLowerCase().replace(/^\./, ''))
              .filter((entry): entry is string => /^[a-z0-9]{1,10}$/.test(entry))
          )
        );

        const rawMaxSize = Number(payload?.data?.system?.maxFileUploadSize);
        const sanitizedMaxSize = Number.isFinite(rawMaxSize)
          ? Math.min(Math.max(Math.round(rawMaxSize), 1), 200)
          : FALLBACK_MAX_FILE_SIZE_MB;

        if (!cancelled) {
          if (sanitizedTypes.length > 0) {
            setAllowedFileTypes(sanitizedTypes);
          }
          setMaxFileSizeMB(sanitizedMaxSize);
        }
      } catch {
        // Keep fallback values when settings cannot be loaded.
      }
    };

    void loadUploadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const acceptValue = useMemo(() => {
    if (allowedFileTypes.length === 0) {
      return 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';
    }
    return allowedFileTypes.map((extension) => `.${extension}`).join(',');
  }, [allowedFileTypes]);

  const allowedTypesLabel = useMemo(() => {
    if (allowedFileTypes.length === 0) return null;
    return allowedFileTypes.map((extension) => extension.toUpperCase()).join(', ');
  }, [allowedFileTypes]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('minuteId', minuteId);
      if (topicId) formData.append('topicId', topicId);
      if (infoItemId) formData.append('infoItemId', infoItemId);

      const response = await fetch('/api/attachments', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Callback
      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg px-3 py-2 min-h-[74px] transition-colors ${
          dragActive 
            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]' 
            : 'border-[var(--brand-card-border)] hover:border-[var(--brand-primary-border)]'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
          accept={acceptValue}
        />

        <div className="flex flex-col justify-center gap-1 text-center h-full">
          <div className="flex items-center justify-center gap-2">
            <Upload className={`w-4 h-4 ${uploading ? 'text-[var(--brand-text-muted)]' : 'text-[var(--brand-text)]'}`} />

            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--brand-primary)]"></div>
                <p className="text-xs app-text-muted">{t('uploading')}</p>
              </div>
            ) : (
              <div className="leading-snug">
                <button
                  type="button"
                  onClick={onButtonClick}
                  disabled={uploading}
                  className="text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] font-medium text-sm"
                >
                  {t('clickToUpload')}
                </button>
                <span className="text-sm app-text-muted"> {t('orDragAndDrop')}</span>
              </div>
            )}
          </div>

          {!uploading ? (
            <p className="text-[11px] app-text-muted leading-tight">
              {allowedTypesLabel
                ? `${allowedTypesLabel} • max. ${maxFileSizeMB}MB`
                : t('allowedTypes')}
            </p>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="mt-2 p-2.5 bg-[var(--brand-danger-soft)] border border-[var(--brand-danger-border)] rounded-lg flex items-start gap-2">
          <X className="w-4 h-4 text-[var(--brand-danger)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--brand-danger)]">{error}</p>
        </div>
      )}
    </div>
  );
}
