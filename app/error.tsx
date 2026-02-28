'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message?.includes('ChunkLoadError') ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('Failed to load chunk') ||
    error.message?.includes('Failed to fetch dynamically imported module')
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPages');

  useEffect(() => {
    console.error('Application error:', error);

    const isChunkError = isChunkLoadError(error);

    // Auto-reload on ChunkLoadError (stale build after deploy)
    if (isChunkError) {
      const reloadKey = 'chunk-error-reload';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();

      // Prevent infinite reload loop: only auto-reload once per 30 seconds
      if (!lastReload || now - parseInt(lastReload, 10) > 30_000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    }
  }, [error]);

  const isChunkError = isChunkLoadError(error);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('genericTitle')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('genericText')}
        </p>
        <div className="flex gap-3 justify-center">
          {isChunkError ? (
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('tryAgain')}
            </button>
          ) : (
            <>
              <button
                onClick={reset}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {t('tryAgain')}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('backToHome')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
