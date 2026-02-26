'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Ein Fehler ist aufgetreten
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Bitte versuchen Sie es erneut oder laden Sie die Seite neu.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
