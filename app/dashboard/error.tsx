'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('dashboard');
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="rounded-full p-4 mx-auto mb-4 w-16 h-16 flex items-center justify-center" style={{ backgroundColor: 'var(--brand-danger-soft)' }}>
          <svg className="w-8 h-8" style={{ color: 'var(--brand-danger)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>{t('errorTitle')}</h2>
        <p className="mb-6 text-sm app-text-muted">
          {t('errorText')}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 brand-button-solid rounded-lg transition-colors font-medium"
        >
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
