'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.name === 'ChunkLoadError' ||
    error.message?.includes('ChunkLoadError') ||
    error.message?.includes('Failed to load chunk') ||
    error.message?.includes('Failed to fetch dynamically imported module');

  if (isChunkError) {
    // Auto-reload for stale chunks after deploy
    if (typeof window !== 'undefined') {
      const reloadKey = 'chunk-error-reload';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 30_000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    }
  }

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
