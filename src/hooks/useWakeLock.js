import { useEffect } from 'react';

// Signage screens must never doze off mid-club. The Screen Wake Lock API
// asks the OS not to blank the display; the lock is silently released
// whenever the tab is hidden, so we re-request it on every return to
// visibility. Browsers without the API (or kiosks that deny it) simply
// no-op — the failure mode is the status quo, never an error on screen.
export function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || !navigator.wakeLock?.request) return undefined;

    let lock = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Denied (battery saver, permissions policy…) — nothing to do.
      }
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}
