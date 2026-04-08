'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PencilLine, X } from 'lucide-react';

interface AttachmentRenameModalProps {
  isOpen: boolean;
  currentName: string;
  isProcessing?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: (nextName: string) => void;
}

function getFileExtension(fileName: string): string {
  const trimmed = String(fileName || '').trim();
  const dotIndex = trimmed.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(dotIndex).toLowerCase();
}

export default function AttachmentRenameModal({
  isOpen,
  currentName,
  isProcessing = false,
  errorMessage = null,
  onClose,
  onConfirm,
}: AttachmentRenameModalProps) {
  const t = useTranslations('attachments');
  const tCommon = useTranslations('common');
  const trimmedCurrentName = useMemo(() => String(currentName || '').trim(), [currentName]);
  const [nextName, setNextName] = useState(trimmedCurrentName);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedNextName = useMemo(() => nextName.trim(), [nextName]);
  const fileExtension = useMemo(() => getFileExtension(trimmedCurrentName), [trimmedCurrentName]);
  const isUnchanged = trimmedNextName === trimmedCurrentName;
  const isInvalid = trimmedNextName.length === 0;

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.select();
    }, 30);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isProcessing) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const submit = () => {
    const sanitized = trimmedNextName;
    if (!sanitized) {
      setLocalError(t('renameRequired'));
      return;
    }
    if (sanitized === trimmedCurrentName) {
      onClose();
      return;
    }
    setLocalError(null);
    onConfirm(sanitized);
  };

  const confirmDisabled = isProcessing || isInvalid || isUnchanged;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[1px] animate-in fade-in duration-200">
      <div
        className="rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all scale-100 opacity-100 border border-[var(--brand-card-border)]"
        style={{
          backgroundColor: 'var(--brand-card)',
          backdropFilter: 'none',
        }}
      >
        <div className="px-5 py-4 border-b border-[var(--brand-card-border)] flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] flex items-center justify-center flex-shrink-0">
              <PencilLine className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'var(--brand-text)' }}>
                {t('renameModalTitle')}
              </h3>
              <p className="text-xs sm:text-sm app-text-muted">{t('renameModalDescription')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-lg app-text-muted hover:bg-[var(--brand-surface-soft)] disabled:opacity-50"
            aria-label={tCommon('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="attachment-rename-input" className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>
              {t('renameModalLabel')}
            </label>
            <input
              ref={inputRef}
              id="attachment-rename-input"
              type="text"
              value={nextName}
              maxLength={180}
              onChange={(event) => {
                setNextName(event.target.value);
                if (localError) {
                  setLocalError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
              disabled={isProcessing}
              placeholder={t('renameModalPlaceholder')}
              className="w-full min-h-11 px-3 py-2 rounded-lg border focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              style={{
                borderColor: 'var(--brand-card-border)',
                backgroundColor: 'var(--brand-card)',
                color: 'var(--brand-text)',
              }}
            />
          </div>

          {fileExtension ? (
            <p className="text-xs app-text-muted">
              {t('renameKeepExtensionWithExt', { extension: fileExtension })}
            </p>
          ) : (
            <p className="text-xs app-text-muted">
              {t('renameKeepExtension')}
            </p>
          )}

          {localError ? (
            <p className="text-sm text-[var(--brand-danger)]">{localError}</p>
          ) : null}
          {!localError && errorMessage ? (
            <p className="text-sm text-[var(--brand-danger)]">{errorMessage}</p>
          ) : null}
          {isUnchanged && !localError && !errorMessage ? (
            <p className="text-xs app-text-muted">{t('renameUnchangedHint')}</p>
          ) : null}

          <div className="pt-1 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="min-h-11 px-4 py-2 rounded-lg border font-medium hover:brightness-95 disabled:opacity-50"
              style={{
                color: 'var(--brand-text)',
                backgroundColor: 'var(--brand-card)',
                borderColor: 'var(--brand-card-border)',
              }}
            >
              {t('renameModalCancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={confirmDisabled}
              className="min-h-11 px-4 py-2 rounded-lg text-white font-medium bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-strong)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              ) : null}
              {t('renameModalSave')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
