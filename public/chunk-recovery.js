(function chunkRecoveryBootstrap() {
  var STORAGE_TS = 'chunk-recovery-ts';
  var STORAGE_COUNT = 'chunk-recovery-count';
  var WINDOW_MS = 30000;
  var MAX_RELOADS_IN_WINDOW = 2;

  function getNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function canReloadNow() {
    try {
      var now = Date.now();
      var lastTs = getNumber(sessionStorage.getItem(STORAGE_TS), 0);
      var count = getNumber(sessionStorage.getItem(STORAGE_COUNT), 0);

      if (!lastTs || now - lastTs > WINDOW_MS) {
        sessionStorage.setItem(STORAGE_TS, String(now));
        sessionStorage.setItem(STORAGE_COUNT, '1');
        return true;
      }

      if (count < MAX_RELOADS_IN_WINDOW) {
        sessionStorage.setItem(STORAGE_COUNT, String(count + 1));
        return true;
      }

      return false;
    } catch {
      return true;
    }
  }

  function reloadWithCacheBust() {
    if (!canReloadNow()) return;

    try {
      var url = new URL(window.location.href);
      url.searchParams.set('_chunk_recover', String(Date.now()));
      window.location.replace(url.toString());
      return;
    } catch {
      // Ignore URL parsing issues and fallback to hard reload.
    }

    window.location.reload();
  }

  function isNextChunkScript(src) {
    return typeof src === 'string' && src.includes('/_next/static/') && src.includes('.js');
  }

  window.addEventListener(
    'error',
    function onResourceError(event) {
      var target = event && event.target;
      if (!target || target.tagName !== 'SCRIPT') return;

      var src = target.src || '';
      if (isNextChunkScript(src)) {
        reloadWithCacheBust();
      }
    },
    true
  );

  window.addEventListener('unhandledrejection', function onUnhandledRejection(event) {
    var reason = event && event.reason;
    var message = '';

    if (reason && typeof reason === 'object' && 'message' in reason) {
      message = String(reason.message || '');
    } else {
      message = String(reason || '');
    }

    if (
      message.includes('ChunkLoadError') ||
      message.includes('Loading chunk') ||
      message.includes('Failed to fetch dynamically imported module')
    ) {
      reloadWithCacheBust();
    }
  });
})();
