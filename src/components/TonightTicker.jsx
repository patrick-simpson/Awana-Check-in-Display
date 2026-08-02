import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import { isFresh } from '../lib/freshness.js';
import { TONIGHT_STALE_MS } from '../lib/constants.js';

// How often the ticker re-checks its own freshness against the clock.
// Coarser than DataCycle's 1s clock tick — this only has to notice a
// quiet print server within a minute or two, not animate a face.
const FRESHNESS_CHECK_MS = 30000;

const ROW_SPECS = [
  { key: 'checkedIn', label: 'checked in' },
  { key: 'booksCompleted', label: 'books finished' },
  { key: 'awardsEarned', label: 'awards earned' },
  { key: 'friendsBrought', label: 'friends brought' },
];

/**
 * Pure + exported for tests: which stat rows are worth showing. A zero
 * count reads as a sad "0 awards earned" rather than as information, so
 * it's left out entirely instead of rendered — early in the night that
 * may mean every row is empty, in which case there's nothing to show yet.
 */
export function tonightRows(tonight) {
  if (!tonight) return [];
  return ROW_SPECS
    .map((spec) => ({ ...spec, value: tonight[spec.key] }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0);
}

/**
 * Lobby "tonight" stat strip fed by the printer's `onTonight` broadcast
 * — aggregate counts across every club (checked in, books finished,
 * awards earned, friends brought).
 *
 * This joins the stage as a persistent low-profile strip rather than
 * another face in DataCycle's rotation: DataCycle holds one
 * operator-configured widget (clock/tally/weather) at a time, but these
 * four counts read best together as a single glanceable row, and they're
 * driven by the realtime feed rather than a Settings toggle — mixing the
 * two would mean either breaking the counts into four separate rotation
 * slots (crowding out the clock/weather the operator asked for) or
 * teaching DataCycle about a fifth, differently-shaped data source. A
 * quiet strip of its own keeps both simple.
 *
 * `active` (false while a check-in banner holds the stage) unmounts it
 * via AnimatePresence instead of leaning on z-index alone — a clean dip
 * out and back, and no strip sitting inertly behind a birthday banner.
 * Hidden entirely until the first broadcast arrives, and again once the
 * feed goes stale (TONIGHT_STALE_MS) — a frozen "63 checked in" from an
 * hour ago is worse than showing nothing.
 */
export default function TonightTicker({ tonight, active }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), FRESHNESS_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  const fresh = isFresh(tonight?.at, TONIGHT_STALE_MS, now);
  const rows = fresh ? tonightRows(tonight) : [];
  const show = active && rows.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <M.div
          key="tonight-ticker"
          className="tonight-ticker"
          aria-live="off"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } }}
          exit={{ opacity: 0, y: 28, transition: { duration: 0.3 } }}
        >
          {rows.map((row) => (
            <span key={row.key} className="tonight-ticker-stat">
              {/* Remounting on every value change gives each count the
                  same joyful little pop the corner tally uses. */}
              <M.span
                key={row.value}
                className="tonight-ticker-value"
                initial={{ scale: 1.35, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 16 }}
              >
                {row.value}
              </M.span>
              <span className="tonight-ticker-label">{row.label}</span>
            </span>
          ))}
        </M.div>
      )}
    </AnimatePresence>
  );
}
