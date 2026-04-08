import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isProcessing?: boolean;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isProcessing = false,
  type = 'info'
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const colors = {
    danger: {
      icon: 'text-[var(--brand-danger)] bg-[var(--brand-danger-soft)]',
      button: 'bg-[var(--brand-danger)] hover:brightness-95 focus:ring-[var(--brand-danger)]'
    },
    warning: {
      icon: 'text-[var(--brand-warning)] bg-[var(--brand-warning-soft)]',
      button: 'bg-[var(--brand-warning)] hover:brightness-95 focus:ring-[var(--brand-warning)]'
    },
    info: {
      icon: 'text-[var(--brand-primary)] bg-[var(--brand-primary-soft)]',
      button: 'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-strong)] focus:ring-[var(--brand-primary)]'
    }
  };

  const color = colors[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="app-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 opacity-100">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${color.icon}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--brand-text)' }}>{title}</h3>
              <p className="leading-relaxed app-text-muted">{message}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3" style={{ backgroundColor: 'var(--brand-surface-soft)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border rounded-lg hover:brightness-95 font-medium transition-all shadow-sm disabled:opacity-50"
            style={{ color: 'var(--brand-text)', backgroundColor: 'var(--brand-card)', borderColor: 'var(--brand-card-border)' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 text-white rounded-lg font-medium transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 ${color.button}`}
          >
            {isProcessing && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
