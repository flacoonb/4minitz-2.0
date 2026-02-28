'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset: _reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.name === 'ChunkLoadError' ||
    error.message?.includes('ChunkLoadError') ||
    error.message?.includes('Failed to load chunk') ||
    error.message?.includes('Failed to fetch dynamically imported module');

  useEffect(() => {
    if (!isChunkError) return;
    if (typeof window === 'undefined') return;

    const reloadKey = 'chunk-error-reload';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();

    // #region agent log
    fetch('http://localhost:7346/ingest/15cb3796-5cec-49ee-9297-9fc2187ea845', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '089733',
      },
      body: JSON.stringify({
        sessionId: '089733',
        runId: 'initial',
        hypothesisId: 'H2',
        location: 'app/global-error.tsx:18-30',
        message: 'Global error auto-reload evaluated',
        data: {
          reloadKey,
          lastReload,
          now,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (!lastReload || now - parseInt(lastReload, 10) > 30_000) {
      sessionStorage.setItem(reloadKey, String(now));
      window.location.reload();
    }
  }, [isChunkError]);

  return (
    <html>
      <body>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {isChunkError ? 'Neue Version verfügbar' : 'Ein Fehler ist aufgetreten'}
            </h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              {isChunkError
                ? 'Die Anwendung wurde aktualisiert. Bitte laden Sie die Seite neu.'
                : 'Bitte laden Sie die Seite neu.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Seite neu laden
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
