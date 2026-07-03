import { useCallback, useState } from 'react';

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

  return { count, bump, reset };
}
