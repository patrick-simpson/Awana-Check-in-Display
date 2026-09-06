import { useCallback, useRef, useState } from 'react';
import { TALLY_REORDER_MS } from '../lib/constants.js';

const STORAGE_KEY = 'awanaTally.v1';

// "Tonight's" tally is really "today's" — it survives an accidental page
// refresh mid-club but resets by itself the next time the display is used
// on a different day. Only a number is stored: no names, ever.
function todayKey(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && raw.date === todayKey() && Number.isInteger(raw.count) && raw.count >= 0) {
      return raw.count;
    }
  } catch {
    /* corrupt or blocked storage → start from zero */
  }
  return 0;
}

function save(count) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), count }));
  } catch {
    /* storage may be blocked; in-memory count still works for tonight */
  }
}

export function useTally() {
  const [count, setCount] = useState(load);
  // `at` of the last broadcast this display adopted, for ordering only.
  const lastAtRef = useRef(null);

  const bump = useCallback(() => {
    setCount(() => {
      // Re-read storage so a tally that rolled past midnight (or another
      // tab that counted) stays consistent, then add ours.
      const next = load() + 1;
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    save(0);
    setCount(0);
  }, []);

  // Reconcile the local counter to the print server's authoritative `tally`
  // broadcast — the fix for both an operator UNDO (total drops) and any
  // drift (missed events while offline, a doubled banner, …). Adopts
  // `total` outright rather than nudging toward it: there is no "closer"
  // value than the number the printer just reported.
  //
  // Returns whether the stored count actually changed, so a caller (namely
  // App.jsx's every-Nth-kid milestone effect, which watches `count` rather
  // than `bump()` calls) can tell a reconciliation jump apart from a real,
  // one-at-a-time increment and skip celebrating it.
  const sync = useCallback((total, at) => {
    if (!Number.isInteger(total) || total < 0) return false;
    // Order broadcasts against EACH OTHER — never against this device's
    // clock. See TALLY_REORDER_MS: comparing the printer's `at` to our
    // Date.now() silently rejected every broadcast on a screen whose
    // clock drifted, which is exactly how the corner counter could run
    // high all evening with no way back. A broadcast stamped older than
    // the last one we adopted is out of order and ignored; one older by
    // more than the reorder window means the printer's clock moved, so
    // we re-baseline on it instead of ignoring the printer forever.
    // sanitizeTally() drops any payload without a real `at`, so a missing
    // one here means something upstream is wrong — stay defensive.
    if (typeof at !== 'number' || !Number.isFinite(at)) return false;
    const last = lastAtRef.current;
    if (last !== null && at < last && last - at <= TALLY_REORDER_MS) return false;
    lastAtRef.current = at;
    const current = load();
    if (current === total) return false; // already in sync
    save(total);
    setCount(total);
    return true;
  }, []);

  return { count, bump, reset, sync };
}
